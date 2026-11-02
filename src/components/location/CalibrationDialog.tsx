import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { calibrate, saveCalibration } from "../../lib/map-calibration";
import type { Calibration } from "../../lib/map-calibration";
import { cn } from "../../lib/cn";

type Draft = {
  label: string;
  latitude: string;
  longitude: string;
  x: string;
  y: string;
};
const blank = (): Draft => ({
  label: "",
  latitude: "",
  longitude: "",
  x: "",
  y: "",
});
const toDraft = (value: Calibration) =>
  value.points.map((p) => ({
    label: p.label,
    latitude: String(p.latitude),
    longitude: String(p.longitude),
    x: String(p.x),
    y: String(p.y),
  }));

export function CalibrationDialog({
  value,
  onSave,
  onClose,
}: {
  value: Calibration | null;
  onSave: (value: Calibration) => void;
  onClose: () => void;
}) {
  const [points, setPoints] = useState<Draft[]>(() =>
    value ? toDraft(value) : [blank(), blank(), blank()],
  );
  const [selected, setSelected] = useState(0);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const image = useRef<SVGSVGElement>(null);
  const update = (i: number, patch: Partial<Draft>) => {
    setVerified(false);
    setPoints((list) =>
      list.map((p, index) => (index === i ? { ...p, ...patch } : p)),
    );
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="student-overlay" />
        <Dialog.Content className="student-modal calibration-modal">
          <header className="student-modal-heading">
            <div>
              <Dialog.Title>Calibrate campus map</Dialog.Title>
              <Dialog.Description>
                Match verified geographic references to this exact image. No
                sample coordinates are supplied.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="student-modal-close"
              aria-label="Close map calibration"
            >
              <X size={20} />
            </Dialog.Close>
          </header>
          <p className="student-help">
            Use at least 3 non-collinear points around the area you will walk; 4
            or more are better. GPS placement works only inside their boundary.
            An illustrated map may not align accurately everywhere—check
            additional landmarks on site.
          </p>
          <form
            className="student-editor"
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              try {
                if (
                  !verified ||
                  points.some((p) => Object.values(p).some((v) => !v.trim()))
                )
                  throw new Error(
                    "Complete every reference and confirm that you verified the points.",
                  );
                const next: Calibration = {
                  version: 1,
                  image: "/maps/campus.jpg",
                  verified: true,
                  points: points.map((p) => ({
                    label: p.label.trim(),
                    latitude: Number(p.latitude),
                    longitude: Number(p.longitude),
                    x: Number(p.x),
                    y: Number(p.y),
                  })),
                };
                saveCalibration(next);
                onSave(next);
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Calibration could not be saved on this device.",
                );
              }
            }}
          >
            <div className="calibration-map">
              <p>
                Selected reference: <strong>{selected + 1}</strong>. Tap its
                exact position on the map, or enter image X/Y below.
              </p>
              <svg
                ref={image}
                viewBox="0 0 1254 1254"
                role="img"
                aria-label="Calibration map; image X and Y can also be entered in the reference fields"
                onClick={(event) => {
                  const matrix = image.current?.getScreenCTM();
                  if (!matrix) return;
                  const p = new DOMPoint(
                    event.clientX,
                    event.clientY,
                  ).matrixTransform(matrix.inverse());
                  update(selected, {
                    x: String(Math.round(p.x)),
                    y: String(Math.round(p.y)),
                  });
                }}
              >
                <image href="/maps/campus.jpg" width="1254" height="1254" />
                <g pointerEvents="none" aria-label="Building E sign">
                  <rect x="301" y="477" width="87" height="24" fill="#fff6d8" />
                  <text
                    x="344"
                    y="498"
                    textAnchor="middle"
                    fontFamily="Arial, sans-serif"
                    fontWeight="700"
                    fontSize="25"
                    textLength="87"
                    lengthAdjust="spacingAndGlyphs"
                    fill="#181719"
                  >
                    Bldg. E
                  </text>
                </g>
                {points.map(
                  (p, i) =>
                    p.x !== "" &&
                    p.y !== "" && (
                      <g
                        key={i}
                        transform={"translate(" + p.x + "," + p.y + ")"}
                        pointerEvents="none"
                      >
                        <circle
                          r="22"
                          fill={i === selected ? "#7352b5" : "#25243d"}
                          stroke="white"
                          strokeWidth="4"
                        />
                        <text
                          textAnchor="middle"
                          y="9"
                          fill="white"
                          fontSize="26"
                          fontWeight="700"
                        >
                          {i + 1}
                        </text>
                      </g>
                    ),
                )}
              </svg>
            </div>
            {points.map((point, i) => (
              <fieldset
                key={i}
                className={cn(
                  "calibration-reference",
                  i === selected && "is-selected",
                )}
              >
                <legend>Reference {i + 1}</legend>
                <button
                  type="button"
                  className="campus-secondary"
                  aria-pressed={selected === i}
                  onClick={() => {
                    setSelected(i);
                    image.current?.scrollIntoView({ block: "center" });
                  }}
                >
                  Pick reference {i + 1} on map
                </button>
                <label>
                  Reference name / verified source
                  <input
                    required
                    maxLength={120}
                    value={point.label}
                    onChange={(event) =>
                      update(i, { label: event.target.value })
                    }
                    placeholder="Landmark and coordinate source"
                  />
                </label>
                <div className="calibration-coordinates">
                  {(
                    [
                      {
                        key: "latitude",
                        label: "Latitude",
                        min: -84.999999,
                        max: 84.999999,
                      },
                      {
                        key: "longitude",
                        label: "Longitude",
                        min: -180,
                        max: 180,
                      },
                      { key: "x", label: "Image X", min: 0, max: 1254 },
                      { key: "y", label: "Image Y", min: 0, max: 1254 },
                    ] as const
                  ).map(({ key, label, min, max }) => (
                    <label key={key}>
                      {label}
                      <input
                        type="number"
                        step="any"
                        required
                        min={min}
                        max={max}
                        value={point[key]}
                        onChange={(event) =>
                          update(i, { [key]: event.target.value })
                        }
                      />
                    </label>
                  ))}
                </div>
                {points.length > 3 && (
                  <button
                    type="button"
                    className="campus-secondary"
                    onClick={() => {
                      setPoints((list) =>
                        list.filter((_, index) => index !== i),
                      );
                      setSelected(0);
                      setVerified(false);
                    }}
                  >
                    Remove reference {i + 1}
                  </button>
                )}
              </fieldset>
            ))}
            <div className="student-actions">
              <button
                type="button"
                className="campus-secondary"
                disabled={points.length >= 12}
                onClick={() => {
                  setPoints([...points, blank()]);
                  setVerified(false);
                }}
              >
                Add reference point
              </button>
              <label className="calibration-import">
                Import calibration
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    try {
                      if (file.size > 50_000)
                        throw new Error(
                          "Use a calibration JSON file smaller than 50 KB.",
                        );
                      const imported = JSON.parse(await file.text());
                      calibrate(imported);
                      setPoints(toDraft(imported));
                      setSelected(0);
                      setVerified(false);
                      setError("");
                    } catch (cause) {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "This calibration file is invalid.",
                      );
                    }
                  }}
                />
              </label>
              {value && (
                <button
                  type="button"
                  className="campus-secondary"
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(value, null, 2)], {
                        type: "application/json",
                      }),
                    );
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "campus-calibration.json";
                    link.click();
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  Download saved calibration
                </button>
              )}
            </div>
            <label className="calibration-consent">
              <input
                type="checkbox"
                checked={verified}
                onChange={(event) => setVerified(event.target.checked)}
                required
              />
              I have checked these reference points against the physical campus.
            </label>
            <p className="student-help">
              Only these deliberately entered references are saved on this
              device. Live GPS readings and travel history are never saved.
            </p>
            {error && (
              <p role="alert" className="student-error">
                {error}
              </p>
            )}
            <div className="student-actions">
              <button
                type="button"
                className="campus-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button className="campus-primary">Save calibration</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
