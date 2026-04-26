import { createHttpError, getHeader } from "./http.ts";

export const validateAllowedOrigin = (
  request: Request,
  allowedOrigins: readonly string[],
) => {
  const origin = getHeader(request.headers, "origin");
  const referer = getHeader(request.headers, "referer");
  let requestOrigin = origin;

  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
      requestOrigin = "";
    }
  }

  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    throw createHttpError("허용되지 않은 요청 출처입니다.", 403, "INVALID_ORIGIN");
  }
};
