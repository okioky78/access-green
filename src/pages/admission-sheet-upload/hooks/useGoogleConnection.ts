import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { getApiErrorMessage } from "../../../shared/api";
import { logoutGoogle } from "../api/admissionSheetApi";
import { clearLoginState, hasLoginState, setLoginState } from "../lib/googleLoginState";

type UseGoogleConnectionOptions = {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

export const useGoogleConnection = ({
  onError,
  onSuccess,
}: UseGoogleConnectionOptions) => {
  const [isAuthenticated, setIsAuthenticated] = useState(hasLoginState);

  const { mutate: logout, isPending: isLoggingOut } = useMutation({
    mutationFn: logoutGoogle,
  });

  const clearAuthenticatedState = () => {
    clearLoginState();
    setIsAuthenticated(false);
  };

  const googleLogin = () => {
    window.location.href = "/api/google-auth-start";
  };

  const googleLogout = () => {
    logout(undefined, {
      onSuccess: () => {
        clearAuthenticatedState();
        onSuccess("Google 로그아웃이 완료되었습니다.");
      },
      onError: (error) => {
        onError(getApiErrorMessage(error, "로그아웃하지 못했습니다."));
      },
    });
  };

  useEffect(function applyGoogleAuthRedirectResult() {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("authError");
    const authSuccess = params.get("auth");

    if (authError) {
      clearAuthenticatedState();
      onError(authError);
    }

    if (authSuccess === "success") {
      setLoginState();
      setIsAuthenticated(true);
    }

    if (authError || authSuccess) {
      params.delete("authError");
      params.delete("auth");
      const query = params.toString();
      const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", cleanUrl);
    }
  }, [onError, onSuccess]);

  return {
    clearAuthenticatedState,
    googleLogin,
    googleLogout,
    isAuthenticated,
    isLoggingOut,
  };
};
