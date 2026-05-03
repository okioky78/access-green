import { ExternalLink, Loader2, LogOut } from "lucide-react";

type GoogleAuthButtonProps = {
  isAuthenticated: boolean;
  isLoggingOut: boolean;
  onLogin: () => void;
  onLogout: () => void;
};

export const GoogleAuthButton = ({
  isAuthenticated,
  isLoggingOut,
  onLogin,
  onLogout,
}: GoogleAuthButtonProps) => {
  if (isAuthenticated) {
    return (
      <button
        type="button"
        onClick={onLogout}
        disabled={isLoggingOut}
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleLogo />}
        Google 로그아웃
        {!isLoggingOut && <LogOut className="h-4 w-4 text-neutral-400" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onLogin}
      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm ring-1 ring-neutral-200 transition hover:bg-neutral-50"
    >
      <GoogleLogo />
      Google 로그인
    </button>
  );
};

type SheetLinkButtonProps = {
  url: string | null;
};

export const SheetLinkButton = ({ url }: SheetLinkButtonProps) => {
  if (!url) {
    return (
      <button
        type="button"
        disabled
        title="Google Sheet ID 설정이 필요합니다"
        className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-full border border-neutral-200 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-400 shadow-sm"
      >
        <GoogleSheetsLogo />
        Sheet 설정 필요
      </button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
    >
      <GoogleSheetsLogo />
      Sheet 열기
      <ExternalLink className="h-3.5 w-3.5 text-neutral-400" />
    </a>
  );
};

export const GoogleLogo = () => (
  <svg aria-hidden="true" className="h-4 w-4" viewBox="-0.5 0 48 48">
    <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
      <g transform="translate(-401.000000, -860.000000)">
        <g transform="translate(401.000000, 860.000000)">
          <path
            d="M9.82727273,24 C9.82727273,22.4757333 10.0804318,21.0144 10.5322727,19.6437333 L2.62345455,13.6042667 C1.08206818,16.7338667 0.213636364,20.2602667 0.213636364,24 C0.213636364,27.7365333 1.081,31.2608 2.62025,34.3882667 L10.5247955,28.3370667 C10.0772273,26.9728 9.82727273,25.5168 9.82727273,24"
            fill="#FBBC05"
          />
          <path
            d="M23.7136364,10.1333333 C27.025,10.1333333 30.0159091,11.3066667 32.3659091,13.2266667 L39.2022727,6.4 C35.0363636,2.77333333 29.6954545,0.533333333 23.7136364,0.533333333 C14.4268636,0.533333333 6.44540909,5.84426667 2.62345455,13.6042667 L10.5322727,19.6437333 C12.3545909,14.112 17.5491591,10.1333333 23.7136364,10.1333333"
            fill="#EB4335"
          />
          <path
            d="M23.7136364,37.8666667 C17.5491591,37.8666667 12.3545909,33.888 10.5322727,28.3562667 L2.62345455,34.3946667 C6.44540909,42.1557333 14.4268636,47.4666667 23.7136364,47.4666667 C29.4455,47.4666667 34.9177955,45.4314667 39.0249545,41.6181333 L31.5177727,35.8144 C29.3995682,37.1488 26.7323182,37.8666667 23.7136364,37.8666667"
            fill="#34A853"
          />
          <path
            d="M46.1454545,24 C46.1454545,22.6133333 45.9318182,21.12 45.6113636,19.7333333 L23.7136364,19.7333333 L23.7136364,28.8 L36.3181818,28.8 C35.6879545,31.8912 33.9724545,34.2677333 31.5177727,35.8144 L39.0249545,41.6181333 C43.3393409,37.6138667 46.1454545,31.6490667 46.1454545,24"
            fill="#4285F4"
          />
        </g>
      </g>
    </g>
  </svg>
);

const GoogleSheetsLogo = () => (
  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 48 48">
    <path fill="#0F9D58" d="M8 4h22l10 10v30H8z" />
    <path fill="#87CEAC" d="M30 4v10h10z" />
    <path fill="#FFFFFF" d="M15 20h18v16H15z" />
    <path fill="#0F9D58" d="M17 22h6v4h-6zm8 0h6v4h-6zm-8 6h6v6h-6zm8 0h6v6h-6z" />
  </svg>
);
