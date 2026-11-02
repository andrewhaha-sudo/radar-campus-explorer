# Student card artwork

`portraits.png` contains boy and girl uniform portraits, and `campus.png` contains
the front-facing courtyard. These assets were generated for this app using the
user-supplied student trainer card as a visual reference. The supplied campus map
and floor-plan JPEGs remain unchanged.

The trainer card's frame, labels and field panels are live HTML/CSS. Uploaded
photographs replace only the portrait inside that frame. Walking characters are
separate SVG pixel sprites with idle and four-direction walking states; uploading
a real photo never replaces those game sprites.

Do not put private student photographs into this public directory. Account photos
use the private Supabase bucket, and device-only photos use browser storage.
