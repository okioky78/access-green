import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileText,
  Loader2,
  RotateCcw,
  Send,
  Upload,
} from "lucide-react";

interface ExtractedData {
  name: string;
  university: string;
  college: string;
  department: string;
  admissionType: string;
  examineeNumber: string;
}

interface ApiErrorBody {
  error?: unknown;
  code?: unknown;
}

class ApiResponseError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiResponseError";
    this.status = status;
    this.code = code;
  }
}

const admittedApplicantsSpreadsheetId =
  process.env.GOOGLE_ADMITTED_APPLICANTS_SPREADSHEET_ID;

const authRecoveryErrorCodes = new Set([
  "AUTH_REQUIRED",
  "INVALID_SESSION_CREATED_AT",
  "MISSING_GOOGLE_IDENTITY",
  "SESSION_ABSOLUTE_EXPIRED",
  "SESSION_IDLE_EXPIRED",
  "SESSION_REFRESH_FAILED",
]);

const readApiError = async (response: Response, fallback: string) => {
  let body: ApiErrorBody = {};

  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {}

  const message = typeof body.error === "string" && body.error ? body.error : fallback;
  const code = typeof body.code === "string" ? body.code : undefined;

  return new ApiResponseError(message, response.status, code);
};

const isAuthRecoveryError = (error: unknown) =>
  error instanceof ApiResponseError &&
  (error.status === 401 || Boolean(error.code && authRecoveryErrorCodes.has(error.code)));

const getApiErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const redirectToGoogleAuthIfNeeded = (error: unknown) => {
  if (!isAuthRecoveryError(error)) return false;

  window.location.assign("/api/google-auth-start");
  return true;
};

const readAndClearAuthRedirectState = () => {
  const params = new URLSearchParams(window.location.search);
  const authError = params.get("authError");
  const authSuccess = params.get("auth") === "success";

  if (!authError && !authSuccess) return null;

  params.delete("authError");
  params.delete("auth");

  const query = params.toString();
  const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, document.title, cleanUrl);

  return { authError, authSuccess };
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [data, setData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const authRedirectState = readAndClearAuthRedirectState();
    if (!authRedirectState) return;

    if (authRedirectState.authError) {
      setError(authRedirectState.authError);
      setSuccess(null);
      return;
    }

    if (authRedirectState.authSuccess) {
      setError(null);
      setSuccess("Google 로그인이 완료되었습니다.");
    }
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setSuccess(null);
    setData(null);

    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  const handleExtract = async () => {
    if (!file) return;

    setIsExtracting(true);
    setError(null);
    setData(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/extract-admission-info", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw await readApiError(response, "정보 추출에 실패했습니다.");
      }

      setData(await response.json());
    } catch (err) {
      console.error("Extraction error:", err);
      setError(getApiErrorMessage(err, "정보 추출에 실패했습니다."));
      redirectToGoogleAuthIfNeeded(err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSendToSheet = async () => {
    if (!data || !file) return;

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      const response = await fetch("/api/send-to-sheet", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw await readApiError(response, "구글 시트 전송에 실패했습니다.");
      }

      setSuccess("합격자 명단 시트에 이미지와 정보가 저장되었습니다.");
    } catch (err) {
      setError(getApiErrorMessage(err, "구글 시트 전송에 실패했습니다."));
      redirectToGoogleAuthIfNeeded(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setIsExtracting(false);
    setIsSending(false);
    setData(null);
    setError(null);
    setSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold tracking-tight mb-4"
          >
            대학 합격 정보 추출기
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-neutral-500"
          >
            합격증 이미지를 업로드하여 정보를 추출하고 구글 시트로 전송하세요.
          </motion.p>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="space-y-6">
            <div
              className={`relative border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                file
                  ? "border-emerald-200 bg-emerald-50/30"
                  : "border-neutral-200 hover:border-neutral-300 bg-white shadow-sm"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
              />

              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-64 rounded-lg shadow-md mb-4 object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : file ? (
                <div className="p-12 bg-white rounded-xl shadow-sm mb-4">
                  <FileText className="w-16 h-16 text-neutral-400" />
                  <p className="mt-2 text-sm font-medium">{file.name}</p>
                </div>
              ) : (
                <div className="py-12">
                  <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-neutral-400" />
                  </div>
                  <p className="text-sm font-medium">파일을 선택하거나 드래그하세요</p>
                  <p className="text-xs text-neutral-400 mt-1">PNG, JPG, WEBP, HEIC</p>
                </div>
              )}
            </div>

            <button
              onClick={handleExtract}
              disabled={!file || isExtracting}
              className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                !file || isExtracting
                  ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                  : "bg-neutral-900 text-white hover:bg-neutral-800 shadow-lg shadow-neutral-200"
              }`}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  정보 추출 중...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  정보 추출하기
                </>
              )}
            </button>
          </section>

          <section className="space-y-6">
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-neutral-100 min-h-[300px] flex flex-col">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Database className="w-5 h-5 text-neutral-400" />
                추출된 정보
              </h2>

              <AnimatePresence mode="wait">
                {data ? (
                  <motion.div
                    key="data"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4 flex-grow"
                  >
                    {[
                      { label: "학생 이름", value: data.name },
                      { label: "수험 번호", value: data.examineeNumber },
                      { label: "합격 대학", value: data.university },
                      { label: "단과 대학", value: data.college },
                      { label: "합격 학과", value: data.department },
                      { label: "지원 전형", value: data.admissionType },
                    ].map((item) => (
                      <div key={item.label} className="border-b border-neutral-50 pb-3 last:border-0">
                        <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold mb-1">
                          {item.label}
                        </p>
                        <p className="text-lg font-medium text-neutral-800">
                          {item.value || "-"}
                        </p>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-grow flex flex-col items-center justify-center text-center text-neutral-400"
                  >
                    <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mb-3">
                      <Database className="w-6 h-6" />
                    </div>
                    <p className="text-sm">
                      합격증을 분석하면
                      <br />
                      여기에 정보가 표시됩니다.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {data && (
                <div className="mt-8 space-y-3">
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={handleSendToSheet}
                    disabled={isSending}
                    className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                      isSending
                        ? "bg-emerald-100 text-emerald-400 cursor-not-allowed"
                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100"
                    }`}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        전송 중...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        구글 시트로 전송
                      </>
                    )}
                  </motion.button>

                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onClick={handleReset}
                    className="w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 text-neutral-500 hover:bg-neutral-50 transition-all border border-neutral-200"
                  >
                    <RotateCcw className="w-5 h-5" />
                    처음으로
                  </motion.button>
                </div>
              )}
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start gap-3 border border-red-100"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{error}</p>
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-emerald-50 text-emerald-600 p-4 rounded-xl flex items-start gap-3 border border-emerald-100"
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{success}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </main>

        <footer className="mt-16 pt-8 border-t border-neutral-100 text-center text-xs text-neutral-400">
          <p>© 2024 대학 합격 정보 추출기. Gemini AI 기술을 사용합니다.</p>
          {admittedApplicantsSpreadsheetId && (
            <p className="mt-2">
              구글 시트:{" "}
              <a
                href={`https://docs.google.com/spreadsheets/d/${admittedApplicantsSpreadsheetId}/edit`}
                target="_blank"
                className="underline hover:text-neutral-600"
              >
                연결된 시트 보기
              </a>
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
