const admittedApplicantsSpreadsheetId =
  import.meta.env.VITE_GOOGLE_ADMITTED_APPLICANTS_SPREADSHEET_ID?.trim();

export const PageFooter = () => (
  <footer className="mt-16 border-t border-neutral-100 pt-8 text-center text-xs text-neutral-400">
    <p>© 2024 대학 합격 정보 추출기. Gemini AI 기술을 사용합니다.</p>
    {admittedApplicantsSpreadsheetId && (
      <p className="mt-2">
        구글 시트:{" "}
        <a
          href={`https://docs.google.com/spreadsheets/d/${admittedApplicantsSpreadsheetId}/edit`}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-neutral-600"
        >
          연결된 시트 보기
        </a>
      </p>
    )}
  </footer>
);
