# Preparedness learning inspired by ResQverse

Open **Resources** in the standalone explorer's bottom navigation to practice:

- Earthquake, flood, and fire quizzes: three questions each, immediate explanations,
  saved best scores, and a badge for answering all questions correctly.
- A six-step supervised-drill checklist with self-reported completion.
- A downloadable JSON practice record and a confirmed reset action.

Best quiz answers earn ten points each; checklist items earn five. The maximum is
120 points. Retrying a quiz never adds duplicate points or lowers a previous best
score. Badges indicate quiz practice, not certification or emergency readiness.
Unchecking a checklist item removes its points.

## Integration boundary

ResQverse was reviewed at commit
`bfb50406630450d8a9df345e1be0d976a7293550` in
https://github.com/Prasi24bms017/resqverse-ready. Its current default branch has no
reuse license. This implementation uses original RADAR code, questions and styling;
**no ResQverse source, assets, Firebase configuration or quiz text was copied**.
ResQverse is the feature reference, not an installed dependency or linked service.

Its gamified learning and drill concepts informed this module. Hard-coded IMD/NDMA
alert examples, automatic GPS sharing, donation/payment flows, and unverified SOS
or teacher-broadcast actions were not imported. Official source links accompany
the learning material; they are not claimed to be live data feeds. The existing
LifeRouter simulation and campus room navigation remain separate features.

## Storage and accounts

Progress uses `campus-preparedness-v1:<profile>` in browser local storage. Signed-in
profiles use their existing standalone account ID; signed-out practice uses a
separate device key. Changing profiles remounts the learning view. Data is not
uploaded to Supabase, shared with teachers, or sent to any external API. Browser
storage is not encrypted and is accessible to someone with access to that browser
profile. Private mode or clearing site data can remove progress.

If storage fails, the module explains that progress is available only for the
current session. Invalid saved records are rejected; unknown quiz/checklist IDs,
invalid scores and duplicate checklist entries are ignored. Downloads exclude
account IDs, names and locations. They explicitly identify the record as
self-reported practice rather than a verified attendance record.

Shared teacher reports, school-managed drill schedules and alerts would need
separate authenticated backend features and access policies. They are not part
of this local learning module.

## Run and check

No new service, secret, package or migration is required:

```sh
npm ci
npm run dev
```

For a deployed static site, pull and rebuild normally. LifeRouter's backend is
needed only when using its routing engine, not for preparedness quizzes.

```sh
npm run lint
npm run build
npm test
npm run test:e2e -- tests/browser/preparedness.spec.ts tests/browser/dashboard.spec.ts
```

Logic tests cover best-score updates, duplicate-point prevention, malformed data
and export fields. Desktop/mobile browser tests cover quiz progression, persistence,
checklist export, confirmed reset, failed storage writes and dashboard navigation.
