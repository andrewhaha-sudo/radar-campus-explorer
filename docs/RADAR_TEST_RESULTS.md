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
