import type { Context } from "hono";
import type { OAuth2Client } from "google-auth-library";
import type { DriveClient } from "./clients/google-drive-client.ts";
import type { GoogleSheetClient } from "./clients/google-sheet-client.ts";
import type { OAuthSession } from "./service/oauth-session.ts";
import { createHttpError } from "./shared/http.ts";

export interface ApiHonoVariables {
  drive?: DriveClient;
  oauth2Client?: OAuth2Client;
  session?: OAuthSession;
  sheets?: GoogleSheetClient;
}

export interface ApiHonoEnv {
  Variables: ApiHonoVariables;
}

export type ApiHonoContext = Context<ApiHonoEnv>;

export const requireContextValue = <Key extends keyof ApiHonoVariables>(
  context: ApiHonoContext,
  key: Key,
): NonNullable<ApiHonoVariables[Key]> => {
  const value = context.get(key);

  if (value == null) {
    throw createHttpError(
      `Required API context "${String(key)}" is not available.`,
      500,
      "MISSING_API_CONTEXT",
    );
  }

  return value as NonNullable<ApiHonoVariables[Key]>;
};

export const requireDrive = (context: ApiHonoContext) =>
  requireContextValue(context, "drive");

export const requireSheets = (context: ApiHonoContext) =>
  requireContextValue(context, "sheets");
