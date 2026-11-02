// Synthetic coordinates for automated tests ONLY. Never imported by the app.
const radius = 6371008.8;
export function geoAt(x, y) {
  return {
    latitude: 14 + (((625 - y) / 5 / radius) * 180) / Math.PI,
    longitude:
      121 +
      (((x - 625) / 5 / radius / Math.cos((14 * Math.PI) / 180)) * 180) /
        Math.PI,
  };
}
export const testCalibration = {
  version: 1,
  image: "/maps/campus.jpg",
  verified: true,
  points: [
    [50, 250],
    [1200, 250],
    [1200, 1100],
    [50, 1100],
  ].map(([x, y], i) => ({
    label: "Synthetic test reference " + (i + 1),
    x,
    y,
    ...geoAt(x, y),
  })),
};
