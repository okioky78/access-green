import { createMiddleware } from "hono/factory";
import type { ApiHonoEnv } from "../hono-context.ts";
import { getAllowedOrigins } from "../config.ts";
import { validateAllowedOrigin } from "../shared/app-security.ts";

const originProtectedMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const allowedOriginMiddleware = createMiddleware<ApiHonoEnv>(async (context, next) => {
  if (originProtectedMethods.has(context.req.method)) {
    validateAllowedOrigin(context.req.raw, getAllowedOrigins());
  }

  await next();
});
