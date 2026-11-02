# Enable the separate student accounts

The app is configured for project **skpubmbcbcftfvovjspn**. Its public URL and
publishable key are in `src/lib/student-project.json`. A publishable key identifies
the project; database and storage policies enforce access. No server secret,
database password or service-role key belongs in this browser app.

## One-time database setup

1. Open the project's [SQL Editor](https://supabase.com/dashboard/project/skpubmbcbcftfvovjspn/sql/new).
2. Copy the complete contents of
   [`202611020001_student_profiles.sql`](../supabase/migrations/202611020001_student_profiles.sql)
   into a new query and run it once. It creates the two profile/presence tables,
   restricted lookup functions, owner policies and the private photo bucket.
   It does not modify the original RADAR project.
3. In **Authentication → URL Configuration**, set the Site URL to your standalone
   website and add that website's address to Redirect URLs. Add your local Vite
   address too if you will test registration locally.
4. Enable the Email authentication provider. Keep email confirmation enabled if
   students should verify their email addresses. Registration follows the project's
   configured email delivery and password settings.
5. Deploy the latest `main` from this repository. No Vercel server function or
   database connection string is needed.

The migration is versioned and intended to run once. The project must have the
Supabase Auth and Storage schemas, which Supabase provides automatically.

## Check your site

Open **Student profile → Student sign in → Create account**. Confirm the email if
required, sign in, and edit the card. Save a photo and reload to check account storage.

To check sharing, use two separate student accounts in different browsers. Enable
**Show my character to signed-in students** on one account. Initially, every identity
field and photo remains private. Turn on only the fields you want to share. The other
account can click that character to view the permitted card; it cannot edit it.
Sharing and position updates refresh about every three seconds. A disconnected
character expires after 30 seconds; background tabs stop publishing their position.

Enabling **My live location** suppresses shared-character publishing for the entire
page session, even after GPS is stopped or manually corrected. Measured physical
coordinates never enter the presence table. See [live location](LIVE-LOCATION.md).
Local nickname, role and uniform-color preferences are also separate from the
shared account fields; changing them does not reveal them to other students.

## Photo and identity behavior

- Boy/girl character selection, sex and profile photo are independent settings.
- A device profile is kept in IndexedDB under `campus-explorer-student`; sign-in
  opens the account's separate profile. Device data is not uploaded automatically.
- Room photos continue using their existing browser storage and published manifest.
  Student profile photos are a separate feature.
- Photo input supports JPG, PNG and WebP up to 15 MB. The crop editor works from a
  resized image (maximum 1600 pixels on the longest side), then saves a 640 × 800
  WebP portrait. Canvas re-encoding discards source metadata. Only the final crop
  is uploaded; the original photograph is not stored on the server.
- Camera access is requested only when **Take photo** is clicked. Tracks stop when
  a photo is captured, the camera is closed, or the component is removed. Camera
  support requires HTTPS or localhost and the browser's permission.
- The private `explorer-student-photos` bucket stores one object per account:
  `<account UUID>/portrait.webp`. Replacement overwrites that object. Removal
  deletes it when **Save Changes** succeeds. Cancelling the editor retains the saved photo.
- Photos are hidden from other accounts while their bytes are being replaced.
  A failed metadata save attempts to restore the previous image; no failed operation
  is reported as saved. If rollback cannot complete, the photo remains hidden.
- The client downloads permitted photos with an authenticated request and renders
  temporary object URLs. It does not create public or signed photo URLs.
- No facial recognition, biometric extraction or third-party photo analysis is used.

## Access controls

`explorer_profiles` and `explorer_presence` use row-level security. A student can
read and write only their own raw records. Cross-account reads go through
`get_explorer_student` and `list_explorer_students`, which return permitted fields
only. Anonymous users cannot call these functions. Photo reads enforce ownership
or explicit sharing on the storage server; hiding a field in the interface is
not the access-control mechanism.

The app never falls back to device storage after a failed account save. Error
messages stay in the editor and the previous successful card remains available.

## Optional project overrides

To use a different independent project, change the public JSON file or set these
Vite build variables and redeploy:

```text
VITE_STUDENT_SUPABASE_URL=https://your-project.supabase.co
VITE_STUDENT_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
```

An empty value for both variables builds a device-only version. Never put a
secret/service-role key into a `VITE_` variable. No privileged key is needed by this app.

## Verification

`npm test` applies the real migration to embedded PostgreSQL and checks ownership,
private defaults, field visibility, photo access, deletion and presence expiry.
The browser suite covers account flows with an intercepted test service, alongside
photo cropping, camera permission/capture and persistent device profiles.

These tests do not apply the migration to your hosted project or verify email
delivery. The cloud workspace could not reach this project's Supabase endpoints
because its network proxy denied the connection. Complete the one-time SQL setup
and check the live site using the steps above.
