import type { Buffer } from "buffer";

export interface UploadedFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export type MultipartFields = Record<string, string>;

export interface MultipartFormData {
  fields: MultipartFields;
  file: UploadedFile;
}
