import { google, type sheets_v4 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { HttpError, createHttpError } from "../shared/http.ts";
import { withUpstreamTimeout, type UpstreamRequestOptions } from "../shared/upstream.ts";

export const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export type GoogleSheetClient = sheets_v4.Sheets;

interface AppendSheetRowsInput {
  sheets: GoogleSheetClient;
  spreadsheetId: string;
  range: string;
  rows: string[][];
  valueInputOption?: "RAW" | "USER_ENTERED";
}

export const createGoogleSheetClient = (auth: OAuth2Client) =>
  google.sheets({
    version: "v4",
    auth,
  });

export const appendSheetRows = async ({
  sheets,
  spreadsheetId,
  range,
  rows,
  valueInputOption = "RAW",
}: AppendSheetRowsInput) => {
  try {
    return await withSheetTimeout((requestOptions) =>
      sheets.spreadsheets.values.append(
        {
          spreadsheetId,
          range,
          valueInputOption,
          requestBody: {
            values: rows,
          },
        },
        requestOptions,
      ),
    );
  } catch (error) {
    throwSheetApiHttpError(error);
  }
};

const getSheetErrorStatusCode = (error: unknown) => {
  const responseError = error as {
    code?: number | string;
    statusCode?: number;
    status?: number;
    response?: {
      status?: number;
      data?: {
        error?: {
          code?: number | string;
        };
      };
    };
  };

  const statusCode =
    responseError.statusCode ??
    responseError.status ??
    responseError.response?.status ??
    responseError.response?.data?.error?.code ??
    responseError.code;

  if (typeof statusCode === "string") {
    const parsedStatusCode = Number(statusCode);

    return Number.isFinite(parsedStatusCode) ? parsedStatusCode : undefined;
  }

  return statusCode;
};

const throwSheetApiHttpError = (error: unknown): never => {
  if (error instanceof HttpError) throw error;

  const statusCode = getSheetErrorStatusCode(error);

  if (statusCode === 401) {
    throw createHttpError(
      "Google Sheets 인증이 만료되었습니다. 다시 로그인해 주세요.",
      401,
      "SHEET_AUTH_FAILED",
    );
  }

  if (statusCode === 403) {
    throw createHttpError(
      "현재 Google 계정에 합격자 Sheet를 수정할 권한이 없습니다. 관리자에게 시트 편집 권한을 요청해 주세요.",
      403,
      "SHEET_APPEND_ACCESS_DENIED",
    );
  }

  if (statusCode === 404) {
    throw createHttpError(
      "설정된 합격자 Google Sheet를 찾을 수 없습니다.",
      404,
      "SHEET_NOT_FOUND",
    );
  }

  throw error;
};

const withSheetTimeout = <T>(operation: (requestOptions: UpstreamRequestOptions) => Promise<T>) =>
  withUpstreamTimeout(operation, {
    message: "Google Sheets response timed out.",
    code: "SHEET_TIMEOUT",
  });
