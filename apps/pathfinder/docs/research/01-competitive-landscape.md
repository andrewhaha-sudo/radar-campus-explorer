# Research Brief — Competitive Landscape

*School & critical-incident emergency mapping platforms. Prepared June 2026 to inform the Pathfinder portal product spec.*

## 1. Per-product capability table

| Product | What it does | Floorplans / maps | 3D / photo / scan | Mobile & first-responder access | 911 / CAD / PSAP integration | Standout differentiator |
|---|---|---|---|---|---|---|
| **CRG (Collaborative Response Graphics)** | Field-verified critical-incident mapping data; the de-facto map-data standard | Gridded, north-oriented floor + aerial overlays; printable; "Micro CRGs" per floor | On-site walkthroughs verify reality vs. CAD; high-res imagery | CRG Portal (edit/share/download); free first-responder access | Pushes maps to PSAPs via RapidSOS; integrates into 3rd-party platforms | 20,000+ schools mapped; field-verified accuracy; statewide contracts (SC = 1,200+ schools). New Map Builder for everyday use |
| **Navigate360** | Full EM ecosystem (EOPs, drills, Rapid Alarm, Roll Call, reunification) | Interactive room-level maps + aerial; uploadable, unlimited storage | 360-degree imaging of every room/hall/stairwell linked to floorplan | Any device; maps + EOPs + call lists to responders | Panic alerts; partners with CRG for map data | Broadest platform; SIS-integrated Roll Call; Alyssa's Law silent alerting |
| **Raptor Technologies** | Integrated suite: visitor mgmt + EM + reunification | Dynamic floor-level maps showing alert origin | Via CRG partnership (US-produced indoor maps) | Raptor Alert app + LoRa Badge Alert wearable with floor-level location | Direct to closest PSAP; rich data (CRG maps + SIS) via RapidSOS | 60,000+ schools; visitor screening (sex-offender DB) tied to reunification accounting |
| **911inform** | Browser-based connected-building emergency response | Interactive indoor mapping in alerts | — (focus is building systems) | Browser; no app needed | Geofenced 911-call detection -> PSAP via RapidSOS (CAD/CPE/Map) | Connected-building controls: remote door locks, live camera feeds, paging, intercom |
| **RapidSOS** | NG911 data clearinghouse (LIS + ADR), not an end-user mapping tool | Supplies location/data into PSAP map software | Ingests partner data (incl. floorplans) | — (infrastructure layer) | The integration backbone: 1,000+ PSAPs; pushes to CAD/CPE/mapping; 600M+ devices | Industry standard pipe everyone integrates through |
| **Rave Mobile Safety (Motorola)** | Panic button + Smart911 profiles + Rave Facility | Geo-referenced floor plans, evac routes | — (data profiles, not scans) | Rave Panic Button app; First Responder View (any browser) | Deep: VESTA 911, CommandCentral Aware; Smart911 to call-takers | Smart911 Facility profiles (AEDs, utility shutoffs, hazmat) auto-display on 911 call |
| **Intrado / West** | Safety Suite: notifications, visitor mgmt, reunification, panic | Digitize & share floorplans, SOPs, ERP checklists | — | Wearable/mobile/desktop/mounted panic buttons | Market leader in 911 routing; Spatial Insight PSAP map UI | Deepest native E911/PSAP pedigree; Kari's Law dial monitoring |
| **NaviGate Prepared (now Navigate360)** | EOP authoring, drill logging, digital flip charts | Interactive critical-incident maps, room-level | — | App with offline flip charts + SIS rosters | Maps to responders | Digital FlipCharts (offline) + Safety Plan Wizard |
| **Singlewire InformaCast** | Mass notification across all endpoints | Interactive scenario maps | — | Notifications to any device | RapidDeploy + RapidSOS integrations | Notification reach/legacy-device integration |
| **Matterport / 3D scan vendors** | 3D digital twins for preplan + dual-use marketing tours | Point clouds -> DWG/DXF, E57/RCP/LAS | Core competency: true spatial geometry | Navigable walkthroughs for responder familiarization | Deliverables in CAD/911-compatible formats | Actual measurable spatial data; dual-purpose (safety + marketing) |

## 2. Table-stakes features

- Floorplan upload + room-level annotation with standard safety markers (AED, exits, stairs, fire extinguishers, doors, utility shutoffs).
- North-oriented, printable maps (NFPA/CRG convention; hard copies must survive a network outage).
- Field-verified accuracy — buyers now distrust raw CAD/scanned plans; on-site walkthrough verification is the expectation CRG set.
- Mobile + any-browser first-responder access, free to responders.
- RapidSOS pipe to the PSAP — the universal integration; absence is disqualifying for the 911 buyer.
- Centralized portal to edit, version, share, distribute maps; layer toggling per audience.
- Alyssa's/Kari's/RAY BAUM'S Act compliance posture + SIS integration (table-stakes for the *school* buyer).
- Drill logging + EOP storage as adjacent expectations.

## 3. Differentiator / gap opportunities

- **3D scan as the primary artifact, not an afterthought.** Incumbents do 360-photo (Navigate360) or verified 2D + aerial (CRG). Almost none make a *true spatial 3D digital twin* the core deliverable that also exports CAD/911 formats. Texas HB3 and FL §1013.13 (tri-annual responder tours) pull demand toward exactly this.
- **The incumbents are heavy platforms; Pathfinder can be the sharp map shop.** A focused "best floorplan + scan + NFPA export portal" that *integrates with* (not competes against) their alerting layer is a wedge.
- **Dual-use ROI story.** One 3D scan serves safety documentation *and* enrollment/facilities/insurance — a budget-justification angle.
- **Self-serve everyday editing.** A genuinely good in-portal editor (layer toggles, collaborative annotation, version history) is still differentiated.
- **Markets beyond K-12.** 911 centers, universities, government, healthcare are underserved by K-12-centric incumbents.

## 4. Concrete feature recommendations

1. Layered map model with per-audience toggles (responder / staff / facilities views).
2. NFPA-style export engine: north-locked, gridded, printable PDFs with a vertical legend.
3. Embed the 3D/scan layer: link walkthroughs to floorplan markers; offer CAD/911-format export as a paid deliverable.
4. RapidSOS partner integration posture so maps can surface in the PSAP.
5. Field-verification workflow: capture date, surveyor, walkthrough photos per marker.
6. Collaborative annotation + version history + role-based access.
7. Compliance metadata fields (Alyssa's/Kari's/HB3, last-toured date, drill links).
8. Integration posture, not walled garden: open API / export.

## Sources

- https://www.crgplans.com/collaborative-response-graphics/
- https://navigate360.com/solutions/site-mapping/
- https://raptortech.com/
- https://inform.911inform.com/our-product/
- https://rapidsos.com/software-integrations/
- https://www.ravemobilesafety.com/products/rave-panic-button/
- https://intrado.com/safetysuiteforeducation
- https://www.singlewire.com/informacast-k12-education
- https://www.thefuture3d.com/answers/school-3d-scanning-safety-planning/
