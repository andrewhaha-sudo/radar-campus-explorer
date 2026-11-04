# Expanded preparedness suite

The standalone RADAR explorer now includes original implementations of the major
ResQverse application areas. Open **Resources** to switch between Learn, Children,
Records, School, Nearby facilities, Community, Help and Admin. Alerts, Report
Hazard and Emergency also open the relevant school tools. The campus artwork,
rooms/photos, student accounts, private GPS controls and LifeRouter remain in place.

## What is available

| Area | Implementation | Activation |
|---|---|---|
| Learning | Earthquake, flood and fire quizzes; explanations; best-score badges; supervised checklist; download/reset | Works locally |
| Children | Matching game, three-stage classroom scenario, original safety verses, persistent activity badges | Works locally |
| Records | Local practice summary; explicit sharing/revocation of scores with school staff; transfer receipt history | Local summary works now; sharing needs migration |
| Teacher | Publish/archive school notices; schedule/cancel drills; view self-reported participation; review help/hazard reports; shared practice ranking | Migration + teacher grant |
| Geographic map | Leaflet/OSM map, Overpass facilities search, external directions, expiring school-reported hazard/assembly areas | Public search needs internet; school areas need migration |
| Community | Requests/offers awaiting staff moderation; campaign list; wallet review links; verified native SOL receipts | Migration; campaigns require verified recipient; receipt function deployment |
| Help | Configured click-to-call school contact; authenticated school help requests with manually supplied location | Migration + verified contact |
| Admin | Account-ID roster, staff grants/revocation, school contact, campaigns, verified transfer receipts, administrative audit | Migration + first admin bootstrapped by project owner |

School rankings are **campus practice rankings**, based only on voluntarily shared,
self-reported records. There is no invented district leaderboard or cross-school
data. Drill scheduling can describe joint activities, but access is for this single
campus. Parent accounts can use learning, maps, community and their own records;
there is no implicit access to a child's private profile. Profile role labels do not
grant database permissions.

Government disaster feeds, responder dispatch, push/SMS delivery, verified physical
shelters and calibrated emergency routes are not supplied by ResQverse's hard-coded
demo alerts and are not fabricated here. School notices require Refresh; they are
not guaranteed emergency delivery. A school help request is not emergency dispatch.

## Activate the shared services

Use the **separate explorer Supabase project**, not the original RADAR database.
No private key is needed in frontend configuration.

1. Apply `supabase/migrations/202611020001_student_profiles.sql` if the existing
   account/profile tables have not already been created.
2. Review and run `supabase/migrations/202611040001_preparedness_school.sql` once in
   the project's SQL Editor. It creates the new tables, RLS policies, audit triggers
   and permission helpers. Do not rerun it on an already migrated database.
3. Sign in to the explorer with the intended owner account. In Supabase Authentication
   → Users, copy that account's UUID. As the database owner, run this SQL with the
   placeholder replaced:

   ```sql
   insert into public.explorer_staff(user_id, role, label)
   values ('REPLACE-WITH-OWNER-ACCOUNT-UUID', 'admin', 'School administrator');
   ```

4. Open Resources → Admin → Refresh school data. Grant teacher access only to verified
   staff account IDs. The roster shows IDs and enrollment dates, not private names,
   emails, photos, or location histories. Configure the verified school contact.
5. Staff can publish notices, schedule drills, review reports and moderate community
   posts. Students must explicitly share their practice records in Records.

The migration was tested against PostgreSQL-compatible PGlite with actual RLS roles.
**It has not been applied to the live Supabase project by this change.** A missing
schema produces an activation error instead of fake school data. These features
cannot become live until the project owner completes the steps above.

## Solana donations

No recipient is preloaded and no payment is initiated by setup or by opening the app.
An administrator must independently verify the recipient and enter its Solana
mainnet public wallet in Admin. The Community screen prepares a standard `solana:`
payment link; the user's wallet presents and authorizes the transaction separately.
Do not enter seed phrases, private keys or passwords anywhere in this app.

The optional receipt verifier accepts only successful, finalized, direct native SOL
system transfers to that campaign's wallet, with a block time after campaign creation.
It rejects token transfers, failed transactions, wrong recipients, unsupported amounts
and duplicate signatures. It records a transfer, **not proof of donor identity**;
anyone can see a public signature, so the submitting account is not called its owner.

Deploy from the repository root using an authenticated Supabase CLI:

```sh
supabase link --project-ref skpubmbcbcftfvovjspn
supabase secrets set APP_ORIGIN=https://YOUR-EXPLORER-DOMAIN
# Optional: a trusted HTTPS Solana mainnet RPC endpoint for reliable capacity.
supabase secrets set SOLANA_RPC_URL=https://YOUR-MAINNET-RPC-ENDPOINT
supabase functions deploy verify-school-donation --no-verify-jwt
```

`--no-verify-jwt` disables the gateway's legacy JWT check. The function itself
requires a bearer token and validates it using Supabase Auth `getUser` before any
verification work; it does not accept anonymous submissions. Configure `APP_ORIGIN`
to the exact site origin, including scheme and port when testing locally. Supabase
provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` inside the function runtime.
Never put that service-role key into Vite variables, source files or browser storage.
The default RPC is the public mainnet endpoint and may rate-limit requests.

No payment was sent and no live recipient or receipt-verification service was
provisioned during implementation. Errors never produce a verified receipt or a
successful-payment message.

## Privacy and trust boundaries

- Local learning and children's badges use separate browser-storage keys per account
  or signed-out device. Browser storage is not encrypted. Exports exclude account IDs
  and GPS coordinates. Storage failures explicitly report session-only progress.
- Shared learning includes only a chosen display name, scores and checklist entries.
  Authorized staff can read it; classmates cannot. The owner can revoke sharing.
- Help/hazard reports are readable by their author and authorized staff. Review status
  is staff-writable only. Reports never automatically change LifeRouter's geometry.
- The geographic map obtains coordinates only on an explicit button press. That fills
  fields; a separate Search action sends the chosen area to Overpass/OSM. It never
  saves a GPS history or publishes device locations to other accounts. Geographic
  search is separate from the existing private campus GPS feature.
- OSM schools are not labeled as verified shelters. School map notices have expiry
  times; they are school-reported information, not government hazard assessments.
- Staff/admin rights are enforced in PostgreSQL. Users cannot elevate themselves by
  changing profile roles, calling the API directly or editing browser state.
- Receipt inserts require the server's service role. Ordinary users, teachers and even
  frontend administrators cannot write a fabricated verified donation directly.
- Audit entries capture account, operation, table and record ID for school actions;
  they do not duplicate report text or profile contents. Administrators can read them.
- Lists load up to 100 rows; timestamped lists show newest first and learning rankings
  sort by points. They are not a complete analytics export for larger deployments.

## Relationship to ResQverse

ResQverse was reviewed at `bfb50406630450d8a9df345e1be0d976a7293550` in
https://github.com/Prasi24bms017/resqverse-ready. No reuse license was present.
This suite is original RADAR code/content inspired by those product capabilities.
No ResQverse code, assets, Firebase project, donation recipient, secret URL admin
scheme, hard-coded alerts or proprietary games were imported. Exact source merging
would require the owner's permission or an appropriate license.

Leaflet is used under BSD-2-Clause. Map tiles and facility data are supplied by
OpenStreetMap contributors and Overpass; map attribution is displayed. Existing
LifeRouter and its Apache-2.0 attribution remain unchanged.

## Verification

```sh
npm ci
npm run lint
npm run build
npm test
npm run test:e2e
```

Database tests exercise anonymous, student, teacher, administrator and service roles.
Browser tests cover children's games, map opt-in, school forms, explicit score sharing,
moderation, missing-service states and failed donation verification. The receipt parser
is tested against wrong recipients, failed transactions, invalid amounts and fake programs.
Real school publication, payment execution and provider availability are not asserted
by mocked browser tests; those require the deployment configuration described above.

Implementation validation: lint and production build passed; 46 Node/database tests,
98 full-suite browser tests (with the real LifeRouter bridge), and four targeted
map/expiry browser checks passed. The donation Edge Function passed `deno check`.
To include real LifeRouter in browser tests, start its bridge and set
`LIFEROUTER_TEST_URL=http://127.0.0.1:8091`. The donation function was type-checked
but not deployed or exercised against a live payment.
