# RADAR test results

Date: 2 November 2026. Commands used Node 24.22.2.

## `npx tsc -b`

Passed. No type errors.

## `node --test tests/radar-route.test.mjs tests/radar-records.test.mjs`

Passed. 8 tests, 0 failed. Covered hash parsing, rejected hazards hidden from a building, hazard review, alerts, SOS, inspections, stamps, people, stock, and shaking with no route.

## `npm run build`

Passed. Vite client build completed.

## `npx playwright test tests/browser/campus.spec.ts --grep "opens directly"`

Passed. 2 tests, desktop and mobile. The campus still opens at `/` with no login.

## `npx playwright test tests/browser/location.spec.ts --grep "section address|selecting Building B"`

Passed. 4 tests, desktop and mobile. `#safety` remains after reload. Building B shows its illustrated rooms and “No hazard reports for this building.”

## Not run this session

The full Playwright file and `npm test` of every unit file. Earlier sessions ran those suites when those areas changed. This session did not re-run them after the hash and hazard-panel edits.

## Radar-2 shell, same date

`npx tsc -b` passed. `node --test` on radar records, routes, location sync, and campus navigation passed: 28 tests, 0 failed.

`npm run build` passed.

Playwright, desktop and mobile:

- campus “opens directly” and “keyboard and direction”
- campus “radar shell sits on the illustrated campus” (header, Where to?, classrooms, How to play, assembly polyline)
- location “section address”, “Google Map”, “selecting Building B”, and “saving the current location”

All of those passed. The full browser folder was not re-run.

## Lodestar listen loop, same date

`node --test tests/location-sync.test.mjs` passed, including fresh, holding, and hidden fix timing. `npx tsc -b` and `npm run build` passed.

Playwright, desktop and mobile, passed for a calibrated walk, a low-accuracy fix that does not move the character, demo location save, and the radar shell.

## GPS-Case noise gate, same date

`node --test tests/location-sync.test.mjs tests/campus-navigation.test.mjs` passed, including the 3 m noise gate. `npm run build` passed. Playwright desktop and mobile passed for calibration required with no movement, a calibrated walk to Building A, a coarse fix that stays put, and a 15 m demo step.

## Tighter follow, same date

The noise floor now scales with accuracy, from 1.2 m to 8 m. A 2.5 m step on a 5 m fix is accepted. Paths are shortened and open ground is crossed directly. The calibrated walk reached Building A in about 4 seconds. The same Playwright GPS checks passed on desktop and mobile.
