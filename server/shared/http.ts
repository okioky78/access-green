export class HttpError extends Error {
  statusCode: number;
  code: string;
  clearSessionCookie?: string;

  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const createHttpError = (message: string, statusCode = 500, code = "INTERNAL_ERROR") =>
  new HttpError(message, statusCode, code);

export const jsonResponse = (
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

export const jsonResponseWithCookies = (
  statusCode: number,
  body: unknown,
  cookies: string[] = [],
): Response => {
  const response = jsonResponse(statusCode, body);
  cookies.forEach((cookie) => response.headers.append("Set-Cookie", cookie));

  return response;
};

export const redirectResponse = (location: string, cookies: string[] = []): Response => {
  const response = new Response(null, {
    status: 302,
    headers: {
      Location: location,
    },
  });

  cookies.forEach((cookie) => response.headers.append("Set-Cookie", cookie));

  return response;
};

type HeaderSource = Headers | Record<string, string | string[] | undefined> | undefined;

export const getHeader = (headers: HeaderSource, headerName: string) => {
  if (headers instanceof Headers) {
    return headers.get(headerName) || "";
  }

  const target = headerName.toLowerCase();

  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === target) {
      return Array.isArray(value) ? value[0] : value || "";
    }
  }

  return "";
};

export const parseCookies = (cookieHeader = ""): Record<string, string> =>
  cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) return cookies;

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        return cookies;
      }

      return cookies;
    }, {} as Record<string, string>);

interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
  maxAge?: number;
}

export const serializeCookie = (name: string, value: string, options: CookieOptions = {}) => {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  return parts.join("; ");
};

export const getRequestCookies = (request: Request) =>
  parseCookies(getHeader(request.headers, "cookie"));

export const methodNotAllowed = () => jsonResponse(405, { error: "Method Not Allowed" });

const getRequestLogContext = (request?: Request) => {
  if (!request) return {};

  return {
    method: request.method,
    path: new URL(request.url).pathname,
  };
};

export const errorResponse = (error: unknown, request?: Request) => {
  if (error instanceof HttpError) {
    const headers: Record<string, string> | undefined = error.clearSessionCookie
      ? { "Set-Cookie": error.clearSessionCookie }
      : undefined;

    return jsonResponse(
      error.statusCode,
      {
        error: error.message,
        code: error.code,
      },
      headers,
    );
  }

  console.error("Unhandled API error", {
    ...getRequestLogContext(request),
    error,
  });

  return jsonResponse(500, {
    error: "요청 처리 중 오류가 발생했습니다.",
    code: "INTERNAL_ERROR",
  });
};
