import {
  OAUTH_SESSION_COOKIE,
  OAUTH_STATE_COOKIE,
  clearOAuthCookie,
  createOAuthSessionFromCallback,
  createSessionCookie,
} from "./oauth-session.ts";
import { getAuthRedirectUrl, usesSecureOrigin } from "../config.ts";

const LEGACY_OAUTH_TOKEN_COOKIE = "greensum_oauth_tokens";

interface GoogleAuthRedirectResult {
  redirectUrl: string;
  cookies: string[];
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Google 로그인 처리 중 오류가 발생했습니다.";

export const handleGoogleAuthCallback = async (
  request: Request,
): Promise<GoogleAuthRedirectResult> => {
  const cookieOptions = { secure: usesSecureOrigin() };

  try {
    const session = await createOAuthSessionFromCallback(request);

    return {
      redirectUrl: getAuthRedirectUrl("auth=success"),
      cookies: [
        createSessionCookie(session, cookieOptions),
        clearOAuthCookie(OAUTH_STATE_COOKIE, cookieOptions),
        clearOAuthCookie(LEGACY_OAUTH_TOKEN_COOKIE, cookieOptions),
      ],
    };
  } catch (error) {
    const message = encodeURIComponent(getErrorMessage(error));

    return {
      redirectUrl: getAuthRedirectUrl(`authError=${message}`),
      cookies: [
        clearOAuthCookie(OAUTH_STATE_COOKIE, cookieOptions),
        clearOAuthCookie(OAUTH_SESSION_COOKIE, cookieOptions),
        clearOAuthCookie(LEGACY_OAUTH_TOKEN_COOKIE, cookieOptions),
      ],
    };
  }
};
