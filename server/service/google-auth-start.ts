import { createOAuthStart } from "./oauth-session.ts";
import { usesSecureOrigin } from "../config.ts";

interface GoogleAuthRedirectResult {
  redirectUrl: string;
  cookies: string[];
}

export const startGoogleAuth = (): GoogleAuthRedirectResult => {
  const { authorizationUrl, stateCookie } = createOAuthStart({
    secure: usesSecureOrigin(),
  });

  return {
    redirectUrl: authorizationUrl,
    cookies: [stateCookie],
  };
};
