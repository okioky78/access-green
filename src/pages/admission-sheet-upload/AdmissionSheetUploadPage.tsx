import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";

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
import { FeedbackMessages } from "./ui/FeedbackMessages";
import { GoogleConnectionCard } from "./ui/GoogleConnectionCard";
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

  return (
    <div className="min-h-screen bg-neutral-50 p-4 font-sans text-neutral-900 md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight">
            대학 합격 정보 추출기
          </h1>
          <p className="text-neutral-500">
            합격증 이미지를 업로드하여 정보를 추출하고 구글 시트에 이미지와 함께 저장하세요.
          </p>
        </header>

        <main className="grid grid-cols-1 gap-8 md:grid-cols-[1.15fr_0.85fr]">
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
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 font-semibold transition-all ${
                canExtract
                  ? "bg-neutral-900 text-white shadow-lg shadow-neutral-200 hover:bg-neutral-800"
                  : "cursor-not-allowed bg-neutral-200 text-neutral-400"
              }`}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  정보 추출 중...
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  {googleConnection.isAuthenticated ? "정보 추출하기" : "Google 로그인 후 추출"}
                </>
              )}
            </button>
          </section>

          <section className="space-y-6">
            <GoogleConnectionCard
              isAuthenticated={googleConnection.isAuthenticated}
              isBusy={isBusy}
              isLoggingOut={googleConnection.isLoggingOut}
              onLogin={googleConnection.googleLogin}
              onLogout={googleConnection.googleLogout}
            />

            <AdmissionInfoCard
              data={data}
              isAuthenticated={googleConnection.isAuthenticated}
              isSaving={isSaving}
              canSave={canSave}
              saveRequirementMessage={saveRequirementMessage}
              onSave={handleSave}
            />

            <FeedbackMessages error={error} message={message} success={success} />
          </section>
        </main>

        <PageFooter />
      </div>
    </div>
  );
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
