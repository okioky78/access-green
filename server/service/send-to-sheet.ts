import {
  deleteDriveFile,
  uploadDriveFile,
  type DriveClient,
} from "../clients/google-drive-client.ts";
import { appendSheetRows } from "../clients/google-sheet-client.ts";
import type { GoogleSheetClient } from "../clients/google-sheet-client.ts";
import {
  getAdmissionCertificateImageFolderConfig,
  getAdmittedApplicantsSheetConfig,
} from "../config.ts";
import { sanitizeFilenameSegment } from "../shared/filename.ts";
import { HttpError, createHttpError } from "../shared/http.ts";
import { parseMultipartFormData } from "../shared/image-multipart.ts";
import type { UploadedFile } from "../shared/types.ts";

export interface AdmissionSheetSubmission {
  name: string;
  university: string;
  college: string;
  department: string;
  admissionType: string;
  examineeNumber: string;
}

const toText = (value: unknown) => String(value ?? "").trim();

export const normalizeAdmissionSheetSubmission = (input: unknown): AdmissionSheetSubmission => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createHttpError("Invalid request body", 400, "INVALID_REQUEST_BODY");
  }

  const body = input as Record<string, unknown>;

  return {
    name: toText(body.name),
    university: toText(body.university),
    college: toText(body.college),
    department: toText(body.department),
    admissionType: toText(body.admissionType),
    examineeNumber: toText(body.examineeNumber),
  };
};

const getFileExtension = (filename = "") => {
  const extensionStart = filename.lastIndexOf(".");

  return extensionStart >= 0 ? filename.slice(extensionStart).toLowerCase() : "";
};

const buildAdmissionCertificateImageFilename = (
  submission: AdmissionSheetSubmission,
  originalFilename: string,
) => {
  const baseName = sanitizeFilenameSegment(
    [
      submission.examineeNumber,
      submission.name,
      Date.now(),
    ].filter(Boolean).join("_"),
    "admission-certificate",
  );

  return `${baseName}${getFileExtension(originalFilename)}`;
};

export const buildAdmissionSheetRow = (
  submission: AdmissionSheetSubmission,
  imageUrl: string,
) => [
  submission.name,
  submission.university,
  submission.college,
  submission.department,
  submission.admissionType,
  submission.examineeNumber,
  imageUrl,
];

const isAmbiguousSheetAppendFailure = (error: unknown) =>
  error instanceof HttpError && (error.code === "SHEET_TIMEOUT" || error.statusCode === 504);

interface SendAdmissionInfoToSheetInput {
  drive: DriveClient;
  fields: unknown;
  file: UploadedFile;
  sheets: GoogleSheetClient;
}

interface SendAdmissionSheetUploadInput {
  drive: DriveClient;
  request: Request;
  sheets: GoogleSheetClient;
}

export const sendAdmissionInfoToSheet = async ({
  drive,
  fields,
  file,
  sheets,
}: SendAdmissionInfoToSheetInput) => {
  const submission = normalizeAdmissionSheetSubmission(fields);
  const { spreadsheetId, range } = getAdmittedApplicantsSheetConfig();
  const { folderId } = getAdmissionCertificateImageFolderConfig();
  const filename = buildAdmissionCertificateImageFilename(submission, file.filename);
  const uploadedDriveFile = await uploadDriveFile({
    drive,
    folderId,
    filename,
    file,
  });

  try {
    await appendSheetRows({
      sheets,
      spreadsheetId,
      range,
      rows: [buildAdmissionSheetRow(submission, uploadedDriveFile.webViewLink)],
    });
  } catch (error) {
    console.error("Google Sheets append failed", error);

    if (isAmbiguousSheetAppendFailure(error)) {
      console.error(
        "Skipping admission certificate image rollback because the Google Sheets append result is unknown.",
        {
          code: error.code,
          statusCode: error.statusCode,
          driveFileId: uploadedDriveFile.id,
        },
      );
    } else {
      await deleteDriveFile({ drive, fileId: uploadedDriveFile.id }).catch((deleteError) => {
        console.error("Admission certificate image rollback failed", deleteError);
      });
    }

    if (error instanceof HttpError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unknown Google Sheets error";

    throw createHttpError(`Google Sheets append failed: ${message}`, 500, "SHEET_APPEND_FAILED");
  }

  return {
    success: true,
    driveFileUrl: uploadedDriveFile.webViewLink,
    filename,
  };
};

const parseAdmissionSheetUploadInput = async (request: Request) => {
  const { fields, file } = await parseMultipartFormData(request);

  return { fields, file };
};

export const sendAdmissionSheetUploadToSheet = async ({
  drive,
  request,
  sheets,
}: SendAdmissionSheetUploadInput) => {
  const { fields, file } = await parseAdmissionSheetUploadInput(request);

  return sendAdmissionInfoToSheet({
    drive,
    fields,
    file,
    sheets,
  });
};
