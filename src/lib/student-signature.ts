import "server-only";
import sharp from "sharp";

const MAX_INPUT_BYTES = 300 * 1024;
const MAX_OUTPUT_BYTES = 120 * 1024;

export class StudentSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudentSignatureError";
  }
}

export async function processStudentSignature(buffer: Buffer): Promise<string> {
  if (buffer.length < 128 || buffer.length > MAX_INPUT_BYTES) {
    throw new StudentSignatureError("The signature image must be no larger than 300 KB.");
  }

  try {
    const image = sharp(buffer, { limitInputPixels: 1_000_000 });
    const metadata = await image.metadata();
    if (
      metadata.format !== "png" ||
      !metadata.width ||
      !metadata.height ||
      metadata.width < 120 ||
      metadata.height < 40 ||
      metadata.width > 1200 ||
      metadata.height > 500
    ) {
      throw new StudentSignatureError("Draw your signature again using the signature pad.");
    }

    const normalized = await image
      .resize({ width: 720, height: 240, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    if (normalized.length > MAX_OUTPUT_BYTES) {
      throw new StudentSignatureError("The signature is too detailed to store. Please clear it and sign again.");
    }
    return `data:image/png;base64,${normalized.toString("base64")}`;
  } catch (error) {
    if (error instanceof StudentSignatureError) throw error;
    throw new StudentSignatureError("The signature could not be safely processed. Please sign again.");
  }
}
