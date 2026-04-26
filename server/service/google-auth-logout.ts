import {
  OAUTH_SESSION_COOKIE,
  clearOAuthCookie,
} from "./oauth-session.ts";
import { usesSecureOrigin } from "../config.ts";

const LEGACY_OAUTH_TOKEN_COOKIE = "greensum_oauth_tokens";

interface GoogleAuthLogoutResult {
  body: {
    authenticated: false;
    message: string;
  };
  cookies: string[];
}

export const logoutGoogleAuth = (): GoogleAuthLogoutResult => {
  const cookieOptions = { secure: usesSecureOrigin() };

  return {
    body: {
      authenticated: false,
      message: "로그아웃되었습니다.",
    },
    cookies: [
      clearOAuthCookie(OAUTH_SESSION_COOKIE, cookieOptions),
      clearOAuthCookie(LEGACY_OAUTH_TOKEN_COOKIE, cookieOptions),
    ],
  };
};
