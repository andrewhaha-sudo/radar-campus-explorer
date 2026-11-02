import { useState } from "react";
import type { GpsStatus } from "../../lib/location-sync";
import {
  CAMPUS_PIXEL_HEIGHT,
  CAMPUS_PIXEL_WIDTH,
  type CalibrationPoint,
  type MapCalibration,
} from "../../lib/map-calibration";

const blankPoint = (index: number): CalibrationPoint => ({
  id: `point-${index + 1}`,
  label: `Point ${index + 1}`,
  latitude: Number.NaN,
  longitude: Number.NaN,
  x: Number.NaN,
  y: Number.NaN,
});

function draftFrom(calibration: MapCalibration): CalibrationPoint[] {
  return [0, 1, 2].map((index) => {
    const saved = calibration.points[index];
    return saved
      ? { ...saved, id: `point-${index + 1}`, label: `Point ${index + 1}` }
      : blankPoint(index);
  });
}

function numberValue(value: number) {
  return Number.isFinite(value) ? String(value) : "";
}

export function LocationSyncPanel({
  status,
  statusLabel,
  message,
  accuracy,
  lastUpdate,
  enabled,
  tracking,
  pausedByUser,
  onEnable,
  onDisable,
  onResume,
  calibration,
  onSaveCalibration,
  onClearCalibration,
  onSaveDemo,
  savingDemo,
  indoors,
  picking,
  onPick,
  pickedPixel,
}: {
  status: GpsStatus;
  statusLabel: string;
  message: string;
  accuracy: number | null;
  lastUpdate: number | null;
  enabled: boolean;
  tracking: boolean;
  pausedByUser: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onResume: () => void;
  calibration: MapCalibration;
  onSaveCalibration: (points: CalibrationPoint[]) => string | null;
  onClearCalibration: () => void;
  onSaveDemo: () => void;
  savingDemo: boolean;
  indoors: boolean;
  picking: number | null;
  onPick: (index: number | null) => void;
  pickedPixel: { index: number; x: number; y: number } | null;
}) {
  const [draft, setDraft] = useState(() => draftFrom(calibration));
  const savedKey = calibration.points
    .map((point) => `${point.id}:${point.latitude}:${point.longitude}:${point.x}:${point.y}`)
    .join("|");
  const [seenKey, setSeenKey] = useState(savedKey);
  if (savedKey !== seenKey) {
    setSeenKey(savedKey);
    setDraft(draftFrom(calibration));
  }
  const [appliedPick, setAppliedPick] = useState(pickedPixel);
  const [error, setError] = useState("");
  if (pickedPixel && pickedPixel !== appliedPick) {
    setAppliedPick(pickedPixel);
    setDraft((current) =>
      current.map((point, index) =>
        index === pickedPixel.index
          ? { ...point, x: pickedPixel.x, y: pickedPixel.y }
          : point,
      ),
    );
  }
  const update = (index: number, field: "latitude" | "longitude" | "x" | "y", raw: string) => {
    setDraft((current) =>
      current.map((point, pointIndex) =>
        pointIndex === index
          ? { ...point, [field]: raw.trim() === "" ? Number.NaN : Number(raw) }
          : point,
      ),
    );
  };
  return (
    <section className="campus-location-sync" aria-label="Live location">
      <span className="campus-eyebrow">LIVE LOCATION</span>
      <p className="campus-location-status" role="status" data-gps-status={status}>
        <strong>{statusLabel}</strong>
        {tracking && <span className="campus-live">On</span>}
      </p>
      <p className="campus-small">{message}</p>
      <dl className="campus-location-facts">
        <div>
          <dt>Accuracy</dt>
          <dd>
            {accuracy === null
              ? "Unavailable"
              : `${Math.round(accuracy)} m`}
          </dd>
        </div>
        <div>
          <dt>Last successful update</dt>
          <dd>
            {lastUpdate === null
              ? "None"
              : new Date(lastUpdate).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
          </dd>
        </div>
      </dl>
      <div className="campus-location-actions">
        <button
          type="button"
          className="campus-primary"
          onClick={onEnable}
          disabled={enabled}
        >
          Enable GPS
        </button>
        <button
          type="button"
          className="campus-secondary"
          onClick={onDisable}
          disabled={!enabled}
        >
          Disable GPS
        </button>
      </div>
      {pausedByUser && enabled && status === "connected" && (
        <button type="button" className="campus-secondary campus-wide" onClick={onResume}>
          Use GPS again
        </button>
      )}
      <button
        type="button"
        className="campus-primary campus-wide"
        onClick={onSaveDemo}
        disabled={savingDemo || indoors}
      >
        {savingDemo ? "Reading location…" : "Save my current location for demo"}
      </button>
      <p className="campus-small">
        DEMO only. Saves this phone’s current GPS at the character’s current
        spot and assumes north is toward the top of the map, about 8 pixels per
        meter. It is not a surveyed school map. Coordinates stay on this device
        and are not shown to other students.
      </p>
      <details className="campus-calibration">
        <summary>Calibrate this device</summary>
        <p className="campus-small">
          The school’s latitude and longitude are not included. Enter three
          surveyed outdoor points, or pick a map pixel and type its surveyed
          coordinates. Pixels run from 0 to {CAMPUS_PIXEL_WIDTH} by{" "}
          {CAMPUS_PIXEL_HEIGHT}. This calibration is saved only in this browser.
        </p>
        {draft.map((point, index) => (
          <fieldset key={point.id} className="campus-calibration-point">
            <legend>{point.label}</legend>
            <label>
              Latitude
              <input
                inputMode="decimal"
                aria-label={`Calibration point ${index + 1} latitude`}
                value={numberValue(point.latitude)}
                onChange={(event) => update(index, "latitude", event.target.value)}
              />
            </label>
            <label>
              Longitude
              <input
                inputMode="decimal"
                aria-label={`Calibration point ${index + 1} longitude`}
                value={numberValue(point.longitude)}
                onChange={(event) => update(index, "longitude", event.target.value)}
              />
            </label>
            <label>
              Map X
              <input
                inputMode="decimal"
                aria-label={`Calibration point ${index + 1} map x`}
                value={numberValue(point.x)}
                onChange={(event) => update(index, "x", event.target.value)}
              />
            </label>
            <label>
              Map Y
              <input
                inputMode="decimal"
                aria-label={`Calibration point ${index + 1} map y`}
                value={numberValue(point.y)}
                onChange={(event) => update(index, "y", event.target.value)}
              />
            </label>
            <button
              type="button"
              className="campus-secondary"
              aria-pressed={picking === index}
              onClick={() => onPick(picking === index ? null : index)}
            >
              {picking === index ? "Click the outdoor map…" : "Pick on map"}
            </button>
          </fieldset>
        ))}
        {error && (
          <p className="student-error" role="alert">
            {error}
          </p>
        )}
        <div className="campus-location-actions">
          <button
            type="button"
            className="campus-primary"
            onClick={() => {
              const failure = onSaveCalibration(draft);
              setError(failure ?? "");
              if (!failure) onPick(null);
            }}
          >
            Save calibration on this device
          </button>
          <button
            type="button"
            className="campus-secondary"
            onClick={() => {
              setDraft([0, 1, 2].map(blankPoint));
              setError("");
              onClearCalibration();
              onPick(null);
            }}
          >
            Clear calibration
          </button>
        </div>
      </details>
    </section>
  );
}
