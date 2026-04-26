import crypto from "crypto";
import type { Credentials, OAuth2Client } from "google-auth-library";
import {
  createGoogleAuthorizationUrl,
  createOAuth2Client,
  exchangeGoogleAuthCode,
  getOAuthConfig,
  refreshGoogleAccessToken,
  verifyGoogleIdToken,
  type OAuthConfig,
} from "../clients/google-oauth-client.ts";
import {
  createHttpError,
  getHeader,
  getRequestCookies,
  parseCookies,
  serializeCookie,
} from "../shared/http.ts";

export const OAUTH_SESSION_COOKIE = "greensum_oauth_session";
export const OAUTH_STATE_COOKIE = "greensum_oauth_state";

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_ABSOLUTE_MAX_AGE_MS = 30 * DAY_MS;
const SESSION_IDLE_TIMEOUT_MS = 7 * DAY_MS;
const SESSION_TOUCH_INTERVAL_MS = 10 * 60 * 1000;
const STATE_MAX_AGE_SECONDS = 60 * 10;
const TOKEN_REFRESH_SKEW_MS = 60 * 1000;

export interface OAuthSessionUser {
  googleSubject: string;
  email: string;
  name: string;
}

export type OAuthSessionTokens = Credentials & {
  refresh_token: string;
};

export interface OAuthSession {
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number;
  user: OAuthSessionUser;
  tokens: OAuthSessionTokens;
}

export interface AuthenticatedOAuthContext {
  oauth2Client: OAuth2Client;
  session: OAuthSession;
  sessionRefreshCookie?: string;
}

export interface OAuthCookieOptions {
  secure: boolean;
}

const getEncryptionKey = (secret: string) => crypto.createHash("sha256").update(secret).digest();

const encryptSession = (session: OAuthSession, secret: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
};

const decryptSession = (value: string | undefined, secret: string): OAuthSession | null => {
  if (!value) return null;

  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) return null;

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(secret),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8")) as OAuthSession;
};

const createCookieOptions = (maxAge: number, { secure }: OAuthCookieOptions) => ({
  httpOnly: true,
  secure,
  sameSite: "Lax" as const,
  path: "/",
  maxAge,
});

export const createStateCookie = (state: string, cookieOptions: OAuthCookieOptions) =>
  serializeCookie(OAUTH_STATE_COOKIE, state, createCookieOptions(STATE_MAX_AGE_SECONDS, cookieOptions));

export const createSessionCookie = (
  session: OAuthSession,
  cookieOptions: OAuthCookieOptions,
  config = getOAuthConfig(),
) =>
  serializeCookie(
    OAUTH_SESSION_COOKIE,
    encryptSession(session, config.cookieSecret),
    createCookieOptions(SESSION_MAX_AGE_SECONDS, cookieOptions),
  );

export const clearOAuthCookie = (name: string, { secure }: OAuthCookieOptions) =>
  serializeCookie(name, "", {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });

export const createOAuthStart = (cookieOptions: OAuthCookieOptions) => {
  const config = getOAuthConfig();
  const oauth2Client = createOAuth2Client(config);
  const state = crypto.randomBytes(32).toString("base64url");
  const authorizationUrl = createGoogleAuthorizationUrl(oauth2Client, state);

  return {
    authorizationUrl,
    stateCookie: createStateCookie(state, cookieOptions),
  };
};

export const readOAuthSession = (request: Request, config = getOAuthConfig()) => {
  const cookies = getRequestCookies(request);

  try {
    return decryptSession(cookies[OAUTH_SESSION_COOKIE], config.cookieSecret);
  } catch {
    return null;
  }
};

const isValidTimestamp = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const getSessionLastUsedAt = (session: OAuthSession) => {
  if (isValidTimestamp(session.lastUsedAt)) return session.lastUsedAt;
  if (isValidTimestamp(session.updatedAt)) return session.updatedAt;
  return session.createdAt;
};

const createSessionExpiredError = (
  message: string,
  code: string,
  cookieOptions: OAuthCookieOptions,
) => {
  const error = createHttpError(message, 401, code);
  error.clearSessionCookie = clearOAuthCookie(OAUTH_SESSION_COOKIE, cookieOptions);
  return error;
};

const validateSessionLifetime = (
  session: OAuthSession,
  cookieOptions: OAuthCookieOptions,
  now = Date.now(),
) => {
  if (!isValidTimestamp(session.createdAt)) {
    throw createSessionExpiredError(
      "Google 세션 정보를 확인할 수 없습니다. 다시 로그인해 주세요.",
      "INVALID_SESSION_CREATED_AT",
      cookieOptions,
    );
  }

  if (now - session.createdAt > SESSION_ABSOLUTE_MAX_AGE_MS) {
    throw createSessionExpiredError(
      "Google 세션이 만료되었습니다. 다시 로그인해 주세요.",
      "SESSION_ABSOLUTE_EXPIRED",
      cookieOptions,
    );
  }

  if (now - getSessionLastUsedAt(session) > SESSION_IDLE_TIMEOUT_MS) {
    throw createSessionExpiredError(
      "오랫동안 사용하지 않아 Google 세션이 만료되었습니다. 다시 로그인해 주세요.",
      "SESSION_IDLE_EXPIRED",
      cookieOptions,
    );
  }
};

const shouldTouchSession = (session: OAuthSession, now = Date.now()) =>
  now - getSessionLastUsedAt(session) >= SESSION_TOUCH_INTERVAL_MS;

const createSessionUserFromIdToken = async (
  oauth2Client: OAuth2Client,
  idToken: string | null | undefined,
  config: OAuthConfig,
): Promise<OAuthSessionUser> => {
  if (!idToken) {
    throw createHttpError("Google ID token이 없습니다. 다시 로그인해 주세요.", 401, "MISSING_ID_TOKEN");
  }

  const ticket = await verifyGoogleIdToken(oauth2Client, idToken, config.clientId);
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw createHttpError(
      "Google 로그인 사용자 정보를 확인하지 못했습니다.",
      401,
      "INVALID_ID_TOKEN",
    );
  }

  return {
    googleSubject: payload.sub,
    email: payload.email,
    name: payload.name || "",
  };
};

export const createOAuthSessionFromCallback = async (
  request: Request,
): Promise<OAuthSession> => {
  const config = getOAuthConfig();
  const params = new URL(request.url).searchParams;
  const cookies = parseCookies(getHeader(request.headers, "cookie"));
  const expectedState = cookies[OAUTH_STATE_COOKIE];
  const oauthError = params.get("error");
  const state = params.get("state");
  const code = params.get("code");

  if (oauthError) {
    throw createHttpError(`Google 로그인이 취소되었습니다. ${oauthError}`, 400, "OAUTH_DENIED");
  }

  if (!state || !expectedState || state !== expectedState) {
    throw createHttpError("OAuth state가 일치하지 않습니다.", 400, "INVALID_OAUTH_STATE");
  }

  if (!code) {
    throw createHttpError("OAuth authorization code가 없습니다.", 400, "MISSING_AUTH_CODE");
  }

  const oauth2Client = createOAuth2Client(config);
  const { tokens } = await exchangeGoogleAuthCode(oauth2Client, code);
  const user = await createSessionUserFromIdToken(oauth2Client, tokens.id_token, config);
  const previousSession = readOAuthSession(request, config);
  const previousRefreshToken =
    previousSession?.user?.googleSubject === user.googleSubject
      ? previousSession?.tokens?.refresh_token
      : null;
  const refreshToken = tokens.refresh_token || previousRefreshToken;

  if (!refreshToken) {
    throw createHttpError(
      "Google 동의 화면을 통해 다시 로그인해 주세요.",
      401,
      "MISSING_REFRESH_TOKEN",
    );
  }

  const now = Date.now();

  return {
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    user,
    tokens: {
      access_token: tokens.access_token,
      refresh_token: refreshToken,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope,
      token_type: tokens.token_type,
    },
  };
};

export const getAuthenticatedOAuthClient = async (
  request: Request,
  cookieOptions: OAuthCookieOptions,
): Promise<AuthenticatedOAuthContext> => {
  const config = getOAuthConfig();
  const session = readOAuthSession(request, config);
  const storedTokens = session?.tokens;

  if (!storedTokens?.refresh_token) {
    throw createHttpError("Google 로그인이 필요합니다.", 401, "AUTH_REQUIRED");
  }

  if (!session?.user?.googleSubject) {
    throw createHttpError(
      "Google 로그인 사용자 정보가 없습니다. 다시 로그인해 주세요.",
      401,
      "MISSING_GOOGLE_IDENTITY",
    );
  }

  const now = Date.now();
  validateSessionLifetime(session, cookieOptions, now);

  const oauth2Client = createOAuth2Client(config);
  let refreshedTokens: OAuthSessionTokens | null = null;

  oauth2Client.on("tokens", (nextTokens) => {
    refreshedTokens = {
      ...storedTokens,
      ...nextTokens,
      refresh_token: nextTokens.refresh_token || storedTokens.refresh_token,
    };
  });

  oauth2Client.setCredentials(storedTokens);

  try {
    const expiryDate = storedTokens.expiry_date || 0;
    if (expiryDate <= now + TOKEN_REFRESH_SKEW_MS) {
      await refreshGoogleAccessToken(oauth2Client);
    }
  } catch (error) {
    const authError = error as { code?: string };
    if (authError.code === "GOOGLE_AUTH_TIMEOUT") {
      throw error;
    }

    throw createSessionExpiredError(
      "Google 세션이 만료되었습니다. 다시 로그인해 주세요.",
      "SESSION_REFRESH_FAILED",
      cookieOptions,
    );
  }

  const shouldRefreshCookie = Boolean(refreshedTokens) || shouldTouchSession(session, now);
  const nextSession: OAuthSession = {
    ...session,
    updatedAt: shouldRefreshCookie ? now : session.updatedAt,
    lastUsedAt: shouldRefreshCookie ? now : getSessionLastUsedAt(session),
    tokens: refreshedTokens || storedTokens,
  };
  const sessionRefreshCookie = shouldRefreshCookie
    ? createSessionCookie(nextSession, cookieOptions, config)
    : undefined;

  return { oauth2Client, session: nextSession, sessionRefreshCookie };
};
