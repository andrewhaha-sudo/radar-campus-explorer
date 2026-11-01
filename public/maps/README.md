# Supplied map artwork

`campus.jpg` (1254 × 1254) and `floor-plans.jpg` (2048 × 682) are the original
JPEG streams embedded in the user's `RADAR_Exact_Design_Game_Prompt_Compact.pdf`.
They were extracted with `pdfimages -f 1 -l 1 -j` and copied without recompression,
redrawing, or image generation. The separate original PNGs were not available.
Ownership and licensing of the supplied artwork remain with their respective owners.

The standalone explorer renders these files at their original aspect ratios. Indoor
scenes use SVG viewBox crops of the same full floor-plan image. Building C and
Chemistry Lab combine two source sections into a compact one-room hallway; Building D
reuses the two-room Building A hallway. No source image files are changed. The
pond-side building's corrected **Bldg. E** sign is a separate text overlay.
Gameplay, selection, character, and route arrows are separate layers.
“Original artwork only” hides interactive layers and the corrected label; the
unchanged campus source image still contains its original Bldg. D text.

Geometry is in `src/components/map/campus-data.ts`. Measurements use source-image
pixels; `crop` controls framing, `walkable` rectangles define conservative connected
navigation corridors, and room/entrance coordinates define destinations. These are
illustration coordinates, not survey measurements or verified evacuation routes.

Building A has one floor and two doors. Building B has two floors and two doors per
floor. Building C and Chemistry Lab each have one room; Building D has two rooms.
Building E (beside the pond) has no assigned interior. Building 6 has two floors and
five doors per floor; its outdoor entrance is unassigned. Room IDs such as A-101,
LAB-101 and D-102 are exploration labels, not identifiers from a school database.

The app opens directly to the campus. It requires no account, database, or map API.
Use arrow keys/WASD, touch buttons, or click a path/building. E interacts at entrances,
exits and stairs. Choose a classroom to navigate through a building and its stairs.
Indoor floor plans opens the original sheet and allows independent interior previews.
Room doors open a photo viewer; local uploads persist in the browser. Photos for
all visitors can be configured through `public/room-photos.json`.
