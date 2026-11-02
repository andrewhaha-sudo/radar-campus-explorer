import { useEffect, useRef, useState } from "react";
import { cropBounds, cropPhoto, initialCrop } from "../../lib/profile-photo";
import type { Crop } from "../../lib/profile-photo";
import { usePhotoUrl } from "./usePhotoUrl";

export function ProfilePhotoCropper({
  photo,
  onSave,
  onCancel,
}: {
  photo: Blob;
  onSave: (photo: Blob) => void;
  onCancel: () => void;
}) {
  const url = usePhotoUrl(photo);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<Crop>(initialCrop);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const bounds = size.width ? cropBounds(size.width, size.height, crop) : null;
  return (
    <section className="photo-cropper" aria-label="Crop profile photo">
      <h4>Fit your photo</h4>
      <p>
        Drag the photo or use the sliders. The portrait frame stays the same.
      </p>
      <div
        className="photo-crop-viewport"
        onPointerDown={(event) => {
          if (busy || !bounds) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, crop };
        }}
        onPointerMove={(event) => {
          if (!drag.current || !bounds) return;
          const box = event.currentTarget.getBoundingClientRect();
          const dx =
            ((event.clientX - drag.current.x) / box.width) * bounds.width;
          const dy =
            ((event.clientY - drag.current.y) / box.height) * bounds.height;
          setCrop({
            ...drag.current.crop,
            x: Math.max(
              0,
              Math.min(
                100,
                drag.current.crop.x -
                  (dx / Math.max(1, size.width - bounds.width)) * 100,
              ),
            ),
            y: Math.max(
              0,
              Math.min(
                100,
                drag.current.crop.y -
                  (dy / Math.max(1, size.height - bounds.height)) * 100,
              ),
            ),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        {url && (
          <img
            src={url}
            alt="Photo crop preview"
            draggable={false}
            onLoad={(event) =>
              setSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            style={
              bounds
                ? {
                    width: `${(size.width / bounds.width) * 100}%`,
                    height: `${(size.height / bounds.height) * 100}%`,
                    left: `${(-bounds.x / bounds.width) * 100}%`,
                    top: `${(-bounds.y / bounds.height) * 100}%`,
                  }
                : undefined
            }
          />
        )}
        <span className="photo-crop-grid" aria-hidden="true" />
      </div>
      <label>
        Zoom <output>{crop.zoom.toFixed(2)}×</output>
        <input
          type="range"
          min="1"
          max="3"
          step="0.05"
          value={crop.zoom}
          disabled={busy}
          onChange={(event) =>
            setCrop({ ...crop, zoom: Number(event.target.value) })
          }
        />
      </label>
      <label>
        Horizontal position
        <input
          type="range"
          min="0"
          max="100"
          value={crop.x}
          disabled={busy}
          onChange={(event) =>
            setCrop({ ...crop, x: Number(event.target.value) })
          }
        />
      </label>
      <label>
        Vertical position
        <input
          type="range"
          min="0"
          max="100"
          value={crop.y}
          disabled={busy}
          onChange={(event) =>
            setCrop({ ...crop, y: Number(event.target.value) })
          }
        />
      </label>
      {error && (
        <p className="student-error" role="alert">
          {error}
        </p>
      )}
      <div className="student-actions">
        <button
          type="button"
          className="campus-secondary"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel crop
        </button>
        <button
          type="button"
          className="campus-primary"
          disabled={!bounds || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const blob = await cropPhoto(photo, crop);
              if (active.current) onSave(blob);
            } catch {
              if (active.current)
                setError("Your photo could not be cropped. Try another image.");
            } finally {
              if (active.current) setBusy(false);
            }
          }}
        >
          {busy ? "Preparing photo…" : "Use cropped photo"}
        </button>
      </div>
    </section>
  );
}
