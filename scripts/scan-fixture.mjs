// Synthetic three-point SPZ fixture, never a representation of a real facility.
import { writeFile } from "node:fs/promises";
import {
  SpzWriter,
  SpzReader,
} from "../apps/pathfinder/node_modules/@sparkjsdev/spark/dist/spark.module.js";
export async function writeScanFixture(file, numSplats = 3) {
  const writer = new SpzWriter({ numSplats, shDegree: 0 });
  for (let i = 0; i < numSplats; i++) {
    writer.setCenter(i, (i - (numSplats - 1) / 2) * 0.4, 1.3, 0);
    writer.setScale(i, 0.1, 0.1, 0.1);
    writer.setAlpha(i, 1);
    writer.setRgb(i, i === 0 ? 1 : 0.2, i === 1 ? 1 : 0.2, i === 2 ? 1 : 0.2);
    writer.setQuat(i, 0, 0, 0, 1);
  }
  const bytes = await writer.finalize();
  const reader = new SpzReader({ fileBytes: bytes });
  await reader.parseHeader();
  if (reader.numSplats !== numSplats)
    throw Error("Synthetic SPZ validation failed");
  await writeFile(file, bytes);
}
