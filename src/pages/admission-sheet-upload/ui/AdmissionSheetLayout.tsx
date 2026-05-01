import type { ReactNode } from "react";
import { GoogleAuthButton, SheetLinkButton } from "./GoogleHeaderActions";

type AdmissionSheetLayoutProps = {
  children: ReactNode;
  isAuthenticated: boolean;
  isLoggingOut: boolean;
  onLogin: () => void;
  onLogout: () => void;
  sheetUrl: string | null;
};

export const AdmissionSheetLayout = ({
  children,
  isAuthenticated,
  isLoggingOut,
  onLogin,
  onLogout,
  sheetUrl,
}: AdmissionSheetLayoutProps) => (
  <div className="min-h-screen bg-neutral-50 text-neutral-900">
    <header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">대학 합격 정보 추출기</h1>
        </div>
        <nav className="flex flex-wrap justify-center gap-2 sm:justify-end" aria-label="상단 메뉴">
          <SheetLinkButton url={sheetUrl} />
          <GoogleAuthButton
            isAuthenticated={isAuthenticated}
            isLoggingOut={isLoggingOut}
            onLogin={onLogin}
            onLogout={onLogout}
          />
        </nav>
      </div>
    </header>

    <div className="mx-auto max-w-5xl px-4 pb-6 pt-32 sm:pt-24 md:px-8 md:pb-8">
      {children}
    </div>
  </div>
);
