import { createHttpError } from "./http.ts";

export const DEFAULT_UPSTREAM_TIMEOUT_MS = 25_000;

interface UpstreamTimeoutOptions {
  timeoutMs?: number;
  message?: string;
  code?: string;
}

export interface UpstreamRequestOptions {
  signal: AbortSignal;
  timeout: number;
}

type UpstreamOperation<T> = Promise<T> | ((requestOptions: UpstreamRequestOptions) => Promise<T>);

export const withUpstreamTimeout = <T>(
  operation: UpstreamOperation<T>,
  {
    timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS,
    message = "외부 서비스 응답 시간이 초과되었습니다.",
    code = "UPSTREAM_TIMEOUT",
  }: UpstreamTimeoutOptions = {},
) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  const abortController = new AbortController();
  const activeOperation =
    typeof operation === "function"
      ? operation({ signal: abortController.signal, timeout: timeoutMs })
      : operation;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      abortController.abort();
      reject(createHttpError(message, 504, code));
    }, timeoutMs);
  });

  return Promise.race([activeOperation, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
};
