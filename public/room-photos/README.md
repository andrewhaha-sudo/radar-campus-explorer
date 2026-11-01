# Photos visible to all visitors

The **Add room photo** button in the app saves a photo locally in that browser.
To include photos in the published site, put the actual image files in this folder
and edit `public/room-photos.json`. Use stable room IDs as keys, for example:

```json
{
  "C-101": { "src": "/room-photos/building-c.jpg", "caption": "Building C classroom" },
  "LAB-101": { "src": "/room-photos/chemistry.jpg", "caption": "Chemistry laboratory" },
  "D-101": { "src": "/room-photos/d-101.jpg" },
  "D-102": { "src": "/room-photos/d-102.jpg" }
}
```

Only add entries after the corresponding image files exist. Supported uploads are
JPG, PNG, WebP and GIF. Commit and deploy the files to make these photos available
to every visitor. Local uploads override a published photo on the uploading device.

Room IDs: A-101, A-102; B-101, B-102, B-201, B-202; C-101; LAB-101;
D-101, D-102; 6-101 through 6-105 and 6-201 through 6-205.
Building E is the renamed pond-side building; it has no assigned interior.

Files in this directory are publicly accessible once deployed. Use photos intended
for visitors to see. The application never sends locally uploaded photos to a server.
