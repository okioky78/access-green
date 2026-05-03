import axios from "axios";

export type ApiErrorBody = {
  error?: string;
  code?: string;
};

export const apiClient = axios.create({
  baseURL: "/api",
});

export const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error || error.message || fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
};

const authRecoveryErrorCodes = new Set([
  "AUTH_REQUIRED",
  "DRIVE_AUTH_FAILED",
  "INVALID_SESSION_CREATED_AT",
  "MISSING_GOOGLE_IDENTITY",
  "SESSION_ABSOLUTE_EXPIRED",
  "SESSION_IDLE_EXPIRED",
  "SESSION_REFRESH_FAILED",
  "SHEET_AUTH_FAILED",
]);

export const isAuthRequiredError = (error: unknown) => {
  if (!axios.isAxiosError<ApiErrorBody>(error)) return false;

  const status = error.response?.status;
  const code = error.response?.data?.code;

  return status === 401 || Boolean(code && authRecoveryErrorCodes.has(code));
};
