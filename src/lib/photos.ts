import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { config } from "@/lib/config";
import { randomToken } from "@/lib/crypto";

const PHOTO_ROOT = path.join(process.cwd(), "storage", "photos");
const KEY_RE = /^photo_[a-f0-9]{32}\.jpg$/;

export class PhotoError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "PhotoError";
  }
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

function pathForKey(storageKey: string): string {
  if (!KEY_RE.test(storageKey)) throw new PhotoError(400, "Invalid storage key.");
  return path.join(PHOTO_ROOT, storageKey.slice(6, 8), storageKey);
}

/**
 * Secure upload pipeline:
 *  1. application-level size cap (5 MB original)
 *  2. decodability + real-image check via sharp (ignores browser MIME)
 *  3. pixel/dimension bounds (decompression-bomb guard)
 *  4. EXIF orientation applied, all metadata stripped
 *  5. re-encode to controlled JPEG, random opaque storage key
 *  6. stored outside the public web root (storage/photos/<shard>/<key>)
 */
export async function processStudentPhoto(input: {
  buffer: Buffer;
  byteLength: number;
}): Promise<{ storageKey: string; bytes: number }> {
  const maxBytes = config.maxUploadMb * 1024 * 1024;
  if (input.byteLength > maxBytes) {
    throw new PhotoError(413, `Photo exceeds the ${config.maxUploadMb} MB limit.`);
  }
  if (input.byteLength < 256) {
    throw new PhotoError(422, "The uploaded file is not a valid image.");
  }

  let metadata: import("sharp").Metadata;
  try {
    metadata = await sharp(input.buffer, {
      limitInputPixels: 40_000_000,
    }).metadata();
  } catch {
    throw new PhotoError(422, "Only genuine JPG or PNG images are accepted.");
  }

  if (!metadata.format || !["jpeg", "png"].includes(metadata.format)) {
    throw new PhotoError(422, "Only JPG or PNG images are accepted.");
  }
  const { width = 0, height = 0 } = metadata;
  if (width < 120 || height < 120) {
    throw new PhotoError(422, "Photo is too small (minimum 120×120 px).");
  }
  if (width > 8000 || height > 8000) {
    throw new PhotoError(422, "Photo dimensions are too large.");
  }

  let output: Buffer;
  try {
    output = await sharp(input.buffer, { limitInputPixels: 40_000_000 })
      .rotate() // honor EXIF orientation before stripping metadata
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer(); // default behavior strips EXIF/metadata
  } catch {
    throw new PhotoError(422, "The image could not be processed.");
  }

  const storageKey = `photo_${createHash("sha256")
    .update(randomToken(24))
    .digest("hex")
    .slice(0, 32)}.jpg`;
  const dest = pathForKey(storageKey);
  await ensureDir(path.dirname(dest));
  await writeFile(dest, output, { mode: 0o640 });

  return { storageKey, bytes: output.length };
}

export async function readPhoto(storageKey: string): Promise<Buffer> {
  return readFile(pathForKey(storageKey));
}

export async function deletePhoto(storageKey: string | null): Promise<void> {
  if (!storageKey) return;
  if (!KEY_RE.test(storageKey)) throw new PhotoError(400, "Invalid storage key.");
  try {
    await unlink(pathForKey(storageKey));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
}
