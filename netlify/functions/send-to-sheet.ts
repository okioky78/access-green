import type { Handler } from "@netlify/functions";
import { google } from "googleapis";

export const handler: Handler = async (event) => {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  try {

    const body = JSON.parse(event.body || "{}");

    const {
      name,
      university,
      college,
      department,
      admissionType,
      examineeNumber
    } = body;

    const spreadsheetId = "1LjYs9rHD-IErczSdL6Ld9thqLHxVBqU9iQXg7DkUfog";

    const clientEmail =
      (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
        process.env.GOOGLE_SERVICE_ACCOUNT ||
        "").trim();

    const privateKey =
      (process.env.GOOGLE_PRIVATE_KEY || "")
        .replace(/\\n/g, "\n")
        .trim();

    if (!clientEmail || !privateKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Google credentials missing"
        })
      };
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({
      version: "v4",
      auth
    });

    const values = [[
      name,
      university,
      college,
      department,
      admissionType,
      examineeNumber
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A:F",
      valueInputOption: "USER_ENTERED",
      requestBody: { values }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error: any) {

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };

  }

};
