import {
  getDriveConfig,
  resolveBranchFolderId,
  uploadDriveFile,
  type DriveClient,
} from "../clients/google-drive-client.ts";
import { sanitizeFilenameSegment } from "../shared/filename.ts";
import { createHttpError } from "../shared/http.ts";
import { parseMultipartFormData } from "../shared/image-multipart.ts";

const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"]);

const requireTextField = (value: unknown, message: string, code: string) => {
  const text = String(value || "").trim();

  if (!text) {
    throw createHttpError(message, 400, code);
  }

  return text;
};

const getSafeImageExtension = (filename = "") => {
  const extensionStart = filename.lastIndexOf(".");
  const extension = extensionStart >= 0 ? filename.slice(extensionStart).toLowerCase() : "";

  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    throw createHttpError("지원하지 않는 이미지 확장자입니다.", 400, "UNSUPPORTED_EXTENSION");
  }

  return extension;
};

const normalizePaymentDate = (value: unknown) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);

  if (!match) return raw;

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const requirePaymentDate = (paymentDate: unknown) => {
  const normalized = normalizePaymentDate(paymentDate);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw createHttpError("결제일을 YYYY-MM-DD 형식으로 입력해 주세요.", 400, "INVALID_PAYMENT_DATE");
  }

  return normalized;
};

const requireStudentName = (studentName: unknown) => {
  const safeStudentName = sanitizeFilenameSegment(studentName, "");

  if (!safeStudentName) {
    throw createHttpError("학생 이름을 입력해 주세요.", 400, "MISSING_STUDENT_NAME");
  }

  return safeStudentName;
};

const buildReceiptDriveFilename = ({
  paymentDate,
  studentName,
  originalFilename,
}: {
  paymentDate: string;
  studentName: string;
  originalFilename: string;
}) => `${paymentDate}_${studentName}${getSafeImageExtension(originalFilename)}`;

const parseReceiptDriveUploadInput = async (request: Request) => {
  const { fields, file } = await parseMultipartFormData(request);

  return {
    file,
    branch: requireTextField(fields.branch, "지점을 선택해 주세요.", "MISSING_BRANCH"),
    paymentDate: requirePaymentDate(fields.paymentDate),
    studentName: requireStudentName(fields.studentName),
  };
};

interface UploadReceiptToDriveInput {
  request: Request;
  drive: DriveClient;
}

export const uploadReceiptToDrive = async ({ request, drive }: UploadReceiptToDriveInput) => {
  const { branch, file, paymentDate, studentName } = await parseReceiptDriveUploadInput(request);
  const { driveRootFolderId } = getDriveConfig();

  const targetDriveFolderId = await resolveBranchFolderId({
    drive,
    driveRootFolderId,
    branch,
  });

  const filename = buildReceiptDriveFilename({
    paymentDate,
    studentName,
    originalFilename: file.filename,
  });

  const uploadedDriveFile = await uploadDriveFile({
    drive,
    folderId: targetDriveFolderId,
    filename,
    file,
  });

  return {
    message: "구글 드라이브에 저장 완료",
    driveFileUrl: uploadedDriveFile.webViewLink,
    filename,
  };
};
