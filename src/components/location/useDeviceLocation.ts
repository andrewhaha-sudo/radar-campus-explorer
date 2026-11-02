import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calibrate } from "../../lib/map-calibration";
import type { Calibration } from "../../lib/map-calibration";
import {
  browserLocationSource,
  evaluateLocation,
  SIGNAL_TIMEOUT,
} from "../../lib/live-location";
import type { LocationStatus, ReliableFix } from "../../lib/live-location";
import { scenes } from "../map/campus-data";
import { canTravel, isWalkable } from "../map/navigation";

interface LocationState {
  owner: string;
  fix: ReliableFix | null;
  accuracy: number | null;
  status: LocationStatus;
  detail: string;
}
const initial = (owner: string): LocationState => ({
  owner,
  fix: null,
  accuracy: null,
  status: "inactive",
  detail: "Location synchronization is inactive.",
});
const campus = scenes.campus.walkable;
const map = {
  accepts: (point: { x: number; y: number }) => isWalkable(point, campus),
  canInterpolate: (a: { x: number; y: number }, b: { x: number; y: number }) =>
    canTravel(a, b, campus),
};

export function useDeviceLocation(
  calibration: Calibration | null,
  owner: string,
) {
  const alignment = useMemo(
    () => (calibration ? calibrate(calibration) : null),
    [calibration],
  );
  const [request, setRequest] = useState<{ owner: string; enabled: boolean }>({
    owner,
    enabled: false,
  });
  const [state, setState] = useState<LocationState>(() => initial(owner));
  const cleanup = useRef<(() => void) | null>(null);
  const lastReliable = useRef<{ owner: string; fix: ReliableFix | null }>({
    owner,
    fix: null,
  });
  useEffect(() => {
    if (lastReliable.current.owner !== owner)
      lastReliable.current = { owner, fix: null };
  }, [owner]);
  const enabled = request.enabled && request.owner === owner;
  const stop = useCallback(() => {
    cleanup.current?.();
    setRequest({ owner, enabled: false });
    setState((value) => ({
      ...value,
      status: "inactive",
      detail:
        "Location synchronization is inactive. Last reliable position retained.",
      fix: value.fix ? { ...value.fix, moving: false, smooth: false } : null,
    }));
  }, [owner]);
  const enable = () => {
    if (!alignment) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setState({
        ...initial(owner),
        status: "unsupported",
        detail:
          "Device location needs HTTPS (or localhost) and a browser with location services.",
      });
      return;
    }
    setState((value) => ({
      ...(value.owner === owner ? value : initial(owner)),
      status: "locating",
      detail: "Waiting for device location and browser permission…",
    }));
    setRequest({ owner, enabled: true });
  };
  const reset = () => {
    stop();
    lastReliable.current = { owner, fix: null };
    setState(initial(owner));
  };

  useEffect(() => {
    if (!enabled || !alignment) return;
    let active = true;
    let cancelWatch: (() => void) | null = null;
    let generation = 0;
    let lastTimestamp = 0;
    let lastReceived = Date.now();
    let previous =
      lastReliable.current.owner === owner ? lastReliable.current.fix : null;
    let movementTimer = 0;
    const disconnect = () => {
      generation++;
      cancelWatch?.();
      cancelWatch = null;
      clearTimeout(movementTimer);
    };
    const connect = () => {
      disconnect();
      if (!active || document.hidden) return;
      const token = generation;
      lastReceived = Date.now();
      try {
        cancelWatch = browserLocationSource.subscribe(
          (reading) => {
            if (!active || token !== generation || document.hidden) return;
            const receivedAt = Date.now();
            const fresh =
              Number.isFinite(reading.timestamp) &&
              reading.timestamp <= receivedAt + 5000 &&
              receivedAt - reading.timestamp <= 15_000;
            if (fresh && reading.timestamp <= lastTimestamp) return;
            // A corrupt/future timestamp must not block later valid readings.
            if (fresh) lastTimestamp = reading.timestamp;
            lastReceived = receivedAt;
            const result = evaluateLocation(reading, previous, alignment, map);
            previous = result.fix;
            lastReliable.current = { owner, fix: result.fix };
            clearTimeout(movementTimer);
            setState({
              owner,
              ...result,
              accuracy:
                Number.isFinite(reading.accuracy) && reading.accuracy > 0
                  ? reading.accuracy
                  : null,
            });
            // Walking animation ends between readings; position never extrapolates.
            movementTimer = window.setTimeout(() => {
              if (active)
                setState((value) => ({
                  ...value,
                  fix: value.fix ? { ...value.fix, moving: false } : null,
                }));
            }, 1200);
          },
          (code) => {
            if (!active || token !== generation) return;
            clearTimeout(movementTimer);
            if (code === 1) {
              disconnect();
              setRequest({ owner, enabled: false });
            }
            setState((value) => ({
              ...value,
              owner,
              status: code === 1 ? "denied" : "unavailable",
              detail:
                code === 1
                  ? "Location permission denied. Enable location for this site in your browser settings, then try again."
                  : "Location Signal Unavailable. Waiting for device location to return.",
              fix: value.fix
                ? { ...value.fix, moving: false, smooth: false }
                : null,
            }));
          },
        );
      } catch {
        disconnect();
        setRequest({ owner, enabled: false });
        setState((value) => ({
          ...value,
          status: "unavailable",
          detail:
            "Location Signal Unavailable. Check your browser location settings.",
        }));
      }
    };
    const visibility = () => {
      if (document.hidden) {
        disconnect();
        setState((value) => ({
          ...value,
          status: "paused",
          detail: "Tracking paused while this page is in the background.",
          fix: value.fix
            ? { ...value.fix, moving: false, smooth: false }
            : null,
        }));
      } else {
        setState((value) => ({
          ...value,
          status: "locating",
          detail: "Waiting for a fresh device location…",
        }));
        connect();
      }
    };
    const leave = () => {
      stop();
    };
    const timer = window.setInterval(() => {
      if (
        active &&
        !document.hidden &&
        Date.now() - lastReceived > SIGNAL_TIMEOUT
      )
        setState((value) => ({
          ...value,
          status: "unavailable",
          detail:
            "Location Signal Unavailable. Last reliable position retained.",
          fix: value.fix
            ? { ...value.fix, moving: false, smooth: false }
            : null,
        }));
    }, 2000);
    const dispose = () => {
      active = false;
      disconnect();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", leave);
    };
    cleanup.current = dispose;
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", leave);
    connect();
    return dispose;
  }, [enabled, owner, alignment, stop]);

  return {
    ...(state.owner === owner ? state : initial(owner)),
    enabled,
    alignment,
    enable,
    stop,
    reset,
  };
}
