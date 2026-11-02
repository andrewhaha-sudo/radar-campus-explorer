# Live device location and map identity

The **My live location** panel belongs to the standalone Campus Explorer. GPS is
off on every page load. **Enable location sync** starts the browser's actual
`navigator.geolocation.watchPosition()` with high accuracy, no cached position,
and a 15-second timeout. There is no production source of simulated coordinates.
This feature needs HTTPS or localhost and the device/browser's location permission.
It works without an account and requires no new Supabase migration.

## Calibrate your actual campus first

No verified campus geographic references have been supplied, so the repository
does not include a preset geographic alignment. The illustrated artwork alone
cannot tell us the coordinates of the school or any building. GPS stays disabled
until the user saves a verified calibration.

1. Open **Calibrate map**. Obtain at least **three non-collinear reference points**
   from a verified campus survey, a trusted georeferenced map, or carefully checked
   on-site measurements. Use four or more, distributed around the full walking area,
   when possible. Points along just one walkway are not enough.
2. For each reference, enter its landmark/source and WGS84 latitude and longitude
   in decimal degrees. Select **Pick reference … on map**, then tap the matching
   point on the campus image. X/Y can also be entered directly for keyboard access.
   Image coordinates range from 0 to 1254; X increases right and Y increases down.
3. Check every correspondence, confirm the verification checkbox, and save. The
   app rejects invalid, clustered, collinear and substantially inconsistent points.
4. Enable sync outdoors on campus. Check extra landmarks that were **not** used
   for calibration. An illustrated, non-surveyed map may have local distortions
   that a single affine transformation cannot correct. Recalibrate if field checks
   show disagreement; do not treat a three-point perfect fit as proof of accuracy.
5. **Download saved calibration** exports only your explicitly entered reference
   points. On another device, use **Import calibration**, review, confirm and save.
   Calibration is local to each browser/origin, rather than silently shared online.

References saved by the earlier GPS release are retained and prefilled when you
open the calibration editor. Review and confirm them before enabling the new
tracker. **Clear calibration** asks for confirmation and removes both saved formats.
Existing local campus roles are retained; the older “Staff” role is displayed as
“School Staff.” The two GPS implementations are consolidated into one active watch.

The implementation converts coordinates into a local east/north plane in meters,
then fits an affine transformation to image X/Y using all references. This accounts
for rotation, scale and shear. Placement is limited to the convex boundary of the
reference points; off-campus positions are never forced onto the map. The supported
reference area is within 5 km of its center and away from polar latitudes.

## Tracking behavior

- The displayed accuracy is the device's reported horizontal accuracy in meters.
  Readings worse than **±15 m** are uncertain. The ring around the last reliable
  location includes reported accuracy and calibration fit residual; it is an
  approximation, not a surveyed guarantee.
- Invalid, stale, out-of-order or implausibly sudden readings are ignored.
  Small displacements below a 2–5 m accuracy-dependent threshold are treated as
  stationary. A measured 10 m walk can still update the character.
- Only reliable measured endpoints move the character. A short 200 ms visual
  transition connects nearby readings when the straight segment is unobstructed.
  No route is generated for GPS. Across a wall or a long gap, the new measured
  endpoint appears without an invented path. Reduced-motion settings disable the
  transition. The app never extrapolates future positions between readings.
- A device heading is used only when finite and accompanied by speed of at least
  0.5 m/s. The heading arrow follows calibrated image orientation; the character
  uses its nearest four-direction sprite. Otherwise direction follows measured
  displacement. Walking animation ends after 1.2 seconds without another movement.
- After 20 seconds without a new reading, the panel shows **Location Signal
  Unavailable** and retains the last reliable position. New reliable fixes resume
  synchronization. Permission denial clears the watch and explains how to retry.
- **Disable location sync** clears the watch immediately, stops animation and
  keeps the last reliable marker with an inactive status. Late callbacks cannot
  move it. Leaving the page, unmounting or switching/signing out of an account
  clears tracking. Hidden tabs suspend the watch; returning to a still-enabled
  session requests fresh readings. Reloading never automatically starts GPS.
- Click-to-walk and manual movement are disabled while the GPS view is displayed.
  **Explore manually** restores the separate exploration position. That position
  is illustrative and is not presented as a physical location.

## Indoor and manual locations

GPS cannot reliably determine classrooms or floors. A reading projected into a
building, pond, fence or other blocked artwork is marked approximate and preserves
the last reliable point. It never opens a building or switches floors automatically.

Choose **Correct location manually** to stop GPS, then tap open ground or a hallway.
For an indoor location, open **Indoor floor plans** and deliberately choose the
building/floor. Corrections are labelled manual, never represented as a GPS fix.

`LocationSource` in `src/lib/live-location.ts` is an interface for future positioning
providers. Only browser geolocation is implemented. No Bluetooth beacon or indoor
positioning installation is assumed to exist.

## Identity and privacy

**Edit identity** sets an optional display name/nickname, Student/Teacher/School
Staff/Visitor role, boy/girl character and Green/Blue/Red/Gold uniform color. The
nickname appears above your character and the role appears in your own profile.
Nickname, role and color are stored locally, separately for each account (or guest).
They do not require a real name and are not automatically shared. The selected
boy/girl avatar uses the existing profile setting; account avatar changes use the
existing authenticated profile save. Real profile photos remain independent.

Live latitude, longitude, accuracy and heading remain in memory. There is no GPS
history database, background service, analytics event or location upload. Only
deliberately saved calibration references persist. Clearing site storage removes
those references and local identity preferences.

Enabling GPS hides your character from the existing shared exploration presence,
even if you previously opted into character sharing. This suppression remains for
the page session, including after stopping GPS or manually correcting a physical
location. Reloading returns to the ordinary non-GPS exploration position and its
existing sharing preference. A stale shared exploration character can take up to
30 seconds to expire if the server cannot be reached; its coordinates are from
manual exploration, never from GPS. Other students' permitted profiles can still
be viewed, but there is no feature for sharing live physical location.

## Validation and on-site phone check

Automated tests cover rotated calibration, bad references, stationary drift,
10 m movement, uncertain fixes, missed updates, direction, browser permissions,
background/stop cleanup, account sign-out, private network behavior and local
identity. Browser tests use explicitly synthetic device readings **only inside
test fixtures**, including Chromium's geolocation emulation. These tests do not
claim that an actual phone was walked around the school.

After deploying over HTTPS and calibrating with real references, perform these
checks on an actual phone at the school:

| Check | Expected result |
| --- | --- |
| Stand still outdoors for one minute | Minor GPS drift does not keep walking the character; accuracy remains visible. |
| Walk a measured 10 m along a verified walkway | The character follows measured positions at the calibrated scale. |
| Turn left/right and then stop | Direction follows reliable heading/displacement; walking animation stops. |
| Move indoors or obstruct the signal | Approximate/unavailable status; no guessed room or floor. |
| Disable sync, background, close/reload | Watch stops or pauses as described; reload starts OFF. |
| Deny browser permission | Clear denial message; no active watch. |
| Edit nickname, role, avatar and color | Identity persists and remains attached to your own marker. |
| Use a second signed-in account | Physical position is not shared, including after stopping or correcting it. |

Actual field accuracy remains unverified until these phone tests and campus
reference checks are completed on site.
