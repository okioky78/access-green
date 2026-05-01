import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";

import { getApiErrorMessage, isAuthRequiredError } from "../../shared/api";
import {
  extractAdmissionInfo,
  saveAdmissionToSheet,
  type AdmissionInfo,
  type AdmissionSheetSaveResponse,
} from "./api/admissionSheetApi";
import { useGoogleConnection } from "./hooks/useGoogleConnection";
import { useImageSelection } from "./hooks/useImageSelection";
import { AdmissionInfoCard } from "./ui/AdmissionInfoCard";
import { AdmissionSheetLayout } from "./ui/AdmissionSheetLayout";
import { FeedbackMessages } from "./ui/FeedbackMessages";
import { LoginRequiredUploadGate } from "./ui/LoginRequiredUploadGate";
import { PageFooter } from "./ui/PageFooter";
import { UploadDropzone } from "./ui/UploadDropzone";

export const AdmissionSheetUploadPage = () => {
  const imageSelection = useImageSelection();
  const [data, setData] = useState<AdmissionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<AdmissionSheetSaveResponse | null>(null);

  const googleConnection = useGoogleConnection({
    onError: (nextError) => {
      setError(nextError);
      setMessage(null);
      setSuccess(null);
    },
    onSuccess: (nextMessage) => {
      setError(null);
      setMessage(nextMessage);
      setSuccess(null);
    },
  });

  const { mutate: runExtraction, isPending: isExtracting } = useMutation({
    mutationFn: extractAdmissionInfo,
  });

  const { mutate: runSave, isPending: isSaving } = useMutation({
    mutationFn: saveAdmissionToSheet,
  });

  const clearFeedback = () => {
    setError(null);
    setMessage(null);
    setSuccess(null);
  };

  const handleAuthError = (apiError: unknown) => {
    if (!isAuthRequiredError(apiError)) return;

    googleConnection.clearAuthenticatedState();
  };

  const selectFile = (selectedFile: File) => {
    imageSelection.selectImage(selectedFile);
    setData(null);
    clearFeedback();
  };

  const rejectFile = (reason: string) => {
    setData(null);
    setMessage(null);
    setSuccess(null);
    setError(reason);
  };

  const handleExtract = () => {
    if (!imageSelection.file) return;

    if (!googleConnection.isAuthenticated) {
      setError("Google 로그인 후 정보를 추출할 수 있습니다.");
      return;
    }

    clearFeedback();

    runExtraction(imageSelection.file, {
      onSuccess: (nextData) => {
        setData(nextData);
      },
      onError: (apiError) => {
        handleAuthError(apiError);
        setError(getApiErrorMessage(apiError, "정보 추출에 실패했습니다."));
      },
    });
  };

  const handleSave = () => {
    if (!imageSelection.file || !data) return;

    if (!googleConnection.isAuthenticated) {
      setError("Google 로그인 후 저장할 수 있습니다.");
      return;
    }

    clearFeedback();

    runSave(
      {
        file: imageSelection.file,
        data,
      },
      {
        onSuccess: (saveResult) => {
          setSuccess(saveResult);
        },
        onError: (apiError) => {
          handleAuthError(apiError);
          setError(getApiErrorMessage(apiError, "구글 시트 전송에 실패했습니다."));
        },
      },
    );
  };

  const handleReset = () => {
    imageSelection.resetImage();
    setData(null);
    clearFeedback();
  };

  const isBusy = isExtracting || isSaving;
  const canExtract = Boolean(imageSelection.file && googleConnection.isAuthenticated && !isBusy);
  const canSave = Boolean(imageSelection.file && data && googleConnection.isAuthenticated && !isBusy);
  const saveRequirementMessage = getSaveRequirementMessage({
    hasData: Boolean(data),
    hasFile: Boolean(imageSelection.file),
    isAuthenticated: googleConnection.isAuthenticated,
  });
  const sheetUrl = getSheetUrl(
    import.meta.env.VITE_GOOGLE_ADMITTED_APPLICANTS_SPREADSHEET_ID,
  );

  useEffect(function resetSelectionWhenLoggedOut() {
    if (googleConnection.isAuthenticated || !imageSelection.file) return;

    handleReset();
  }, [googleConnection.isAuthenticated, imageSelection.file]);

  return (
    <AdmissionSheetLayout
      isAuthenticated={googleConnection.isAuthenticated}
      isLoggingOut={googleConnection.isLoggingOut}
      onLogin={googleConnection.googleLogin}
      onLogout={googleConnection.googleLogout}
      sheetUrl={sheetUrl}
    >
      <main
        className={
          googleConnection.isAuthenticated
            ? "grid grid-cols-1 gap-8 md:grid-cols-[1.15fr_0.85fr]"
            : "mx-auto flex min-h-[420px] max-w-lg flex-col justify-center sm:min-h-[500px] md:min-h-[520px]"
        }
      >
        {!googleConnection.isAuthenticated ? (
          <LoginRequiredUploadGate onLogin={googleConnection.googleLogin} />
        ) : (
          <>
            <section className="space-y-6">
              <UploadDropzone
                file={imageSelection.file}
                preview={imageSelection.preview}
                disabled={isBusy}
                onFileSelect={selectFile}
                onFileReject={rejectFile}
                onReset={handleReset}
              />

              <button
                type="button"
                onClick={handleExtract}
                disabled={!canExtract}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white py-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-300"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    정보 추출 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    정보 추출하기
                  </>
                )}
              </button>
            </section>

            <section className="space-y-6">
              <AdmissionInfoCard
                data={data}
                isAuthenticated={googleConnection.isAuthenticated}
                isSaving={isSaving}
                canSave={canSave}
                saveRequirementMessage={saveRequirementMessage}
                onSave={handleSave}
              />

              <FeedbackMessages
                error={error}
                message={message}
                sheetUrl={sheetUrl}
                success={success}
              />
            </section>
          </>
        )}
      </main>

      <PageFooter />
    </AdmissionSheetLayout>
  );
};

const getSheetUrl = (spreadsheetId?: string) => {
  const normalizedSpreadsheetId = spreadsheetId?.trim();
  if (!normalizedSpreadsheetId || normalizedSpreadsheetId.includes("your-admitted-applicants-spreadsheet-id")) {
    return null;
  }

  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(normalizedSpreadsheetId)}/edit`;
};

type SaveRequirementInput = {
  hasData: boolean;
  hasFile: boolean;
  isAuthenticated: boolean;
};

const getSaveRequirementMessage = ({
  hasData,
  hasFile,
  isAuthenticated,
}: SaveRequirementInput) => {
  if (!isAuthenticated) return "Google 로그인 후 저장할 수 있습니다.";
  if (!hasFile) return "이미지를 먼저 선택해 주세요.";
  if (!hasData) return "정보 추출 후 저장할 수 있습니다.";

  return null;
};
