# Research Brief — Compliance & Standards

*Standards, compliance, and legal mandates for an emergency safety-mapping portal serving US schools, 911 centers, universities, government, and healthcare. Prepared June 2026.*

## 1. Standard / mandate summaries

**NFPA 170 — Fire Safety and Emergency Symbols (2021 ed.).** The standardized, language-independent symbol catalog for safety maps, evacuation plans, and pre-incident diagrams: emergency/accessible exits and "Not an Exit," assembly/refuge/severe-weather shelter points, fire equipment (extinguishers, hose, sprinklers, FDC), electrical/gas shutoffs, directional arrows, and special-occupancy icons. Symbols must be understood by responders, staff, and the public regardless of reading level or language.

**NFPA 3000 — ASHER Program (2024 ed.).** Whole-community standard for active shooter / hostile event response: hazard identification, vulnerability assessment, planning, incident command, responder competencies, recovery. Applies to schools, hospitals, universities, government, business. Pre-incident planning and information-sharing (facility maps/floor plans for responders) sit within its planning and risk-assessment provisions.

**Alyssa's Law.** Enacted in ~16 states (NJ, FL, NY, TX, TN, UT, VA, OK, GA, LA, MD, OR, PA, WA, WV, plus IL's Jan 2026 Mobile Panic Alert Act), mandating silent panic alarms that route directly to the PSAP. Georgia's "Ricky and Alyssa's Law" (HB 268) explicitly requires accurate, up-to-date facility maps alongside panic technology — signaling a national trend toward mandated digital floorplan/mapping data for schools.

**NG911 / NENA standards.** NENA-STA-006 (NG9-1-1 GIS Data Model) defines GIS layers — site/structure address points, road centerlines, service boundaries — used to validate and route 911 calls. NENA-REQ-003 (3D GIS) defines z-axis/vertical location: floor-level "dispatchable location," vertical structure modeling, uncertainty/confidence. These define how floor-labeled indoor data should feed PSAPs.

**FERPA & data security.** FERPA (20 U.S.C. §1232g; 34 CFR Part 99) covers student records — facility maps are usually not education records, but a vendor handling district data is typically engaged under the "school official" exception (§99.31), requiring signed data-handling agreements, redisclosure restrictions, breach notification, and data-deletion terms. Expected controls: encryption in transit (TLS 1.2+) and at rest (AES-256), RBAC, MFA, exportable audit logs, U.S. data residency, SOC 2 Type II. Facility safety maps are "sensitive but unclassified" — a blueprint of exits, shutoffs, and chokepoints is itself a security risk if leaked, so tighter-than-FERPA controls are warranted.

**Accessibility (Section 508 / WCAG / ADA Title II).** Section 508 sets the federal floor at WCAG 2.0 AA; vendors must supply a VPAT/ACR. DOJ's 2024 ADA Title II rule requires state/local government and public-school sites/apps to meet WCAG 2.1 AA by April 24, 2026. Practical target: WCAG 2.1 AA minimum, 2.2 AA forward-looking.

## 2. Requirements implications -> concrete portal features

- **NFPA 170 symbol set:** built-in NFPA 170-compliant symbol/legend library; auto-generated standardized legend per map; locked symbol semantics (place from catalog, not freehand).
- **NFPA 3000 pre-incident planning:** responder-facing map outputs (room labels, ingress/egress, staging, command points, hazards); versioned plans; secure responder sharing.
- **Alyssa's Law / mapping mandate:** treat "accurate, current facility maps" as a product promise — versioning, last-reviewed-date metadata, re-verification reminders, per-state export profiles; panic-alarm/PSAP integration posture.
- **NG911 / NENA:** export in NENA-aligned GIS formats (GeoJSON to STA-006 schema); attach z-axis/floor labels to every structure and point (REQ-003 dispatchable location); confidence/uncertainty field; CLDXF-US civic addressing.
- **FERPA / data security:** RBAC, MFA/SSO, AES-256 at rest + TLS 1.2+, immutable exportable audit logs (who viewed/edited/exported which map, when), U.S. data residency option, signed DPA template, data-deletion/retention controls, breach notification; pursue SOC 2 Type II / GovRAMP.
- **Accessibility:** WCAG 2.1 AA (target 2.2 AA); maintained VPAT/ACR; accessible non-visual map alternatives (text room/exit lists, keyboard-navigable controls, contrast, screen-reader labels on symbols and exports).

## 3. Compliance risks if ignored

Ignoring NFPA 170/3000 yields maps responders cannot trust under stress. Skipping NENA z-axis/GIS conformance makes data unusable to NG911 PSAPs, killing core integration value. Missing Alyssa's Law mapping features forecloses the fastest-growing, legally-driven school market. Weak data security/audit logging risks a breach exposing sensitive building vulnerabilities and FERPA exposure. Failing WCAG 2.1 AA triggers bid disqualification and ADA Title II / OCR liability (post-April 2026). For gov/edu buyers, any one gap is commonly a procurement-disqualifying defect.

## Sources

- https://www.nfpa.org/product/nfpa-170-standard/p0170code
- https://www.safetysign.com/what-is-nfpa-170
- https://legalclarity.org/nfpa-3000-active-shooter-and-hostile-event-response-standard/
- https://www.centegix.com/alyssaslaw/
- https://getsafeandsound.com/blog/alyssas-law/
- https://cdn.ymaws.com/www.nena.org/resource/resmgr/standards/nena-sta-006.2-2022_ng9-1-1_.pdf
- https://cdn.ymaws.com/www.nena.org/resource/resmgr/standards/nena-req-003.1-2022_3d_gis_2.pdf
- https://github.com/NENA911/NG911GISDataModel
- https://www.upguard.com/blog/ferpa-compliance-guide
- https://www.section508.gov/event/best-practices-webinar-jul2024/
- https://userway.org/compliance/508/
- https://www.audioeye.com/post/ada-section-508-and-wcag/
