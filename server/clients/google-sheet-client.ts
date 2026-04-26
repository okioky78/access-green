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
    throwSheetApiHttpError(error, range);
  }
};

interface SheetApiErrorDetail {
  message?: string;
  reasons: string[];
  status?: string;
  statusCode?: number;
}

const getSheetApiErrorDetail = (error: unknown): SheetApiErrorDetail => {
  const responseError = error as {
    code?: number | string;
    message?: string;
    statusCode?: number;
    status?: number;
    response?: {
      status?: number;
      data?: {
        error?: {
          code?: number | string;
          errors?: Array<{
            message?: string;
            reason?: string;
          }>;
          message?: string;
          status?: string;
        };
      };
    };
  };
  const apiError = responseError.response?.data?.error;

  const statusCode =
    responseError.statusCode ??
    responseError.status ??
    responseError.response?.status ??
    apiError?.code ??
    responseError.code;
  const normalizedStatusCode =
    typeof statusCode === "string" ? Number(statusCode) : statusCode;

  return {
    message: apiError?.message || responseError.message,
    reasons: (apiError?.errors || [])
      .map((errorItem) => errorItem.reason)
      .filter((reason): reason is string => Boolean(reason)),
    status: apiError?.status,
    statusCode: Number.isFinite(normalizedStatusCode) ? normalizedStatusCode : undefined,
  };
};

const formatSheetApiDetail = ({ message, reasons, status }: SheetApiErrorDetail) =>
  [
    message,
    status ? `status=${status}` : "",
    reasons.length ? `reason=${reasons.join(",")}` : "",
  ].filter(Boolean).join(" ");

const withSheetApiDetail = (message: string, detail: SheetApiErrorDetail) => {
  const detailMessage = formatSheetApiDetail(detail);

  return detailMessage ? `${message} Google 응답: ${detailMessage}` : message;
};

const hasReasonLike = ({ message, reasons }: SheetApiErrorDetail, pattern: RegExp) =>
  reasons.some((reason) => pattern.test(reason)) || Boolean(message && pattern.test(message));

const throwSheetApiHttpError = (error: unknown, range: string): never => {
  if (error instanceof HttpError) throw error;

  const detail = getSheetApiErrorDetail(error);
  const statusCode = detail.statusCode;

  console.error("Google Sheets append API failed", {
    message: detail.message,
    range,
    reasons: detail.reasons,
    status: detail.status,
    statusCode,
  });

  if (statusCode === 400) {
    throw createHttpError(
      withSheetApiDetail(
        `Google Sheet 범위 '${range}'가 올바르지 않습니다. 탭 이름이 맞는지, 해당 범위가 append 가능한 상태인지 확인해 주세요.`,
        detail,
      ),
      400,
      "SHEET_RANGE_INVALID",
    );
  }

  if (statusCode === 401) {
    throw createHttpError(
      withSheetApiDetail("Google Sheets 인증이 만료되었습니다. 다시 로그인해 주세요.", detail),
      401,
      "SHEET_AUTH_FAILED",
    );
  }

  if (statusCode === 403) {
    if (hasReasonLike(detail, /protected/i)) {
      throw createHttpError(
        withSheetApiDetail(
          `Google Sheet 범위 '${range}'가 보호되어 있어 저장할 수 없습니다. Sheet 탭 또는 해당 범위의 보호 설정을 확인해 주세요.`,
          detail,
        ),
        403,
        "SHEET_RANGE_PROTECTED",
      );
    }

    throw createHttpError(
      withSheetApiDetail(
        "현재 Google 계정에 합격자 Sheet를 수정할 권한이 없습니다. 관리자에게 시트 편집 권한을 요청해 주세요.",
        detail,
      ),
      403,
      "SHEET_APPEND_ACCESS_DENIED",
    );
  }

  if (statusCode === 404) {
    throw createHttpError(
      withSheetApiDetail("설정된 합격자 Google Sheet를 찾을 수 없습니다.", detail),
      404,
      "SHEET_NOT_FOUND",
    );
  }

  if (statusCode && statusCode >= 400 && statusCode < 600) {
    throw createHttpError(
      withSheetApiDetail("Google Sheets 저장 요청이 실패했습니다.", detail),
      statusCode,
      "SHEET_APPEND_FAILED",
    );
  }

  throw error;
};

const withSheetTimeout = <T>(operation: (requestOptions: UpstreamRequestOptions) => Promise<T>) =>
  withUpstreamTimeout(operation, {
    message: "Google Sheets response timed out.",
    code: "SHEET_TIMEOUT",
  });
