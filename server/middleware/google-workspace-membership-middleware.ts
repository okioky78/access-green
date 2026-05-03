import { createMiddleware } from "hono/factory";
import type { ApiHonoEnv } from "../hono-context.ts";
import { createDriveClient } from "../clients/google-drive-client.ts";
import { createGoogleSheetClient } from "../clients/google-sheet-client.ts";
import { usesSecureOrigin } from "../config.ts";
import { getAuthenticatedOAuthClient } from "../service/oauth-session.ts";

export const googleWorkspaceMembershipMiddleware = createMiddleware<ApiHonoEnv>(
  async (context, next) => {
    const secure = usesSecureOrigin();
    const auth = await getAuthenticatedOAuthClient(context.req.raw, {
      secure,
    });

    const drive = createDriveClient(auth.oauth2Client);
    const sheets = createGoogleSheetClient(auth.oauth2Client);

    context.set("oauth2Client", auth.oauth2Client);
    context.set("session", auth.session);
    context.set("drive", drive);
    context.set("sheets", sheets);

    await next();

    if (auth.sessionRefreshCookie) {
      context.res.headers.append("Set-Cookie", auth.sessionRefreshCookie);
    }
  },
);
