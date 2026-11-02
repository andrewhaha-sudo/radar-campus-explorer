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

`node --test tests/location-sync.test.mjs` passed, including fresh, holding, and hidden fix timing. `npx tsc -b` passed. Playwright for the demo location save and the campus shell is recorded with the commit that adds the listen loop.
