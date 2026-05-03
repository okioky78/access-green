const SAFE_FALLBACK = "receipt";

export const sanitizeFilenameSegment = (value: unknown, fallback = SAFE_FALLBACK) => {
  const sanitized = String(value || "")
    .normalize("NFC")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized || fallback;
};
