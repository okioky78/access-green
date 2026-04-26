import { Loader2, LogIn, LogOut } from "lucide-react";

type GoogleConnectionCardProps = {
  isAuthenticated: boolean;
  isBusy: boolean;
  isLoggingOut: boolean;
  onLogin: () => void;
  onLogout: () => void;
};

export const GoogleConnectionCard = ({
  isAuthenticated,
  isBusy,
  isLoggingOut,
  onLogin,
  onLogout,
}: GoogleConnectionCardProps) => (
  <div className="rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm">
    <div className={isAuthenticated ? "flex items-center justify-between gap-4" : "mb-5 flex items-center justify-between gap-4"}>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <LogIn className="h-5 w-5 text-neutral-400" />
        Google 연결
        {isAuthenticated && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            연결됨
          </span>
        )}
      </h2>
      {isAuthenticated ? (
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut || isBusy}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          로그아웃
        </button>
      ) : (
        <button
          type="button"
          onClick={onLogin}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          <LogIn className="h-4 w-4" />
          Google 로그인
        </button>
      )}
    </div>
    {!isAuthenticated && (
      <p className="text-sm text-neutral-500">
        합격 정보를 추출하고 이미지를 함께 저장하려면 Google 로그인이 필요합니다.
      </p>
    )}
  </div>
);
