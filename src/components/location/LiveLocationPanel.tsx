import { LocateFixed } from "lucide-react";
import type { useDeviceLocation } from "./useDeviceLocation";
import { useStudentProfile } from "../student/student-context";
import "./location.css";

const labels = {
  inactive: "Inactive",
  locating: "Connecting",
  live: "Connected",
  uncertain: "Approximate",
  outside: "Outside calibrated area",
  unavailable: "Location Signal Unavailable",
  denied: "Permission denied",
  paused: "Paused in background",
  unsupported: "Unavailable in this browser",
};
export function LiveLocationPanel({
  location,
  calibrated,
  privateSession,
  locationView,
  correction,
  onEnable,
  onIdentity,
  onCalibrate,
  onManual,
  onCorrect,
}: {
  location: ReturnType<typeof useDeviceLocation>;
  calibrated: boolean;
  privateSession: boolean;
  locationView: boolean;
  correction: boolean;
  onEnable: () => void;
  onIdentity: () => void;
  onCalibrate: () => void;
  onManual: () => void;
  onCorrect: () => void;
}) {
  const { identity, profile, loading } = useStudentProfile();
  return (
    <section className="live-location-panel" aria-label="My live location">
      <div className="location-overview">
        <h2>
          <LocateFixed size={18} aria-hidden="true" /> My live location
        </h2>
        <p>
          <strong>
            {identity.displayName || profile.name || "Your character"}
          </strong>
          <span> · {identity.role}</span>
        </p>
        <button
          className="campus-secondary"
          onClick={onIdentity}
          disabled={loading}
        >
          Edit identity
        </button>
      </div>
      <div className="location-readout">
        <div className="location-metrics">
          <span>
            Location sync <strong>{location.enabled ? "ON" : "OFF"}</strong>
          </span>
          <span>
            Accuracy{" "}
            <strong data-testid="location-accuracy">
              {location.accuracy === null
                ? "—"
                : "±" + Math.ceil(location.accuracy) + " m"}
            </strong>
          </span>
        </div>
        <div
          role="status"
          className="location-status"
          data-status={location.status}
        >
          <strong>{labels[location.status]}</strong>
          <p>{location.detail}</p>
        </div>
        {correction && (
          <p className="location-help">
            Tap your position on open ground to correct it manually. For an
            indoor correction, choose a building and floor in Indoor floor
            plans. This is a manual location, not a GPS fix.
          </p>
        )}
        {!calibrated && (
          <p className="location-help">
            Calibrate the map with verified campus coordinates before enabling
            GPS.
          </p>
        )}
        <p className="location-help">
          Enabling sync requests device location. Readings stay on this device;
          no location history is saved. GPS cannot identify a room or floor.
          {privateSession &&
            " Your shared character stays hidden for this session."}
        </p>
      </div>
      <div className="location-actions">
        {location.enabled ? (
          <button className="campus-primary" onClick={location.stop}>
            Disable location sync
          </button>
        ) : (
          <button
            className="campus-primary"
            disabled={!calibrated || loading}
            onClick={onEnable}
          >
            Enable location sync
          </button>
        )}
        <button className="campus-secondary" onClick={onCalibrate}>
          {calibrated ? "Edit map calibration" : "Calibrate map"}
        </button>
        {locationView && (
          <>
            <button className="campus-secondary" onClick={onCorrect}>
              Correct location manually
            </button>
            <button className="campus-secondary" onClick={onManual}>
              Explore manually
            </button>
          </>
        )}
      </div>
    </section>
  );
}
