import { useEffect, useRef, useState } from "react";
import { places } from "./campus-data";
import { googleMapView } from "../../lib/google-map";
import {
  pixelToGeographic,
  type MapCalibration,
} from "../../lib/map-calibration";

interface MapsNamespace {
  maps: {
    Map: new (
      element: HTMLElement,
      options: {
        center: { lat: number; lng: number };
        zoom: number;
        mapTypeControl: boolean;
        streetViewControl: boolean;
        gestureHandling: string;
      },
    ) => { setCenter: (position: { lat: number; lng: number }) => void };
    Marker: new (options: {
      position: { lat: number; lng: number };
      map: object;
      title: string;
    }) => void;
  };
}

declare global {
  interface Window {
    google?: MapsNamespace;
  }
}

let mapsLoader: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (!mapsLoader) {
    mapsLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        mapsLoader = null;
        reject(new Error("Google Maps failed to load."));
      };
      document.head.appendChild(script);
    });
  }
  return mapsLoader;
}

function buildingMarkers(calibration: MapCalibration) {
  return places.flatMap((place) => {
    const geographic = pixelToGeographic(
      {
        x: place.bounds.x + place.bounds.width / 2,
        y: place.bounds.y + place.bounds.height / 2,
      },
      calibration,
    );
    if (!geographic.ok) return [];
    return [
      {
        name: place.name,
        latitude: geographic.latitude,
        longitude: geographic.longitude,
      },
    ];
  });
}

export function GoogleCampusMap({
  apiKey,
  latitude,
  longitude,
  calibration,
}: {
  apiKey: string;
  latitude: number | null;
  longitude: number | null;
  calibration: MapCalibration;
}) {
  const view = googleMapView({ apiKey, latitude, longitude });
  const canvas = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState("");
  const demoPlacement = calibration.demo === true;
  useEffect(() => {
    if (view.mode !== "map" || latitude === null || longitude === null) return;
    let cancelled = false;
    const markers = buildingMarkers(calibration);
    setLoadError("");
    loadGoogleMaps(apiKey)
      .then(() => {
        const maps = window.google?.maps;
        const element = canvas.current;
        if (cancelled || !maps || !element) return;
        const map = new maps.Map(element, {
          center: { lat: latitude, lng: longitude },
          zoom: 18,
          mapTypeControl: true,
          streetViewControl: false,
          gestureHandling: "greedy",
        });
        new maps.Marker({
          position: { lat: latitude, lng: longitude },
          map,
          title: "This device",
        });
        for (const marker of markers) {
          new maps.Marker({
            position: { lat: marker.latitude, lng: marker.longitude },
            map,
            title: demoPlacement
              ? `${marker.name} (DEMO placement)`
              : marker.name,
          });
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setLoadError(
            cause instanceof Error
              ? cause.message
              : "Google Maps failed to load.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, calibration, demoPlacement, latitude, longitude, view.mode]);
  if (view.mode === "needs_location") {
    return (
      <div className="campus-google-map campus-google-map--notice">
        <strong>Google Maps needs a device location</strong>
        <p>
          The school’s coordinates are not included. Choose Save my location or
          enable GPS on the outdoor campus, then open Google Maps again.
        </p>
      </div>
    );
  }
  if (view.mode === "not_configured") {
    return (
      <div className="campus-google-map campus-google-map--notice">
        <strong>Google Maps API key is not configured</strong>
        <p>
          The campus illustration still works. To show the interactive Google
          Map in this app, set <code>VITE_GOOGLE_MAPS_API_KEY</code> to a
          browser key restricted to this site, then rebuild. No key is stored
          in the repository.
        </p>
        {view.openUrl && (
          <a className="campus-primary" href={view.openUrl} target="_blank" rel="noreferrer">
            Open this device location in Google Maps
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="campus-google-map">
      <div ref={canvas} className="campus-google-map-canvas" />
      {loadError && (
        <p className="student-error" role="alert">
          {loadError}
        </p>
      )}
      {demoPlacement && (
        <p className="campus-small">
          Building pins use the DEMO calibration. They are not a surveyed
          campus placement.
        </p>
      )}
    </div>
  );
}
