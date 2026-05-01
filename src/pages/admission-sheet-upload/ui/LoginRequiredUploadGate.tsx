import { Upload } from "lucide-react";
import { GoogleLogo } from "./GoogleHeaderActions";

type LoginRequiredUploadGateProps = {
  onLogin: () => void;
};

export const LoginRequiredUploadGate = ({ onLogin }: LoginRequiredUploadGateProps) => (
  <section className="space-y-6">
    <div className="relative flex min-h-[280px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 bg-white p-8 text-center shadow-sm sm:min-h-[360px] md:min-h-[420px]">
      <div className="py-12">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
          <Upload className="h-8 w-8 text-neutral-400" />
        </div>
        <p className="text-sm font-semibold text-neutral-900">이미지 선택은 Google 로그인이 필요합니다</p>
        <p className="mt-1 text-xs text-neutral-400">로그인 후 합격증 이미지를 선택하거나 드래그할 수 있습니다.</p>
        <button
          type="button"
          onClick={onLogin}
          className="mt-5 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          <GoogleLogo />
          Google 로그인
        </button>
      </div>
    </div>
  </section>
);
