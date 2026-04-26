import { createHttpError, getHeader } from "./http.ts";
import { sanitizeFilenameSegment } from "./filename.ts";
import type { MultipartFormData, UploadedFile } from "./types.ts";

const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"]);
const HEIC_IMAGE_EXTENSIONS = new Set([".heic", ".heif"]);
const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const OCTET_STREAM_MIME_TYPE = "application/octet-stream";

export const MAX_UPLOAD_SIZE_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_LABEL = "4MB";
const MAX_MULTIPART_OVERHEAD_BYTES = 256 * 1024;
const MAX_MULTIPART_BODY_SIZE_BYTES = MAX_UPLOAD_SIZE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;

const isFormDataFile = (value: FormDataEntryValue | null): value is File => {
  if (typeof value !== "object" || value === null) return false;

  const maybeFile = value as Partial<File>;

  return (
    typeof maybeFile.name === "string" &&
    typeof maybeFile.type === "string" &&
    typeof maybeFile.size === "number" &&
    typeof maybeFile.arrayBuffer === "function"
  );
};

const getFileExtension = (filename = "") => {
  const extensionStart = filename.lastIndexOf(".");

  return extensionStart >= 0 ? filename.slice(extensionStart).toLowerCase() : "";
};

const hasHeifSignature = (buffer: Buffer) => {
  if (buffer.length < 12 || buffer.toString("ascii", 4, 8) !== "ftyp") return false;

  const declaredBoxSize = buffer.readUInt32BE(0);
  const brandsEnd =
    declaredBoxSize > 16 && declaredBoxSize <= buffer.length
      ? declaredBoxSize
      : buffer.length;
  const brands = [buffer.toString("ascii", 8, 12)];

  for (let offset = 16; offset + 4 <= brandsEnd; offset += 4) {
    brands.push(buffer.toString("ascii", offset, offset + 4));
  }

  return brands.some((brand) => HEIF_BRANDS.has(brand));
};

const normalizeImageMimeType = ({ filename, mimeType, buffer }: UploadedFile) => {
  const normalizedMimeType = (mimeType || "").toLowerCase() || OCTET_STREAM_MIME_TYPE;
  const extension = getFileExtension(filename);

  if (normalizedMimeType !== OCTET_STREAM_MIME_TYPE) return normalizedMimeType;
  if (!HEIC_IMAGE_EXTENSIONS.has(extension) || !hasHeifSignature(buffer)) {
    return normalizedMimeType;
  }

  return extension === ".heif" ? "image/heif" : "image/heic";
};

export const isSupportedImageUpload = ({ filename, mimeType }: UploadedFile) => {
  const normalizedMimeType = (mimeType || "").toLowerCase();
  const extension = getFileExtension(filename);

  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) return false;
  return ALLOWED_IMAGE_MIME_TYPES.has(normalizedMimeType);
};

const parseContentLength = (value: string) => {
  if (!value) return null;

  const contentLength = Number(value);

  return Number.isSafeInteger(contentLength) && contentLength >= 0 ? contentLength : null;
};

const requireRequestSizeWithinLimit = (request: Request) => {
  const contentLength = parseContentLength(getHeader(request.headers, "content-length"));

  if (contentLength !== null && contentLength > MAX_MULTIPART_BODY_SIZE_BYTES) {
    throw createHttpError(`${MAX_UPLOAD_SIZE_LABEL} 이하의 이미지만 업로드할 수 있습니다.`, 413, "REQUEST_TOO_LARGE");
  }
};

const readRequestBodyWithinLimit = async (request: Request) => {
  if (!request.body) {
    throw createHttpError("업로드할 파일이 없습니다.", 400, "MISSING_FILE");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_MULTIPART_BODY_SIZE_BYTES) {
      await reader.cancel().catch(() => {});
      throw createHttpError(`${MAX_UPLOAD_SIZE_LABEL} 이하의 이미지만 업로드할 수 있습니다.`, 413, "REQUEST_TOO_LARGE");
    }

    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  chunks.forEach((chunk) => {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return body;
};

const createBufferedRequest = async (request: Request) =>
  new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: new Blob([await readRequestBodyWithinLimit(request)]),
  });

export const parseMultipartFormData = async (request: Request): Promise<MultipartFormData> => {
  const contentType = getHeader(request.headers, "content-type");
  if (!contentType.includes("multipart/form-data")) {
    throw createHttpError("multipart/form-data 요청만 지원합니다.", 400, "INVALID_CONTENT_TYPE");
  }

  requireRequestSizeWithinLimit(request);

  const formData = await (await createBufferedRequest(request)).formData();
  const fileValues = formData.getAll("file").filter(isFormDataFile);

  if (fileValues.length > 1) {
    throw createHttpError("현재는 한 번에 하나의 파일만 업로드할 수 있습니다.", 400, "TOO_MANY_FILES");
  }

  const fileValue = fileValues[0];
  if (!fileValue) {
    throw createHttpError("업로드할 파일이 없습니다.", 400, "MISSING_FILE");
  }

  if (fileValue.size > MAX_UPLOAD_SIZE_BYTES) {
    throw createHttpError(`${MAX_UPLOAD_SIZE_LABEL} 이하의 이미지만 업로드할 수 있습니다.`, 400, "FILE_TOO_LARGE");
  }

  const fields: Record<string, string> = {};
  formData.forEach((value, fieldName) => {
    if (fieldName !== "file" && typeof value === "string") {
      fields[fieldName] = value;
    }
  });

  const fileBuffer = Buffer.from(await fileValue.arrayBuffer());
  const uploadedFile: UploadedFile = {
    filename: sanitizeFilenameSegment(fileValue.name, "receipt"),
    mimeType: fileValue.type || OCTET_STREAM_MIME_TYPE,
    buffer: fileBuffer,
  };

  uploadedFile.mimeType = normalizeImageMimeType(uploadedFile);

  if (!isSupportedImageUpload(uploadedFile)) {
    throw createHttpError("이미지 파일만 업로드할 수 있습니다.", 400, "UNSUPPORTED_FILE_TYPE");
  }

  return { fields, file: uploadedFile };
};
