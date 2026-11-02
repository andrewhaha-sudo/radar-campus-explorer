import { useCallback, useEffect, useRef, useState } from "react";
import { isWalkable, type Point } from "./navigation";
import { scenes } from "./campus-data";
import {
  accuracyRadiusPixels,
  assessFix,
  browserGeolocation,
  GPS_STATUS_LABEL,
  headingDirection,
  locationIsSecure,
  LocationWatcher,
  readingFromPosition,
  type GeoReading,
  type GeolocationSource,
  type GpsStatus,
} from "../../lib/location-sync";
import {
  calibrationReady,
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
  const calibrationRef = useRef(calibration);
  const indoorsRef = useRef(indoors);
  const reliableRef = useRef<GeoReading | null>(null);
  const lastReadingRef = useRef<GeoReading | null>(null);
  const watcherRef = useRef<LocationWatcher | null>(null);

  const rememberPlacement = useCallback((point: Point | null) => {
    setPlacement((current) => {
      if (!point) return null;
      if (
        current &&
        Math.hypot(current.x - point.x, current.y - point.y) < 12
      )
        return current;
      return point;
    });
  }, []);

  const applyReading = useCallback(
    (reading: GeoReading) => {
      lastReadingRef.current = reading;
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
              : "This location fix could not be used. The character stayed in place.",
        );
        return;
      }
      if (indoorsRef.current) {
        setStatus("low_accuracy");
        setMessage(
          "Approximate location. GPS cannot choose a floor or a classroom, so the character was not moved indoors.",
        );
        rememberPlacement(null);
        setMarker(null);
        return;
      }
      if (assessed.quality === "approximate") {
        setStatus("low_accuracy");
        setMessage(
          "Approximate location. This fix is not accurate enough to move the character.",
        );
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
        setMarker(null);
        return;
      }
      if (!isWalkable(projected.point, scenes.campus.walkable)) {
        setStatus("low_accuracy");
        setMessage(
          "The GPS fix lands on a blocked part of the illustrated map. The character stayed in place.",
        );
        setMarker(null);
        return;
      }
      reliableRef.current = reading;
      setStatus("connected");
      setMessage(
        "GPS Connected. The character follows reliable outdoor fixes on this device only.",
      );
      setHeading(headingDirection(reading, calibrationRef.current));
      const radius = accuracyRadiusPixels(reading, calibrationRef.current);
      setMarker({ point: projected.point, radius });
      rememberPlacement(projected.point);
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
    setMessage(
      "GPS Disabled. Tracking stopped. Coordinates were not saved or sent.",
    );
  }, []);

  useEffect(() => {
    if (!enabled || !mapActive) {
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
      setStatus(
        calibrated
          ? permission === "granted"
            ? "locating"
            : "requesting_permission"
          : "calibration_required",
      );
      setMessage(
        calibrated
          ? permission === "granted"
            ? "Locating. Waiting for a GPS fix."
            : "Requesting Permission. Allow location access if the browser asks."
          : `${GPS_STATUS_LABEL.calibration_required}. Permission may be requested, but the character will not move.`,
      );
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
      watcher.stop();
      if (watcherRef.current === watcher) watcherRef.current = null;
      setTracking(false);
    };
  }, [applyReading, calibration, enabled, indoors, mapActive]);

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
      enabled && !mapActive
        ? "Location sync is paused while the map is hidden. Tracking resumes when you return."
        : message,
    accuracy,
    lastUpdate,
    placement,
    heading,
    marker: status === "connected" ? marker : null,
    calibration,
    enable,
    disable,
    saveCalibration,
    clearCalibration,
  };
}
