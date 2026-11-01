import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, ImagePlus, Upload, X } from "lucide-react";
import type { Room } from "./campus-data";
import { scenes } from "./campus-data";
import {
  publishedRoomPhoto,
  readRoomPhoto,
  saveRoomPhoto,
} from "../../lib/room-photos";
import "./room-photos.css";

interface Preview {
  url: string;
  label: string;
  source: "browser" | "published";
}

export function RoomPhotoDialog({
  room,
  onClose,
  onWalk,
  onRestoreFocus,
}: {
  room: Room;
  onClose: () => void;
  onWalk: () => void;
  onRestoreFocus: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const objectUrl = useRef<string | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    Promise.allSettled([
      readRoomPhoto(room.id),
      publishedRoomPhoto(room.id),
    ]).then(([local, published]) => {
      if (!active) return;
      if (local.status === "fulfilled" && local.value) {
        objectUrl.current = URL.createObjectURL(local.value.blob);
        setPreview({
          url: objectUrl.current,
          label: local.value.name,
          source: "browser",
        });
      } else if (published.status === "fulfilled" && published.value) {
        setPreview({
          url: published.value.src,
          label: published.value.caption ?? room.name,
          source: "published",
        });
      }
      if (local.status === "rejected")
        setError(
          "Saved photos could not be loaded. Browser storage may be disabled.",
        );
      else if (published.status === "rejected" && !local.value)
        setError(
          "Published photos could not be loaded. You can still add a photo here.",
        );
      setLoading(false);
    });
    return () => {
      active = false;
      mounted.current = false;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    };
  }, [room.id, room.name]);

  const upload = async (file: File) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await saveRoomPhoto(room.id, file);
      if (!mounted.current) return;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(saved.blob);
      setPreview({
        url: objectUrl.current,
        label: saved.name,
        source: "browser",
      });
      setNotice("Photo saved. Click this room again to view it.");
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The photo could not be saved.",
        );
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="room-photo-overlay" />
        <Dialog.Content
          className="room-photo-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onRestoreFocus();
          }}
        >
          <header className="room-photo-heading">
            <div>
              <span className="campus-eyebrow">ROOM PHOTO</span>
              <Dialog.Title>{room.name}</Dialog.Title>
              <Dialog.Description>{scenes[room.scene].name}</Dialog.Description>
            </div>
            <Dialog.Close
              className="room-photo-close"
              aria-label="Close room photo"
            >
              <X size={20} />
            </Dialog.Close>
          </header>
          {loading ? (
            <div className="room-photo-empty" role="status">
              Loading room photo…
            </div>
          ) : preview ? (
            <figure className="room-photo-preview">
              <img
                src={preview.url}
                alt={`Photo of ${room.name}`}
                onError={() =>
                  setError(
                    "This photo could not be displayed. Add another image or check its published file path.",
                  )
                }
              />
              <figcaption>
                {preview.label}
                <span>
                  {preview.source === "browser"
                    ? "Saved in this browser"
                    : "Published with this site"}
                </span>
              </figcaption>
            </figure>
          ) : (
            <div className="room-photo-empty">
              <ImagePlus size={38} aria-hidden="true" />
              <strong>No photo for this room yet</strong>
              <p>
                Add an image below. It will appear when you click this room.
              </p>
            </div>
          )}
          <div className="room-photo-upload">
            <label htmlFor={`photo-${room.id}`}>
              <Upload size={16} />
              {preview ? "Replace room photo" : "Add room photo"}
            </label>
            <input
              id={`photo-${room.id}`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={saving || loading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
              aria-describedby={`photo-help-${room.id}`}
            />
            <p id={`photo-help-${room.id}`}>
              JPG, PNG, WebP or GIF · Up to 10 MB. Uploaded photos stay in this
              browser on this device.
            </p>
          </div>
          {saving && (
            <p className="room-photo-notice" role="status">
              Saving photo…
            </p>
          )}
          {notice && (
            <p className="room-photo-notice" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="room-photo-error" role="alert">
              {error}
            </p>
          )}
          <footer className="room-photo-actions">
            <Dialog.Close className="campus-secondary">
              Back to map
            </Dialog.Close>
            <button className="campus-primary" onClick={onWalk}>
              Walk to this room <ArrowRight size={16} />
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
