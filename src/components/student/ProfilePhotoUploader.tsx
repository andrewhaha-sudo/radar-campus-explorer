import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Camera, Crop, Trash2, Upload, X } from "lucide-react";
import type { Character } from "../../lib/student-profile";
import { preparePhoto } from "../../lib/profile-photo";
import { ProfilePhotoCropper } from "./ProfilePhotoCropper";
import { CharacterPortrait } from "./StudentSprite";
import { usePhotoUrl } from "./usePhotoUrl";

function ProfileCamera({
  onCapture,
  onClose,
}: {
  onCapture: (photo: File) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("Camera unavailable");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 1600 },
          },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
          if (active) setReady(true);
        }
      } catch {
        stream?.getTracks().forEach((track) => track.stop());
        if (active)
          setError(
            "Camera access is unavailable or was declined. You can upload a photo instead.",
          );
      }
    })();
    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="student-camera-overlay" />
        <Dialog.Content className="student-camera-modal">
          <Dialog.Title>Take a profile photo</Dialog.Title>
          <Dialog.Description>
            Your camera is used only for this photo. You can crop it before
            saving.
          </Dialog.Description>
          <Dialog.Close
            className="student-modal-close"
            aria-label="Close camera"
          >
            <X size={20} />
          </Dialog.Close>
          <video
            ref={video}
            muted
            playsInline
            className="student-camera-video"
            aria-label="Camera preview"
          />
          {error && (
            <p role="alert" className="student-error">
              {error}
            </p>
          )}
          <div className="student-actions">
            <Dialog.Close className="campus-secondary">
              Cancel camera
            </Dialog.Close>
            <button
              type="button"
              className="campus-primary"
              disabled={!ready}
              onClick={() => {
                const source = video.current;
                if (!source?.videoWidth) return;
                const canvas = document.createElement("canvas");
                canvas.width = source.videoWidth;
                canvas.height = source.videoHeight;
                canvas.getContext("2d")!.drawImage(source, 0, 0);
                canvas.toBlob((blob) => {
                  if (blob) {
                    onCapture(
                      new File([blob], "camera-photo.png", {
                        type: "image/png",
                      }),
                    );
                    onClose();
                  } else
                    setError("The photo could not be captured. Try again.");
                }, "image/png");
              }}
            >
              Capture photo
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ProfilePhotoUploader({
  photo,
  avatar,
  onChange,
  disabled,
  onPendingChange,
}: {
  photo: Blob | null;
  avatar: Character;
  onChange: (photo: Blob | null) => void;
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  const url = usePhotoUrl(photo);
  const [pending, setPending] = useState<Blob | null>(null);
  const [camera, setCamera] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    onPendingChange(Boolean(pending) || processing || camera);
  }, [pending, processing, camera, onPendingChange]);
  const select = async (file: File) => {
    setProcessing(true);
    setError("");
    try {
      const prepared = await preparePhoto(file);
      if (alive.current) setPending(prepared);
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Your photo could not be opened.",
        );
    } finally {
      if (alive.current) setProcessing(false);
    }
  };
  return (
    <section
      className="profile-photo-uploader"
      aria-label="Profile picture settings"
    >
      <h4>Profile picture</h4>
      {pending ? (
        <ProfilePhotoCropper
          photo={pending}
          onCancel={() => setPending(null)}
          onSave={(blob) => {
            onChange(blob);
            setPending(null);
          }}
        />
      ) : (
        <>
          <div className="photo-upload-preview">
            {url ? (
              <img src={url} alt="Your selected profile photo" />
            ) : (
              <CharacterPortrait avatar={avatar} />
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Upload profile photo"
            disabled={disabled || processing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void select(file);
            }}
          />
          <div className="student-photo-buttons">
            <button
              type="button"
              className="campus-secondary"
              disabled={disabled || processing}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={15} />
              {photo ? "Change photo" : "Upload photo"}
            </button>
            <button
              type="button"
              className="campus-secondary"
              disabled={disabled || processing}
              onClick={() => setCamera(true)}
            >
              <Camera size={15} />
              Take photo
            </button>
            {photo && (
              <>
                <button
                  type="button"
                  className="campus-secondary"
                  disabled={disabled || processing}
                  onClick={() => setPending(photo)}
                >
                  <Crop size={15} />
                  Crop photo
                </button>
                <AlertDialog.Root>
                  <AlertDialog.Trigger asChild>
                    <button
                      type="button"
                      className="campus-secondary"
                      disabled={disabled || processing}
                    >
                      <Trash2 size={15} />
                      Remove photo
                    </button>
                  </AlertDialog.Trigger>
                  <AlertDialog.Portal>
                    <AlertDialog.Overlay className="student-camera-overlay" />
                    <AlertDialog.Content className="student-confirm-modal">
                      <AlertDialog.Title>
                        Remove your profile photo?
                      </AlertDialog.Title>
                      <AlertDialog.Description>
                        The default character portrait will return. Choose Save
                        Changes in the editor to delete the saved photo, or
                        Cancel to keep it.
                      </AlertDialog.Description>
                      <div className="student-actions">
                        <AlertDialog.Cancel className="campus-secondary">
                          Keep photo
                        </AlertDialog.Cancel>
                        <AlertDialog.Action
                          className="campus-primary"
                          onClick={() => onChange(null)}
                        >
                          Remove from profile
                        </AlertDialog.Action>
                      </div>
                    </AlertDialog.Content>
                  </AlertDialog.Portal>
                </AlertDialog.Root>
              </>
            )}
          </div>
        </>
      )}
      {processing && <p role="status">Preparing photo…</p>}
      {error && (
        <p role="alert" className="student-error">
          {error}
        </p>
      )}
      <p className="student-help">
        JPG, PNG or WebP · Up to 15 MB. Large photos are resized automatically.
        Your photo never changes your walking character.
      </p>
      {camera && (
        <ProfileCamera
          onClose={() => setCamera(false)}
          onCapture={(file) => void select(file)}
        />
      )}
    </section>
  );
}
