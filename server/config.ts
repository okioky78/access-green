import { createHttpError } from "./shared/http.ts";

type NetlifyRuntime = typeof globalThis & {
  Netlify?: {
    env?: {
      get?: (key: string) => string | undefined;
    };
  };
};

export const getRuntimeEnv = (key: string) => {
  const netlifyValue = (globalThis as NetlifyRuntime).Netlify?.env?.get?.(key);

  return (netlifyValue ?? process.env[key] ?? "").trim();
};

export const getAllowedOrigins = () => {
  const configuredOrigins = (process.env.APP_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const netlifyUrl = (process.env.URL || "").trim();
  const localOrigins =
    process.env.NETLIFY_DEV === "true" || (!configuredOrigins.length && !netlifyUrl)
      ? ["http://localhost:8888", "http://localhost:3000"]
      : [];

  return Array.from(new Set([
    ...configuredOrigins,
    netlifyUrl,
    ...localOrigins,
  ].filter(Boolean)));
};

export const getAppOrigin = () => {
  const origins = getAllowedOrigins();
  if (!origins.length) {
    throw createHttpError("APP_ORIGIN is not configured.", 500, "MISSING_APP_ORIGIN");
  }

  return origins[0];
};

export const usesSecureOrigin = () => {
  if (process.env.NETLIFY_DEV === "true") return false;

  return getAllowedOrigins()[0]?.startsWith("https://") ?? false;
};

export const getAuthRedirectUrl = (query = "") => {
  const appOrigin = getAppOrigin();
  return `${appOrigin}/${query ? `?${query}` : ""}`;
};

const ADMITTED_APPLICANTS_SPREADSHEET_ID_ENV =
  "GOOGLE_ADMITTED_APPLICANTS_SPREADSHEET_ID";
const ADMITTED_APPLICANTS_SHEET_RANGE_ENV =
  "GOOGLE_ADMITTED_APPLICANTS_SHEET_RANGE";
const DEFAULT_ADMITTED_APPLICANTS_SHEET_RANGE = "Sheet1!A:G";
const ADMISSION_CERTIFICATE_IMAGE_FOLDER_ID_ENV =
  "GOOGLE_ADMISSION_CERTIFICATE_IMAGE_FOLDER_ID";

export const getAdmittedApplicantsSheetConfig = () => {
  const spreadsheetId = getRuntimeEnv(ADMITTED_APPLICANTS_SPREADSHEET_ID_ENV);

  if (!spreadsheetId) {
    throw createHttpError(
      `${ADMITTED_APPLICANTS_SPREADSHEET_ID_ENV} is not configured.`,
      500,
      "MISSING_ADMITTED_APPLICANTS_SPREADSHEET_ID",
    );
  }

  return {
    spreadsheetId,
    range: getRuntimeEnv(ADMITTED_APPLICANTS_SHEET_RANGE_ENV) ||
      DEFAULT_ADMITTED_APPLICANTS_SHEET_RANGE,
  };
};

export const getAdmissionCertificateImageFolderConfig = () => {
  const folderId = getRuntimeEnv(ADMISSION_CERTIFICATE_IMAGE_FOLDER_ID_ENV);

  if (!folderId) {
    throw createHttpError(
      `${ADMISSION_CERTIFICATE_IMAGE_FOLDER_ID_ENV} is not configured.`,
      500,
      "MISSING_ADMISSION_CERTIFICATE_IMAGE_FOLDER_ID",
    );
  }

  return { folderId };
};
