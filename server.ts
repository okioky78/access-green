import express, {
  type Request as ExpressRequest,
  type Response as ExpressResponse,
} from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import apiApp from "./server/api-app.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const createFetchRequest = (req: ExpressRequest) => {
  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else if (value !== undefined) {
      headers.set(key, String(value));
    }
  }

  const method = req.method.toUpperCase();
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = req as unknown as BodyInit;
    init.duplex = "half";
  }

  return new Request(url, init);
};

const sendFetchResponse = async (res: ExpressResponse, response: Response) => {
  res.status(response.status);
  const setCookieHeaders =
    "getSetCookie" in response.headers
      ? (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : [];

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie" && setCookieHeaders.length) {
      return;
    }

    res.append(key, value);
  });
  setCookieHeaders.forEach((cookie) => res.append("set-cookie", cookie));

  const body = Buffer.from(await response.arrayBuffer());
  res.send(body);
};

app.all("/api/*", async (req, res, next) => {
  try {
    const response = await apiApp.fetch(createFetchRequest(req));

    await sendFetchResponse(res, response);
  } catch (error) {
    next(error);
  }
});

if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static("dist"));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "dist", "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
