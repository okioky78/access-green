import { Readable } from "stream";
import { google, type drive_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { getRuntimeEnv } from "../config.ts";
import { HttpError, createHttpError } from "../shared/http.ts";
import { withUpstreamTimeout, type UpstreamRequestOptions } from "../shared/upstream.ts";
import type { UploadedFile } from "../shared/types.ts";

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

export type DriveClient = drive_v3.Drive;
export type DriveFolder = Pick<drive_v3.Schema$File, "id" | "name">;

export const getDriveConfig = () => {
  const driveRootFolderId = getRuntimeEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID");

  if (!driveRootFolderId) {
    throw createHttpError("GOOGLE_DRIVE_ROOT_FOLDER_ID가 설정되지 않았습니다.", 500, "MISSING_DRIVE_ROOT_FOLDER");
  }

  return { driveRootFolderId };
};

export const createDriveClient = (auth: OAuth2Client) => google.drive({ version: "v3", auth });

const getDriveErrorStatusCode = (error: unknown) => {
  const responseError = error as {
    code?: number | string;
    statusCode?: number;
    status?: number;
    response?: { status?: number };
  };

  const statusCode =
    responseError.statusCode ||
    responseError.status ||
    responseError.response?.status ||
    responseError.code;

  return typeof statusCode === "string" ? Number(statusCode) : statusCode;
};

const throwDriveApiHttpError = (
  error: unknown,
  {
    accessDeniedCode,
    accessDeniedMessage,
    notFoundCode = accessDeniedCode,
    notFoundMessage = accessDeniedMessage,
  }: {
    accessDeniedCode: string;
    accessDeniedMessage: string;
    notFoundCode?: string;
    notFoundMessage?: string;
  },
): never => {
  if (error instanceof HttpError) throw error;

  const statusCode = getDriveErrorStatusCode(error);

  if (statusCode === 401) {
    throw createHttpError(
      "Google Drive 인증이 만료되었습니다. 다시 로그인해 주세요.",
      401,
      "DRIVE_AUTH_FAILED",
    );
  }

  if (statusCode === 403) {
    throw createHttpError(accessDeniedMessage, 403, accessDeniedCode);
  }

  if (statusCode === 404) {
    throw createHttpError(notFoundMessage, 404, notFoundCode);
  }

  throw error;
};

const escapeDriveQueryValue = (value: string) =>
  (value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export const listDirectChildFolders = async (
  drive: DriveClient,
  driveRootFolderId = getDriveConfig().driveRootFolderId,
) => {
  const folders: DriveFolder[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const response = await withDriveTimeout(
        (requestOptions) =>
          drive.files.list(
            {
              supportsAllDrives: true,
              includeItemsFromAllDrives: true,
              q: [
                `'${escapeDriveQueryValue(driveRootFolderId)}' in parents`,
                `mimeType = '${FOLDER_MIME_TYPE}'`,
                "trashed = false",
              ].join(" and "),
              fields: "nextPageToken, files(id, name)",
              pageSize: 100,
              pageToken,
            },
            requestOptions,
          ),
      );

      folders.push(...((response.data.files || []) as DriveFolder[]));
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (error) {
    throwDriveApiHttpError(error, {
      accessDeniedCode: "DRIVE_ROOT_ACCESS_DENIED",
      accessDeniedMessage:
        "이 Google 계정은 영수증 저장 폴더에 접근할 수 없습니다. 관리자에게 폴더 공유 권한을 요청해 주세요.",
      notFoundCode: "DRIVE_ROOT_NOT_FOUND",
      notFoundMessage: "설정된 Google Drive 저장 폴더를 찾을 수 없습니다.",
    });
  }

  return folders;
};

interface ResolveBranchFolderIdInput {
  drive: DriveClient;
  driveRootFolderId?: string;
  branch?: string;
}

export const resolveBranchFolderId = async ({
  drive,
  driveRootFolderId = getDriveConfig().driveRootFolderId,
  branch,
}: ResolveBranchFolderIdInput) => {
  const normalizedBranch = (branch || "").trim();

  if (!normalizedBranch) {
    throw createHttpError("지점을 선택한 뒤 저장해 주세요.", 400, "MISSING_BRANCH");
  }

  const childFolders = await listDirectChildFolders(drive, driveRootFolderId);
  const matchedFolders = childFolders.filter((folder) => (folder.name || "").trim() === normalizedBranch);

  if (matchedFolders.length === 0) {
    throw createHttpError(`'${normalizedBranch}' 지점과 같은 이름의 Google Drive 폴더를 찾을 수 없습니다.`, 400, "BRANCH_FOLDER_NOT_FOUND");
  }

  if (matchedFolders.length > 1) {
    throw createHttpError(`'${normalizedBranch}' 이름의 Google Drive 폴더가 여러 개 있습니다. 부모 폴더 아래 폴더명을 하나로 정리해 주세요.`, 400, "DUPLICATED_BRANCH_FOLDER");
  }

  return matchedFolders[0].id as string;
};

interface UploadDriveFileInput {
  drive: DriveClient;
  folderId: string;
  filename: string;
  file: UploadedFile;
}

interface UploadedDriveFile {
  id: string;
  webViewLink: string;
}

export const uploadDriveFile = async ({
  drive,
  folderId,
  filename,
  file,
}: UploadDriveFileInput): Promise<UploadedDriveFile> => {
  try {
    const response = await withDriveTimeout(
      (requestOptions) =>
        drive.files.create(
          {
            supportsAllDrives: true,
            requestBody: {
              name: filename,
              parents: [folderId],
            },
            media: {
              mimeType: file.mimeType,
              body: Readable.from(file.buffer),
            },
            fields: "id, webViewLink",
          },
          requestOptions,
        ),
    );

    if (!response.data.id) {
      throw createHttpError("Google Drive 업로드 결과를 확인할 수 없습니다.", 500, "DRIVE_UPLOAD_MISSING_ID");
    }

    return {
      id: response.data.id,
      webViewLink: response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`,
    };
  } catch (error) {
    return throwDriveApiHttpError(error, {
      accessDeniedCode: "DRIVE_UPLOAD_ACCESS_DENIED",
      accessDeniedMessage:
        "이 Google 계정은 대상 Google Drive 폴더에 업로드할 권한이 없습니다. 관리자에게 폴더 편집 권한을 요청해 주세요.",
      notFoundCode: "DRIVE_UPLOAD_FOLDER_NOT_FOUND",
      notFoundMessage: "업로드 대상 Google Drive 폴더를 찾을 수 없습니다.",
    });
  }
};

interface DeleteDriveFileInput {
  drive: DriveClient;
  fileId?: string | null;
}

export const deleteDriveFile = async ({ drive, fileId }: DeleteDriveFileInput) => {
  if (!fileId) return;

  try {
    await withDriveTimeout(
      (requestOptions) =>
        drive.files.delete(
          {
            fileId,
            supportsAllDrives: true,
          },
          requestOptions,
        ),
    );
  } catch (error) {
    throwDriveApiHttpError(error, {
      accessDeniedCode: "DRIVE_DELETE_ACCESS_DENIED",
      accessDeniedMessage: "Google Drive 파일을 삭제할 권한이 없습니다.",
      notFoundCode: "DRIVE_DELETE_FILE_NOT_FOUND",
      notFoundMessage: "삭제할 Google Drive 파일을 찾을 수 없습니다.",
    });
  }
};

const withDriveTimeout = <T>(operation: (requestOptions: UpstreamRequestOptions) => Promise<T>) =>
  withUpstreamTimeout(operation, {
    message: "Google Drive 응답 시간이 초과되었습니다.",
    code: "DRIVE_TIMEOUT",
  });
