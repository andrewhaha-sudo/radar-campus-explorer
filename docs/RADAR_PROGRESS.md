# RADAR progress

Updated: 2 November 2026.

## Completed and tested

- Illustrated campus, collision, stairs, room list, stamps.
- Outdoor GPS follow and calibration. Coarse fixes over 65 meters do not move the character.
- Google Map view gated on an API key.
- Device hazard, inspection, alert, safety, SOS, people, resource, and report flows.
- Hash routing for the section bar.
- Building panel lists that building’s non-rejected hazard reports.

## Active module

Module 3, GIS hazard mapping. The device report is connected to the building. It is not a verified spatial layer.

## Unfinished

- School-verified hazards and map geometry.
- Verified evacuation graph and closures.
- School accounts, six roles, and guardian authorization.
- Camera QR scanning. Typed room codes work.
- Official weather, earthquake, SMS, and push providers.

## Failed tests

None recorded in this session’s targeted run. See `docs/RADAR_TEST_RESULTS.md`.

## Known bugs

- A stamp is saved when a place is chosen, before the character finishes walking there.
- Demo calibration assumes north is up and about 8 pixels per meter.

## Blocked integrations

- `VITE_GOOGLE_MAPS_API_KEY` for interactive Google tiles.
- Supabase student project SQL for online accounts.
- PAGASA, PHIVOLCS, Twilio, web push, and a vision model. No endpoints were invented.

## Next task

Add a verified-hazard record only after school locations exist. Until then, do not promote a DEMO report to verified.
