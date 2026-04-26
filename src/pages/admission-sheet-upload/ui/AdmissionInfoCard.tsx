import { AnimatePresence, motion } from "motion/react";
import { Database, Loader2, Send } from "lucide-react";

import type { AdmissionInfo } from "../api/admissionSheetApi";

type AdmissionInfoCardProps = {
  data: AdmissionInfo | null;
  isAuthenticated: boolean;
  isSaving: boolean;
  canSave: boolean;
  saveRequirementMessage: string | null;
  onSave: () => void;
};

export const AdmissionInfoCard = ({
  data,
  isAuthenticated,
  isSaving,
  canSave,
  saveRequirementMessage,
  onSave,
}: AdmissionInfoCardProps) => (
  <div className="flex min-h-[300px] flex-col rounded-2xl border border-neutral-100 bg-white p-8 shadow-sm">
    <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold">
      <Database className="h-5 w-5 text-neutral-400" />
      추출된 정보
    </h2>

    <AnimatePresence mode="wait">
      {data ? (
        <motion.div
          key="data"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex-grow space-y-4"
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
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                {item.label}
              </p>
              <p className="text-lg font-medium text-neutral-800">{item.value || "-"}</p>
            </div>
          ))}
        </motion.div>
      ) : (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-grow flex-col items-center justify-center text-center text-neutral-400"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-50">
            <Database className="h-6 w-6" />
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
        {saveRequirementMessage && (
          <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-500" aria-live="polite">
            {saveRequirementMessage}
          </p>
        )}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          type="button"
          onClick={onSave}
          disabled={!canSave || isSaving}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 font-semibold transition-all ${
            canSave && !isSaving
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700"
              : "cursor-not-allowed bg-neutral-200 text-neutral-400"
          }`}
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {isAuthenticated ? "이미지와 함께 시트에 저장" : "Google 로그인 후 저장"}
        </motion.button>
      </div>
    )}
  </div>
);
