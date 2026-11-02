import { useCallback, useEffect, useRef, useState } from "react";
import type { Point } from "./navigation";
import {
  accuracyRadiusPixels,
  acceptNewerFix,
  assessFix,
  browserGeolocation,
  fixClock,
  FRESH_FIX_MS,
  gpsMoveGate,
  GPS_STATUS_LABEL,
  headingDirection,
  locationIsSecure,
  LocationWatcher,
  readingFromPosition,
  readingWithMotion,
  RELIABLE_ACCURACY_METERS,
  shouldHeartbeat,
  type FixClock,
  type GeoReading,
  type GeolocationSource,
  type GpsStatus,
} from "../../lib/location-sync";
import {
  calibrationReady,
  demoCalibrationFromHere,
  geographicToPixel,
  readCalibration,
  writeCalibration,
  type CalibrationPoint,
  type MapCalibration,
} from "../../lib/map-calibration";

export interface GpsMarker {
  point: Point;
  radius: number | null;
}

function permissionState() {
  const permissions = navigator.permissions;
  if (!permissions?.query) return Promise.resolve<PermissionState | "unknown">("unknown");
  return permissions
    .query({ name: "geolocation" })
    .then((status) => status.state)
    .catch(() => "unknown" as const);
}

export function useLocationSync(indoors: boolean, mapActive: boolean) {
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const trackingActive = mapActive && pageVisible;
  const [enabled, setEnabled] = useState(false);
  const [calibration, setCalibration] = useState<MapCalibration>(() =>
    readCalibration(),
  );
  const [status, setStatus] = useState<GpsStatus>("disabled");
  const [message, setMessage] = useState(
    "Location sync is off. GPS stays on this device and is not sent to the server.",
  );
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [placement, setPlacement] = useState<Point | null>(null);
  const [heading, setHeading] = useState<ReturnType<typeof headingDirection>>(null);
  const [marker, setMarker] = useState<GpsMarker | null>(null);
  const [tracking, setTracking] = useState(false);
  const [savingDemo, setSavingDemo] = useState(false);
  const [deviceFix, setDeviceFix] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [signal, setSignal] = useState<FixClock>("hidden");
  const calibrationRef = useRef(calibration);
  const indoorsRef = useRef(indoors);
  const reliableRef = useRef<GeoReading | null>(null);
  const lastReadingRef = useRef<GeoReading | null>(null);
  const acceptedRef = useRef<GeoReading | null>(null);
  const lastAttemptRef = useRef(0);
  const pollingRef = useRef(false);
  const watcherRef = useRef<LocationWatcher | null>(null);
  const live = useRef<{
    reading: GeoReading;
    calibration: MapCalibration;
  } | null>(null);

  const rememberPlacement = useCallback((point: Point | null, hold = 4) => {
    setPlacement((current) => {
      if (!point) return null;
      if (
        current &&
        Math.hypot(current.x - point.x, current.y - point.y) < hold
      )
        return current;
      return point;
    });
  }, []);

  const applyReading = useCallback(
    (reading: GeoReading) => {
      lastAttemptRef.current = Date.now();
      if (!acceptNewerFix(lastReadingRef.current, reading)) return;
      const prior = lastReadingRef.current;
      const enriched = readingWithMotion(
        prior && Date.now() - prior.timestamp <= FRESH_FIX_MS ? prior : null,
        reading,
      );
      lastReadingRef.current = enriched;
      reading = enriched;
      setSignal(fixClock(reading.timestamp, Date.now()));
      setAccuracy(reading.accuracy);
      setLastUpdate(reading.timestamp);
      const calibrated = calibrationReady(calibrationRef.current);
      const assessed = assessFix(reading, reliableRef.current, Date.now());
      if (!calibrated) {
        setStatus("calibration_required");
        setMessage(
          `${GPS_STATUS_LABEL.calibration_required}. A device fix was received, and the character was not moved.`,
        );
        rememberPlacement(null);
        setMarker(null);
        setHeading(null);
        return;
      }
      if (assessed.quality === "rejected") {
        setStatus("low_accuracy");
        setMessage(
          assessed.reason === "implausible_jump"
            ? "A physically implausible GPS jump was ignored. The character stayed at its last position."
            : assessed.reason === "stale"
              ? "The location fix is stale. The character stayed at its last position."
              : "Approximate location. This fix is too coarse to move the character.",
        );
        return;
      }
      if (indoorsRef.current) {
        setStatus("low_accuracy");
        setMessage(
          "Approximate location. GPS cannot choose a floor or a classroom, so the character was not moved indoors.",
        );
        live.current = null;
        setDeviceFix(null);
        rememberPlacement(null);
        setMarker(null);
        return;
      }
      const projected = geographicToPixel(
        reading.latitude,
        reading.longitude,
        calibrationRef.current,
      );
      if (!projected.ok) {
        setStatus(
          projected.reason === "out_of_range" ? "low_accuracy" : "calibration_required",
        );
        setMessage(
          projected.reason === "out_of_range"
            ? "The GPS fix is outside the illustrated campus. The character was not moved."
            : `${GPS_STATUS_LABEL.calibration_required}. The character was not moved.`,
        );
        live.current = null;
        setMarker(null);
        return;
      }
      const gate = gpsMoveGate(acceptedRef.current, reading);
      if (!gate.accept) {
        const demo = calibrationRef.current.demo ? "DEMO calibration saved. " : "";
        setMessage(
          `${demo}Held. The phone shifted ${gate.meters.toFixed(1)} m, inside the noise gate for a ${Math.round(reading.accuracy)} m fix. The character stayed put.`,
        );
        return;
      }
      acceptedRef.current = reading;
      live.current = { reading, calibration: calibrationRef.current };
      setDeviceFix({
        latitude: reading.latitude,
        longitude: reading.longitude,
      });
      if (assessed.quality === "reliable") reliableRef.current = reading;
      setHeading(headingDirection(reading, calibrationRef.current));
      const radius = accuracyRadiusPixels(reading, calibrationRef.current);
      setMarker({ point: projected.point, radius });
      rememberPlacement(projected.point, 0);
      if (assessed.quality === "approximate") {
        setStatus("low_accuracy");
        setMessage(
          "Approximate location. The character follows this outdoor fix, and the circle is the uncertainty. GPS is not a classroom position.",
        );
        return;
      }
      setStatus("connected");
      setMessage(
        calibrationRef.current.demo
          ? "DEMO calibration saved. GPS Connected. The character takes the fix once the step clears the phone's noise, then cuts straight across open ground. North is toward the top of the map, about 8 pixels per meter. This is not a surveyed campus."
          : "GPS Connected. The character takes the fix once the step clears the phone's noise, then cuts straight across open ground. The position stays on this device.",
      );
    },
    [rememberPlacement],
  );

  const disable = useCallback(() => {
    watcherRef.current?.stop();
    watcherRef.current = null;
    setTracking(false);
    setEnabled(false);
    setStatus("disabled");
    setAccuracy(null);
    setPlacement(null);
    setMarker(null);
    setHeading(null);
    reliableRef.current = null;
    lastReadingRef.current = null;
    acceptedRef.current = null;
    lastAttemptRef.current = 0;
    pollingRef.current = false;
    setSignal("hidden");
    live.current = null;
    setDeviceFix(null);
    setMessage(
      "GPS Disabled. Tracking stopped. Coordinates were not saved or sent.",
    );
  }, []);

  useEffect(() => {
    if (!enabled || !trackingActive) {
      if (watcherRef.current) {
        watcherRef.current.stop();
        watcherRef.current = null;
        setTracking(false);
      }
      return;
    }
    if (!locationIsSecure()) {
      setStatus("unavailable");
      setMessage(
        "GPS Signal Unavailable. Location needs HTTPS or localhost, so tracking was not started.",
      );
      return;
    }
    const source: GeolocationSource | null = browserGeolocation();
    if (!source) {
      setStatus("unavailable");
      setMessage(
        "GPS Signal Unavailable. This browser does not provide device location.",
      );
      return;
    }
    let cancelled = false;
    let heartbeat = 0;
    calibrationRef.current = calibration;
    indoorsRef.current = indoors;
    const watcher = new LocationWatcher(source);
    watcherRef.current = watcher;
    const start = (permission: PermissionState | "unknown") => {
      if (cancelled) return;
      if (permission === "denied") {
        setStatus("permission_denied");
        setEnabled(false);
        setMessage(
          "Permission Denied. Allow location access in the browser, then enable GPS again.",
        );
        return;
      }
      const calibrated = calibrationReady(calibrationRef.current);
      const demo = calibrationRef.current.demo === true;
      setStatus(
        calibrated
          ? permission === "granted"
            ? "locating"
            : "requesting_permission"
          : "calibration_required",
      );
      setMessage(
        calibrated
          ? demo
            ? "DEMO calibration saved. Locating the next outdoor fix."
            : permission === "granted"
              ? "Locating. Waiting for a GPS fix."
              : "Requesting Permission. Allow location access if the browser asks."
          : `${GPS_STATUS_LABEL.calibration_required}. Permission may be requested, but the character will not move.`,
      );
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!cancelled) applyReading(readingFromPosition(position));
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
      );
      lastAttemptRef.current = Date.now();
      heartbeat = window.setInterval(() => {
        if (cancelled || !shouldHeartbeat(lastAttemptRef.current, Date.now(), pollingRef.current))
          return;
        if (!navigator.geolocation) return;
        pollingRef.current = true;
        lastAttemptRef.current = Date.now();
        navigator.geolocation.getCurrentPosition(
          (position) => {
            pollingRef.current = false;
            if (!cancelled) applyReading(readingFromPosition(position));
          },
          () => {
            pollingRef.current = false;
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 },
        );
      }, 500);
      watcher.start(
        (position) => {
          if (!cancelled) applyReading(readingFromPosition(position));
        },
        (error) => {
          if (cancelled) return;
          if (error.code === 1) {
            watcher.stop();
            setTracking(false);
            setEnabled(false);
            setStatus("permission_denied");
            setMessage(
              "Permission Denied. Location sync was turned off. Nothing was sent.",
            );
            return;
          }
          setStatus("unavailable");
          setMessage(
            "GPS Signal Unavailable. The character is staying at its last position.",
          );
        },
      );
      setTracking(true);
    };
    void permissionState().then((permission) => {
      if (!cancelled) start(permission);
    });
    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      watcher.stop();
      if (watcherRef.current === watcher) watcherRef.current = null;
      setTracking(false);
    };
  }, [applyReading, calibration, enabled, indoors, trackingActive]);

  useEffect(() => {
    if (!enabled || lastUpdate === null) return;
    const id = window.setInterval(() => {
      setSignal(fixClock(lastUpdate, Date.now()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [enabled, lastUpdate]);

  const enable = useCallback(() => {
    setEnabled(true);
    if (!calibrationReady(calibration)) {
      setStatus("calibration_required");
      setMessage(
        `${GPS_STATUS_LABEL.calibration_required}. Enter three surveyed points before the character can follow GPS.`,
      );
    }
  }, [calibration]);

  const saveCalibration = useCallback((points: CalibrationPoint[]) => {
    const next = { points };
    if (!calibrationReady(next))
      return "Those points cannot calibrate the map. Use three non-collinear surveyed positions on the outdoor artwork.";
    writeCalibration(next);
    setCalibration(next);
    return null;
  }, []);

  const saveDemoAt = useCallback(
    (anchor: Point) => {
      if (indoors) {
        setMessage(
          "Return to the outdoor campus. A demo location cannot choose a floor or classroom.",
        );
        return;
      }
      if (!locationIsSecure() || !navigator.geolocation) {
        setStatus("unavailable");
        setMessage(
          "GPS Signal Unavailable. This browser cannot read the current location, so nothing was saved.",
        );
        return;
      }
      setSavingDemo(true);
      setStatus("locating");
      setMessage("Reading this device's current location for a DEMO calibration…");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const reading = readingFromPosition(position);
          const built = demoCalibrationFromHere(
            reading.latitude,
            reading.longitude,
            anchor,
          );
          setSavingDemo(false);
          if (!built.ok) {
            setStatus("calibration_required");
            setMessage(built.reason);
            return;
          }
          writeCalibration(built.calibration);
          setCalibration(built.calibration);
          reliableRef.current = reading;
          lastReadingRef.current = reading;
          setAccuracy(reading.accuracy);
          setLastUpdate(reading.timestamp);
          setEnabled(true);
          const coarse = reading.accuracy > RELIABLE_ACCURACY_METERS;
          setMessage(
            coarse
              ? `DEMO calibration saved, but this fix is only approximate (${Math.round(reading.accuracy)} m). Walk outside until the accuracy is tighter. North is toward the top of the map, about 8 pixels per meter. This is not a surveyed campus.`
              : "DEMO calibration saved at your current location. Walk a few steps outdoors. North is toward the top of the map, about 8 pixels per meter. This is not a surveyed campus.",
          );
        },
        (error) => {
          setSavingDemo(false);
          if (error.code === 1) {
            setStatus("permission_denied");
            setMessage(
              "Permission Denied. Allow location access, then save your current location again.",
            );
            return;
          }
          setStatus("unavailable");
          setMessage("GPS Signal Unavailable. The demo location was not saved.");
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    },
    [indoors],
  );

  const clearCalibration = useCallback(() => {
    writeCalibration({ points: [] });
    setCalibration({ points: [] });
    rememberPlacement(null);
    setMarker(null);
    if (enabled) {
      setStatus("calibration_required");
      setMessage(
        `${GPS_STATUS_LABEL.calibration_required}. Saved calibration was removed from this device.`,
      );
    }
  }, [enabled, rememberPlacement]);

  return {
    enabled,
    tracking,
    status,
    statusLabel: GPS_STATUS_LABEL[status],
    message:
      enabled && !pageVisible
        ? "Location sync is paused while this tab is in the background. Tracking resumes when you return."
        : message,
    accuracy,
    lastUpdate,
    placement,
    heading,
    marker: status === "connected" && signal !== "hidden" ? marker : null,
    signal: enabled ? signal : "hidden",
    calibration,
    enable,
    disable,
    saveCalibration,
    clearCalibration,
    saveDemoAt,
    savingDemo,
    live,
    deviceFix,
  };
}
