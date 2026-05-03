import type { Config, Context } from "@netlify/functions";
import apiApp from "../../server/api-app.ts";

export default async (request: Request, _context: Context) => apiApp.fetch(request);

export const config: Config = {
  path: "/api/*",
};
