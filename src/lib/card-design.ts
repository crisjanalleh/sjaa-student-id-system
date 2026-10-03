import type { CardDesignSettings } from "@/db/schema";

export const DEFAULT_CARD_DESIGN: CardDesignSettings = {
  signatorySignature: null,
  signatoryScale: 1,
  signatoryOffsetX: 0,
  signatoryOffsetY: 0,
  nameFontSize: 10.5,
  detailFontScale: 1,
  nameOffsetX: 0,
  nameOffsetY: 0,
  photoScale: 1,
  photoOffsetX: 0,
  photoOffsetY: 0,
};

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function normalizedSignature(value: unknown): string | null {
  if (
    typeof value === "string" &&
    value.length <= 180_000 &&
    /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    return value;
  }
  return null;
}

export function normalizeCardDesign(value: unknown): CardDesignSettings {
  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  return {
    signatorySignature: normalizedSignature(record.signatorySignature),
    signatoryScale: boundedNumber(record.signatoryScale, 1, 0.6, 1.8),
    signatoryOffsetX: boundedNumber(record.signatoryOffsetX, 0, -8, 8),
    signatoryOffsetY: boundedNumber(record.signatoryOffsetY, 0, -5, 5),
    nameFontSize: boundedNumber(record.nameFontSize, DEFAULT_CARD_DESIGN.nameFontSize, 8, 14),
    detailFontScale: boundedNumber(record.detailFontScale, 1, 0.8, 1.25),
    nameOffsetX: boundedNumber(record.nameOffsetX, 0, -5, 5),
    nameOffsetY: boundedNumber(record.nameOffsetY, 0, -5, 5),
    photoScale: boundedNumber(record.photoScale, 1, 0.8, 1.25),
    photoOffsetX: boundedNumber(record.photoOffsetX, 0, -5, 5),
    photoOffsetY: boundedNumber(record.photoOffsetY, 0, -5, 5),
  };
}
