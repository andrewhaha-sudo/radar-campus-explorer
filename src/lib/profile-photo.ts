export interface Crop {
  zoom: number;
  x: number;
  y: number;
}
export const initialCrop: Crop = { zoom: 1, x: 50, y: 50 };
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export async function validatePhotoFile(file: File) {
  if (!file.size || file.size > MAX_PHOTO_BYTES)
    throw new Error("Choose a photo up to 15 MB.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.slice(0, 8).join() === "137,80,78,71,13,10,26,10";
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!(
    (file.type === "image/jpeg" && jpeg) ||
    (file.type === "image/png" && png) ||
    (file.type === "image/webp" && webp)
  ))
    throw new Error("Choose a valid JPG, PNG or WebP photograph.");
}
function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("This photo could not be processed.")),
      "image/webp",
      0.9,
    ),
  );
}
export async function preparePhoto(file: File): Promise<Blob> {
  await validatePhotoFile(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "This file could not be opened as a photo. Try another image.",
    );
  }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await canvasBlob(canvas);
  } finally {
    bitmap.close();
  }
}
export function cropBounds(width: number, height: number, crop: Crop) {
  const zoom = Math.max(1, Math.min(3, crop.zoom));
  const w = Math.min(width, height * 0.8) / zoom;
  const h = w / 0.8;
  return {
    x: ((width - w) * Math.max(0, Math.min(100, crop.x))) / 100,
    y: ((height - h) * Math.max(0, Math.min(100, crop.y))) / 100,
    width: w,
    height: h,
  };
}
export async function cropPhoto(photo: Blob, crop: Crop): Promise<Blob> {
  const bitmap = await createImageBitmap(photo);
  try {
    const bounds = cropBounds(bitmap.width, bitmap.height, crop);
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 800;
    canvas
      .getContext("2d")!
      .drawImage(
        bitmap,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        0,
        0,
        640,
        800,
      );
    return await canvasBlob(canvas);
  } finally {
    bitmap.close();
  }
}
