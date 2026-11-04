import { useState } from "react";
import { portalOrigin, pathfinderRevision } from "../../lib/pathfinder";
export function PathfinderPortal() {
  const configuredOrigin = portalOrigin(import.meta.env.VITE_PATHFINDER_URL ?? "");
  const [legacyOrigin] = useState(() => {
    try { return portalOrigin(localStorage.getItem("campus-pathfinder-origin") ?? "") ?? portalOrigin(import.meta.env.VITE_PATHFINDER_URL ?? ""); }
    catch { return portalOrigin(import.meta.env.VITE_PATHFINDER_URL ?? ""); }
  });
  return <section aria-label="Pathfinder facility portal">
    <h3>Shared Facilities workspace</h3>
    <p>Use the integrated Pathfinder workspace for shared floorplans, safety markers, PDF exports, scans, project review, collaboration and audit records.</p>
    <div className="preparedness-actions">
      <a className="game-nav-button" href={configuredOrigin ?? "/campus-workspace"}>Open Pathfinder</a>
      <a href="/indoor-map/">Indoor Map</a>
      <a href="/source/radar-campus-explorer.tar.gz">Download application source</a>
    </div>
    <p>Facilities uses its own staff login. Student profiles, private GPS and school preparedness records remain separate. Device floorplan drafts can be published to Facilities without replacing shared documents.</p>
    {legacyOrigin && legacyOrigin !== configuredOrigin && <details><summary>Previously configured companion deployment</summary>
      <p>Your saved deployment remains available. Opening it does not copy student data or change its facility records.</p>
      <a href={legacyOrigin} target="_blank" rel="noopener noreferrer">Open existing companion</a>
    </details>}
    <p>The optional Docker companion runs the same repository source at port 8082 with private initial credentials and a persistent volume. See the setup documentation.</p>
    <p>Pathfinder is licensed under AGPL-3.0-or-later. <a href={`https://github.com/melonmelonz/pathfinder/tree/${pathfinderRevision}`} target="_blank" rel="noreferrer">Upstream source and license</a></p>
  </section>;
}
