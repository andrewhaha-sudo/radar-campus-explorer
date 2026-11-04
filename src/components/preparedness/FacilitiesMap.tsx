import { useEffect, useRef, useState } from "react";
import {
  nearbyFacilities,
  validCoordinates,
} from "../../lib/nearby-facilities";
import type { Facility } from "../../lib/nearby-facilities";
import "leaflet/dist/leaflet.css";
import { schoolRows } from "../../lib/school-services";
import type { SchoolRow } from "../../lib/school-services";
import { useStudentProfile } from "../student/student-context";
export function FacilitiesMap() {
  const { user } = useStudentProfile();
  const [zones, setZones] = useState<SchoolRow[]>([]);
  const [zoneNotice, setZoneNotice] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [result, setResult] = useState<{
    lat: number;
    lon: number;
    places: Facility[];
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const request = useRef<AbortController | null>(null);
  const mapElement = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!zones.length) return;
    const earliest = Math.min(...zones.map(zone => Date.parse(zone.expires_at)));
    const timeout = setTimeout(() => {
      const now = Date.now();
      setZones(current => current.filter(zone => Date.parse(zone.expires_at) > now));
    }, Math.max(0, Math.min(earliest - Date.now() + 20, 2_147_483_647)));
    return () => clearTimeout(timeout);
  }, [zones]);
  useEffect(() => {
    if (!result || !mapElement.current) return;
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    void import("leaflet")
      .then((L) => {
        if (disposed || !mapElement.current) return;
        map = L.map(mapElement.current).setView([result.lat, result.lon], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        }).addTo(map);
        L.circleMarker([result.lat, result.lon], {
          radius: 7,
          color: "#ffd84a",
        })
          .addTo(map)
          .bindTooltip("Search area");
        for (const zone of zones) {
          if (
            Date.parse(zone.expires_at) <= Date.now() ||
            Math.abs(zone.lat - result.lat) > 0.1 ||
            Math.abs(zone.lon - result.lon) > 0.1
          )
            continue;
          const text = document.createElement("span");
          text.textContent = `School-reported ${zone.kind}: ${zone.label}. Expires ${new Date(zone.expires_at).toLocaleString()}`;
          L.circle([zone.lat, zone.lon], {
            radius: zone.radius,
            color: zone.kind === "hazard" ? "#d52e44" : "#16874b",
          })
            .addTo(map)
            .bindPopup(text);
        }
        for (const place of result.places) {
          const text = document.createElement("span");
          text.textContent = `${place.name} (${place.kind.replaceAll("_", " ")})`;
          L.circleMarker([place.lat, place.lon], {
            radius: 7,
            color: "#2bd5ff",
          })
            .addTo(map)
            .bindPopup(text);
        }
      })
      .catch(() => {
        if (!disposed)
          setError(
            "The map could not load. Facilities remain available in the list.",
          );
      });
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [result, zones]);
  return (
    <section aria-label="Nearby facilities">
      <h3>Geographic facilities map</h3>
      <p>
        This is separate from the illustrated campus. Search a chosen area for
        mapped hospitals, police, fire stations and schools. A mapped school is
        not a verified shelter.
      </p>
      <p>
        Searching sends the chosen coordinates to OpenStreetMap/Overpass and
        loads external map tiles. Coordinates are not saved or shared with other
        students.
      </p>
      <form
        className="school-form preparedness-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const y = Number(lat),
            x = Number(lon);
          if (!lat.trim() || !lon.trim() || !validCoordinates(y, x)) {
            setError("Enter valid latitude and longitude.");
            return;
          }
          request.current?.abort();
          const controller = new AbortController();
          request.current = controller;
          setBusy(true);
          setError("");
          setResult(null);
          setZones([]);
          setZoneNotice("");
          try {
            const places = await nearbyFacilities(y, x, controller.signal);
            if (!controller.signal.aborted) {
              setResult({ lat: y, lon: x, places });
              if (user) {
                try {
                  const rows = await schoolRows("geo_zones");
                  if (!controller.signal.aborted) setZones(rows);
                } catch {
                  if (!controller.signal.aborted)
                    setZoneNotice(
                      "School map notices are unavailable. The facilities list is not a safety assessment.",
                    );
                }
              }
            }
          } catch (cause) {
            if (!controller.signal.aborted)
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Facilities search failed.",
              );
          } finally {
            if (alive.current && !controller.signal.aborted) setBusy(false);
          }
        }}
      >
        <label>
          Search latitude
          <input
            required
            inputMode="decimal"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
          />
        </label>
        <label>
          Search longitude
          <input
            required
            inputMode="decimal"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
          />
        </label>
        <div className="preparedness-actions">
          <button className="game-nav-button" disabled={busy}>
            Search mapped facilities
          </button>
          <button
            type="button"
            className="campus-secondary"
            disabled={locating}
            onClick={() => {
              if (!navigator.geolocation) {
                setError(
                  "Device location is unavailable. Enter an area manually.",
                );
                return;
              }
              setLocating(true);
              setError("");
              navigator.geolocation.getCurrentPosition(
                (p) => {
                  if (!alive.current) return;
                  setLat(String(p.coords.latitude));
                  setLon(String(p.coords.longitude));
                  setLocating(false);
                },
                () => {
                  if (!alive.current) return;
                  setError(
                    "Location could not be obtained. Enter an area manually.",
                  );
                  setLocating(false);
                },
                { timeout: 10000, maximumAge: 0 },
              );
            }}
          >
            Use device coordinates
          </button>
        </div>
        <p>
          Device coordinates only fill the fields. Press Search to send them to
          the map provider.
        </p>
      </form>
      {busy && <p role="status">Searching the chosen area…</p>}
      {error && <p role="alert">{error}</p>}
      {zoneNotice && <p role="status">{zoneNotice}</p>}
      {result && (
        <>
          <div
            className="facilities-map"
            ref={mapElement}
            aria-label="OpenStreetMap facilities map"
          />
          <p>
            Red areas: school-reported hazards. Green areas: school-reported
            assembly sites. Verify current conditions with staff.
          </p>
          <p>
            {result.places.length} mapped facilities found. Availability, access
            and opening hours are unverified.
          </p>
          <ul className="facilities-list">
            {result.places.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong> · {p.kind.replaceAll("_", " ")}{" "}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open directions ↗
                </a>
              </li>
            ))}
          </ul>
          <p>
            External directions are ordinary travel directions, not hazard-aware
            evacuation routes.
          </p>
        </>
      )}
    </section>
  );
}
