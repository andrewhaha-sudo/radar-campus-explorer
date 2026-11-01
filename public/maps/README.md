# Supplied map artwork

`campus.jpg` (1254 × 1254) and `floor-plans.jpg` (2048 × 682) are the original
JPEG streams embedded in the user's `RADAR_Exact_Design_Game_Prompt_Compact.pdf`.
They were extracted with `pdfimages -f 1 -l 1 -j` and copied without recompression,
redrawing, or image generation. The separate original PNGs were not available.
Ownership and licensing of the supplied artwork remain with their respective owners.

The standalone explorer renders these files at their original aspect ratios. Indoor
scenes use SVG viewBox crops of the same full floor-plan image. Gameplay, selection,
character, and path indicators are separate layers. “Original artwork only” hides them.

Geometry is in `src/components/map/campus-data.ts`. Measurements use source-image
pixels; `crop` controls framing, `walkable` rectangles define conservative connected
navigation corridors, and room/entrance coordinates define destinations. These are
illustration coordinates, not survey measurements or verified evacuation routes.

Building A has one floor and two doors. Building B has two floors and two doors per
floor. Building 6 has two floors and five doors per floor; its outdoor entrance is
unassigned. No interiors are invented for other campus buildings. Room IDs such as
A-101 and B-201 are exploration labels, not identifiers from a school database.

The app opens directly to the campus. It requires no account, database, or map API.
Use arrow keys/WASD, touch buttons, or click a path/building. E interacts at entrances,
exits and stairs. Choose a classroom to navigate through a building and its stairs.
Indoor floor plans opens the original sheet and allows independent interior previews.
