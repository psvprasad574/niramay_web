import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithCredential,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const GOOGLE_SIGN_IN_STATE_KEY = "niramay.googleSignInState";
const GOOGLE_SIGN_IN_RETURN_KEY = "niramay.googleSignInReturnUrl";
const FIREBASE_CONFIG_URL = "/__/firebase/init.json";
const PUBLIC_CONFIG = window.NIRAMAY_PUBLIC_CONFIG || {};
const statusEl = document.querySelector("#status");

main().catch((error) => {
  if (statusEl) statusEl.textContent = error?.message || "Sign in failed.";
  history.replaceState({}, "", "/auth.html");
});

async function main() {
  const params = new URLSearchParams(location.hash.slice(1));
  history.replaceState({}, "", "/auth.html");

  const error = params.get("error");
  if (error) throw new Error(params.get("error_description") || error);

  const returnedState = params.get("state") || "";
  const expectedState = sessionStorage.getItem(GOOGLE_SIGN_IN_STATE_KEY) || "";
  if (!returnedState || returnedState !== expectedState) {
    throw new Error("Google sign-in state did not match. Please try again.");
  }

  const idToken = params.get("id_token") || "";
  if (!idToken) throw new Error("Google sign-in did not return an ID token.");

  const app = initializeApp(await loadFirebaseConfig());
  const auth = getAuth(app);
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));

  sessionStorage.removeItem(GOOGLE_SIGN_IN_STATE_KEY);
  const returnUrl = sessionStorage.getItem(GOOGLE_SIGN_IN_RETURN_KEY) || "/";
  sessionStorage.removeItem(GOOGLE_SIGN_IN_RETURN_KEY);
  location.replace(safeReturnUrl(returnUrl));
}

async function loadFirebaseConfig() {
  if (PUBLIC_CONFIG.firebaseConfig) {
    return PUBLIC_CONFIG.firebaseConfig;
  }
  const response = await fetch(FIREBASE_CONFIG_URL, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error("Firebase config is unavailable.");
  }
  return response.json();
}

function safeReturnUrl(value) {
  const url = new URL(value || "/", location.origin);
  if (url.origin !== location.origin) return "/";
  url.hash = "";
  return `${url.pathname}${url.search}`;
}
