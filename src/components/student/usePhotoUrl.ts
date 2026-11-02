import { useEffect, useState } from "react";

export function usePhotoUrl(blob: Blob | null) {
  const [resource, setResource] = useState<{ blob: Blob; url: string } | null>(
    null,
  );
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    // The URL is a browser resource created after commit and released on cleanup.
    // oxlint-disable-next-line react/set-state-in-effect
    setResource({ blob, url: next });
    return () => {
      URL.revokeObjectURL(next);
    };
  }, [blob]);
  return blob && resource?.blob === blob ? resource.url : null;
}
