const LOGIN_STATE_KEY = "access_green_google_logged_in";
const LOGIN_STATE_VALUE = "authenticated";

export const hasLoginState = () => {
  if (typeof window === "undefined") return false;

  return window.localStorage.getItem(LOGIN_STATE_KEY) === LOGIN_STATE_VALUE;
};

export const setLoginState = () => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(LOGIN_STATE_KEY, LOGIN_STATE_VALUE);
};

export const clearLoginState = () => {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(LOGIN_STATE_KEY);
};
