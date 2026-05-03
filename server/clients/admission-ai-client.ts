import { GoogleGenAI, Type } from "@google/genai";
import { getRuntimeEnv } from "../config.ts";
import { createHttpError } from "../shared/http.ts";
import type { UploadedFile } from "../shared/types.ts";
import { withUpstreamTimeout } from "../shared/upstream.ts";

export interface AdmissionInfo {
  name: string;
  university: string;
  college: string;
  department: string;
  admissionType: string;
  examineeNumber: string;
}

const getGeminiApiKey = () => {
  const apiKey = getRuntimeEnv("GEMINI_API_KEY");

  if (!apiKey) {
    throw createHttpError(
      "GEMINI_API_KEY is not configured.",
      500,
      "MISSING_GEMINI_API_KEY",
    );
  }

  return apiKey;
};

const fileToGenerativePart = (file: UploadedFile) => ({
  inlineData: {
    data: file.buffer.toString("base64"),
    mimeType: file.mimeType || "image/jpeg",
  },
});

const toText = (value: unknown) => String(value ?? "").trim();

const normalizeAdmissionInfo = (input: unknown): AdmissionInfo => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createHttpError("AI response body is invalid.", 502, "INVALID_AI_RESPONSE_BODY");
  }

  const body = input as Record<string, unknown>;

  return {
    name: toText(body.name),
    university: toText(body.university),
    college: toText(body.college),
    department: toText(body.department),
    admissionType: toText(body.admissionType),
    examineeNumber: toText(body.examineeNumber),
  };
};

export const extractAdmissionInfoFromCertificate = async (file: UploadedFile) => {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  const response = await withUpstreamTimeout(
    ({ signal, timeout }) =>
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              fileToGenerativePart(file),
              {
                text: [
                  "대학 합격증 이미지에서 다음 정보를 추출해 주세요.",
                  "학생 이름(name), 합격 대학(university), 단과대학구분(college), 합격 학과(department), 지원 전형(admissionType), 수험번호(examineeNumber).",
                  "반드시 JSON 형식으로만 응답해 주세요.",
                ].join("\n"),
              },
            ],
          },
        ],
        config: {
          abortSignal: signal,
          httpOptions: {
            timeout,
          },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              university: { type: Type.STRING },
              college: { type: Type.STRING },
              department: { type: Type.STRING },
              admissionType: { type: Type.STRING },
              examineeNumber: { type: Type.STRING },
            },
            required: [
              "name",
              "university",
              "college",
              "department",
              "admissionType",
              "examineeNumber",
            ],
          },
        },
      }),
    {
      message: "Admission certificate AI extraction timed out.",
      code: "ADMISSION_AI_TIMEOUT",
    },
  );

  if (!response.text) {
    throw createHttpError("AI response was empty.", 502, "EMPTY_AI_RESPONSE");
  }

  try {
    return normalizeAdmissionInfo(JSON.parse(response.text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw createHttpError("AI response was not valid JSON.", 502, "INVALID_AI_JSON");
    }

    throw error;
  }
};
