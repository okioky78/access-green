import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// API: Send data to Google Sheets
app.post("/api/send-to-sheet", async (req, res) => {
  try {
    const { name, university, college, department, admissionType, examineeNumber } = req.body;
    const spreadsheetId = "1LjYs9rHD-IErczSdL6Ld9thqLHxVBqU9iQXg7DkUfog";

    const clientEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT || "").trim();
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();

    if (!clientEmail || !privateKey) {
      return res.status(400).json({ 
        error: "Google Sheets API credentials are not configured. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in your secrets." 
      });
    }

    try {
      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      
      const sheets = google.sheets({ version: "v4", auth });
      
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "A:F",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[name, examineeNumber, university, college, department, admissionType]],
        },
      });
    } catch (sheetError: any) {
      console.error("Sheet error:", sheetError);
      if (sheetError.message.includes("range")) {
        return res.status(400).json({ error: "구글 시트의 'Sheet1' 또는 첫 번째 시트를 찾을 수 없습니다." });
      }
      return res.status(500).json({ error: "구글 시트 전송 실패: " + sheetError.message });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("General error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware for development
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
