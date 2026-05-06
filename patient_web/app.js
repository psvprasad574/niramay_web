import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check.js";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

const REGION = "asia-south1";
const PROFILE_KEY = "niramay.patient.profile.v1";
const RECEIPTS_KEY = "niramay.patient.receipts.v1";
const PRIVATE_DB_NAME = "niramay_patient_private";
const PRIVATE_STORE_NAME = "private_records";
const DRIVE_RECEIPTS_FILE = "niramay_bookings.json";
const GOOGLE_DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const GOOGLE_OAUTH_CLIENT_ID = "76866563498-ks6v02eb5abro9in7imkc0f5q8kfe29j.apps.googleusercontent.com";
const PUBLIC_CONFIG = window.NIRAMAY_PUBLIC_CONFIG || {};
const FIREBASE_APP_CHECK_SITE_KEY = PUBLIC_CONFIG.appCheckSiteKey || "";
const ADS_CONFIG = PUBLIC_CONFIG.ads || {};
const PATIENT_APP_INSTALL_URL =
  PUBLIC_CONFIG.patientAppInstallUrl ||
  "https://play.google.com/store/apps/details?id=com.vana.health.patient.instant";
const APP_CHECK_CONFIG_ERROR =
  "Patient web App Check is not configured. Add the Firebase App Check reCAPTCHA v3 site key before calling Cloud Functions.";
const GOOGLE_SIGN_IN_STATE_KEY = "niramay.googleSignInState";
const GOOGLE_SIGN_IN_RETURN_KEY = "niramay.googleSignInReturnUrl";
const GOOGLE_ACCESS_GRANTED_KEY = "niramay.googleAccessGranted.v1";
const AUTH_DEBUG = new URLSearchParams(location.search).has("debugAuth");
const FIREBASE_CONFIG_URL = "/__/firebase/init.json";

const els = {
  signInBtn: document.querySelector("#signInBtn"),
  desktopLeftAd: document.querySelector("#desktopLeftAd"),
  desktopRightAd: document.querySelector("#desktopRightAd"),
  mobileBottomAd: document.querySelector("#mobileBottomAd"),
  signOutBtn: document.querySelector("#signOutBtn"),
  myBookingsBtn: document.querySelector("#myBookingsBtn"),
  topCityPill: document.querySelector("#topCityPill"),
  topCityLabel: document.querySelector("#topCityLabel"),
  statusPanel: document.querySelector("#statusPanel"),
  welcomeView: document.querySelector("#welcomeView"),
  providerView: document.querySelector("#providerView"),
  bookingsView: document.querySelector("#bookingsView"),
  signedOutSearchPrompt: document.querySelector("#signedOutSearchPrompt"),
  cityPanel: document.querySelector("#cityPanel"),
  cityForm: document.querySelector("#cityForm"),
  cityInput: document.querySelector("#cityInput"),
  citySearchBtn: document.querySelector("#citySearchBtn"),
  cityLabel: document.querySelector("#cityLabel"),
  citySuggestions: document.querySelector("#citySuggestions"),
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  searchBtn: document.querySelector("#searchBtn"),
  useLocationBtn: document.querySelector("#useLocationBtn"),
  searchResults: document.querySelector("#searchResults"),
  hospitalCard: document.querySelector("#hospitalCard"),
  profileCard: document.querySelector("#profileCard"),
  workspaceTitle: document.querySelector("#workspaceTitle"),
  doctorList: document.querySelector("#doctorList"),
  refreshBtn: document.querySelector("#refreshBtn"),
  slotPanel: document.querySelector("#slotPanel"),
  selectedDoctorName: document.querySelector("#selectedDoctorName"),
  selectedDoctorMeta: document.querySelector("#selectedDoctorMeta"),
  dateInput: document.querySelector("#dateInput"),
  slotList: document.querySelector("#slotList"),
  profileDialog: document.querySelector("#profileDialog"),
  profileForm: document.querySelector("#profileForm"),
  patientName: document.querySelector("#patientName"),
  patientPhone: document.querySelector("#patientPhone"),
  cancelProfileBtn: document.querySelector("#cancelProfileBtn"),
  dateDialog: document.querySelector("#dateDialog"),
  dateForm: document.querySelector("#dateForm"),
  dateDialogTitle: document.querySelector("#dateDialogTitle"),
  promptDateInput: document.querySelector("#promptDateInput"),
  cancelDateBtn: document.querySelector("#cancelDateBtn"),
  confirmDateBtn: document.querySelector("#confirmDateBtn"),
  bookingDialog: document.querySelector("#bookingDialog"),
  bookingConfirmForm: document.querySelector("#bookingConfirmForm"),
  bookingConfirmTitle: document.querySelector("#bookingConfirmTitle"),
  bookingConfirmDoctor: document.querySelector("#bookingConfirmDoctor"),
  bookingConfirmDate: document.querySelector("#bookingConfirmDate"),
  bookingConfirmTime: document.querySelector("#bookingConfirmTime"),
  bookingPatientName: document.querySelector("#bookingPatientName"),
  bookingPatientPhone: document.querySelector("#bookingPatientPhone"),
  cancelBookingConfirmBtn: document.querySelector("#cancelBookingConfirmBtn"),
  confirmBookingBtn: document.querySelector("#confirmBookingBtn"),
  backToBookingBtn: document.querySelector("#backToBookingBtn"),
  bookingsList: document.querySelector("#bookingsList"),
  appShell: document.querySelector("#app"),
  hospitalLinkChoice: document.querySelector("#hospitalLinkChoice"),
  continueWebBtn: document.querySelector("#continueWebBtn"),
  installAppBtn: document.querySelector("#installAppBtn"),
};

const state = {
  app: null,
  auth: null,
  db: null,
  functions: null,
  user: null,
  hospitalId: null,
  hospital: null,
  doctors: [],
  selectedDoctor: null,
  pendingDateDoctor: null,
  selectedSlotsByStart: new Map(),
  location: null,
  cityContext: null,
  patientGoogleAccessToken: "",
  patientGoogleAccessTokenExpiresAt: 0,
  driveReceiptsFileId: "",
  citySuggestTimer: null,
  providerSuggestTimer: null,
  patientProfile: null,
  receiptCache: [],
  pendingBooking: null,
  waitingForWebChoice: false,
};

main().catch((error) => showError(error));

function initializePatientAppCheck() {
  if (!FIREBASE_APP_CHECK_SITE_KEY) {
    console.error(APP_CHECK_CONFIG_ERROR);
    return;
  }
  if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(state.app, {
    provider: new ReCaptchaEnterpriseProvider(FIREBASE_APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

async function callPatientFunction(name, data = {}) {
  const user = state.auth?.currentUser;
  if (!user) {
    throw new Error("Sign in before continuing.");
  }
  if (!FIREBASE_APP_CHECK_SITE_KEY) {
    throw new Error(APP_CHECK_CONFIG_ERROR);
  }
  await user.getIdToken(true);
  return httpsCallable(state.functions, name)(data);
}

async function loadFirebaseConfig() {
  if (PUBLIC_CONFIG.firebaseConfig) {
    return PUBLIC_CONFIG.firebaseConfig;
  }
  const response = await fetch(FIREBASE_CONFIG_URL, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(
      "Firebase config is unavailable. Deploy on Firebase Hosting or set window.NIRAMAY_PUBLIC_CONFIG.firebaseConfig for local development.",
    );
  }
  return response.json();
}

async function main() {
  state.app = initializeApp(await loadFirebaseConfig());
  initializePatientAppCheck();
  initializeBannerAds();
  state.auth = getAuth(state.app);
  state.db = getFirestore(state.app);
  state.functions = getFunctions(state.app, REGION);
  await handleGoogleIdTokenRedirect();
  await hydratePrivateCaches();

  bindEvents();
  hydrateInitialRoute();
  showHospitalLinkChoice();
  initializeDateInput();
  renderProfile();

  onAuthStateChanged(state.auth, async (user) => {
    state.user = user;
    renderAuth();
    if (user) {
      try {
        await hydratePatientProfileFromAuth(user);
        renderProfile();
        await ensurePatientId();
        if (!state.hospitalId) maybeAutoUseLocation();
      } catch (error) {
        showError(error);
      }
    } else {
      renderProfile();
    }
    if (state.hospitalId && !state.waitingForWebChoice) {
      await loadHospitalContext(state.hospitalId);
    }
  });

  if (state.hospitalId && !state.waitingForWebChoice) {
    await loadHospitalContext(state.hospitalId);
  }
}

function initializeBannerAds() {
  const client = ADS_CONFIG.client || "";
  if (!client) return;

  const slots = [
    { element: els.desktopLeftAd, slot: ADS_CONFIG.desktopLeftSlot, className: "ad-unit-side" },
    { element: els.desktopRightAd, slot: ADS_CONFIG.desktopRightSlot, className: "ad-unit-side" },
    { element: els.mobileBottomAd, slot: ADS_CONFIG.mobileBottomSlot, className: "ad-unit-mobile" },
  ].filter((item) => item.element && item.slot);

  if (!slots.length) return;
  loadGoogleAdsScript(client);
  for (const item of slots) {
    item.element.hidden = false;
    if (item.element === els.mobileBottomAd) {
      document.body.classList.add("has-mobile-ad");
    }
    item.element.innerHTML = `
      <ins class="adsbygoogle ${item.className}"
        data-ad-client="${escapeAttr(client)}"
        data-ad-slot="${escapeAttr(item.slot)}"
        data-ad-format="auto"
        data-full-width-responsive="true"></ins>
    `;
    queueAdRender();
  }
}

function loadGoogleAdsScript(client) {
  if (document.querySelector("script[data-google-adsense]")) return;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.dataset.googleAdsense = "true";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(script);
}

function queueAdRender() {
  window.adsbygoogle = window.adsbygoogle || [];
  try {
    window.adsbygoogle.push({});
  } catch (error) {
    console.warn("Google banner ad could not be queued.", error);
  }
}

async function hydratePrivateCaches() {
  const [profile, receipts] = await Promise.all([
    readPrivateRecord(PROFILE_KEY),
    readPrivateRecord(RECEIPTS_KEY),
  ]);
  state.patientProfile = profile || readLegacyLocalJson(PROFILE_KEY);
  state.receiptCache = Array.isArray(receipts)
    ? receipts
    : (Array.isArray(readLegacyLocalJson(RECEIPTS_KEY)) ? readLegacyLocalJson(RECEIPTS_KEY) : []);
  await Promise.all([
    state.patientProfile ? writePrivateRecord(PROFILE_KEY, state.patientProfile) : Promise.resolve(),
    state.receiptCache.length ? writePrivateRecord(RECEIPTS_KEY, state.receiptCache) : Promise.resolve(),
  ]);
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(RECEIPTS_KEY);
}

function readLegacyLocalJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch (_) {
    return null;
  }
}

function openPrivateDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PRIVATE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(PRIVATE_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Private storage could not be opened."));
  });
}

async function readPrivateRecord(key) {
  const db = await openPrivateDb();
  return new Promise((resolve) => {
    const tx = db.transaction(PRIVATE_STORE_NAME, "readonly");
    const request = tx.objectStore(PRIVATE_STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
}

async function writePrivateRecord(key, value) {
  const db = await openPrivateDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRIVATE_STORE_NAME, "readwrite");
    tx.objectStore(PRIVATE_STORE_NAME).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Private storage write failed."));
    };
  });
}

function bindEvents() {
  const on = (element, eventName, handler) => {
    if (element) element.addEventListener(eventName, handler);
  };

  on(els.signInBtn, "click", async () => {
    clearStatus();
    els.signInBtn.disabled = true;
    try {
      startGoogleIdTokenSignIn();
    } catch (error) {
      showAuthError(error);
      els.signInBtn.disabled = false;
      return;
    } finally {
      if (location.origin !== "https://accounts.google.com") {
        els.signInBtn.disabled = false;
      }
    }
  });

  on(els.continueWebBtn, "click", async () => {
    state.waitingForWebChoice = false;
    els.hospitalLinkChoice.hidden = true;
    els.appShell.hidden = false;
    if (state.hospitalId) await loadHospitalContext(state.hospitalId);
  });

  if (els.installAppBtn) {
    els.installAppBtn.href = PATIENT_APP_INSTALL_URL;
  }

  on(els.signOutBtn, "click", () => {
    state.patientGoogleAccessToken = "";
    state.patientGoogleAccessTokenExpiresAt = 0;
    state.driveReceiptsFileId = "";
    localStorage.removeItem(GOOGLE_ACCESS_GRANTED_KEY);
    signOut(state.auth);
  });

  on(els.topCityPill, "click", () => {
    els.cityInput.focus();
    els.cityPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  on(els.cityForm, "submit", async (event) => {
    event.preventDefault();
    selectCityByName(els.cityInput.value);
    await runSearch();
  });

  on(els.cityInput, "input", () => {
    clearTimeout(state.citySuggestTimer);
    state.citySuggestTimer = setTimeout(() => suggestCities(els.cityInput.value), 250);
  });

  on(els.searchForm, "submit", async (event) => {
    event.preventDefault();
    await runSearch();
  });

  on(els.searchInput, "input", () => {
    clearTimeout(state.providerSuggestTimer);
    state.providerSuggestTimer = setTimeout(() => {
      const value = providerSearchText();
      if (value.length >= 3 || value.length === 0) {
        runSearch();
      } else {
        els.searchResults.innerHTML = `<div class="empty-state">Type at least 3 characters to search providers.</div>`;
      }
    }, 300);
  });

  on(els.useLocationBtn, "click", async () => {
    await captureLocation();
    await runSearch();
  });

  on(els.refreshBtn, "click", () => {
    if (state.hospitalId) loadHospitalContext(state.hospitalId);
  });

  on(els.dateInput, "change", () => {
    if (state.selectedDoctor && els.dateInput.value) loadSlots(state.selectedDoctor);
  });

  on(els.dateForm, "submit", (event) => {
    event.preventDefault();
    confirmPromptedDate();
  });

  on(els.profileForm, "submit", async (event) => {
    event.preventDefault();
    const existing = loadProfile() || {};
    try {
      const patient = validatePatientPrivateProfile(
        els.patientName.value,
        els.patientPhone.value,
      );
      const profile = {
        ...existing,
        ...patient,
        updatedAt: new Date().toISOString(),
      };
      await saveProfile(profile);
      els.profileDialog.close();
      renderProfile();
    } catch (error) {
      showStatus(error?.message || "Enter valid patient details.", true);
    }
  });

  on(els.cancelProfileBtn, "click", () => els.profileDialog.close());
  on(els.cancelDateBtn, "click", () => {
    state.pendingDateDoctor = null;
    els.dateDialog.close();
  });
  on(els.cancelBookingConfirmBtn, "click", () => closeBookingDialog());
  on(els.bookingConfirmForm, "submit", async (event) => {
    event.preventDefault();
    await confirmPendingBooking();
  });
  on(els.myBookingsBtn, "click", showBookings);
  on(els.backToBookingBtn, "click", () => {
    els.bookingsView.hidden = true;
    if (state.hospitalId) {
      els.providerView.hidden = false;
    } else {
      els.welcomeView.hidden = false;
    }
  });

  window.addEventListener("popstate", async () => {
    hydrateInitialRoute();
    if (state.hospitalId) {
      showHospitalLinkChoice();
    } else {
      state.waitingForWebChoice = false;
      els.hospitalLinkChoice.hidden = true;
      els.appShell.hidden = false;
      showWelcome();
    }
  });

}

async function handleGoogleIdTokenRedirect() {
  if (!location.hash || !location.hash.includes("id_token=")) {
    if (AUTH_DEBUG) showStatus("No Google ID token redirect was found.");
    return;
  }
  const params = new URLSearchParams(location.hash.slice(1));
  const error = params.get("error");
  if (error) {
    const authError = new Error(params.get("error_description") || error);
    authError.code = `google/${error}`;
    throw authError;
  }

  const returnedState = params.get("state") || "";
  const expectedState = sessionStorage.getItem(GOOGLE_SIGN_IN_STATE_KEY) || "";
  if (!returnedState || returnedState !== expectedState) {
    throw new Error("Google sign-in state did not match. Please try again.");
  }

  const idToken = params.get("id_token") || "";
  if (!idToken) throw new Error("Google sign-in did not return an ID token.");

  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(state.auth, credential);
  sessionStorage.removeItem(GOOGLE_SIGN_IN_STATE_KEY);
  const returnUrl = sessionStorage.getItem(GOOGLE_SIGN_IN_RETURN_KEY) || "/";
  sessionStorage.removeItem(GOOGLE_SIGN_IN_RETURN_KEY);

  const cleanUrl = new URL(returnUrl, location.origin);
  if (cleanUrl.origin !== location.origin) cleanUrl.href = `${location.origin}/`;
  cleanUrl.hash = "";
  history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}`);
  if (AUTH_DEBUG) {
    showStatus(`Google sign-in completed for ${result.user.email || result.user.uid}.`);
  }
}

function startGoogleIdTokenSignIn() {
  const redirectUri = `${location.origin}/`;
  const stateToken = randomToken();
  sessionStorage.setItem(GOOGLE_SIGN_IN_STATE_KEY, stateToken);
  sessionStorage.setItem(GOOGLE_SIGN_IN_RETURN_KEY, location.href.split("#")[0]);
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "id_token",
    scope: "openid email profile",
    nonce: randomToken(),
    state: stateToken,
    prompt: "select_account consent",
  });
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

function randomToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hydrateInitialRoute() {
  const url = new URL(window.location.href);
  const fromPath = parseHospitalId(url.pathname);
  const fromQuery = parseHospitalId(
    url.searchParams.get("hospitalId") ||
      url.searchParams.get("hospital") ||
      url.searchParams.get("code") ||
      "",
  );
  state.hospitalId = fromPath || fromQuery || null;
}

function showHospitalLinkChoice() {
  if (!state.hospitalId) return;
  state.waitingForWebChoice = true;
  els.appShell.hidden = true;
  els.hospitalLinkChoice.hidden = false;
}

function parseHospitalId(value) {
  if (!value) return "";
  try {
    const maybeUrl = value.startsWith("http")
      ? new URL(value)
      : new URL(value, window.location.origin);
    const segments = maybeUrl.pathname.split("/").filter(Boolean);
    const hospitalIndex = segments.indexOf("hospital");
    if (hospitalIndex >= 0 && segments[hospitalIndex + 1]) {
      return cleanId(segments[hospitalIndex + 1]);
    }
    const fromQuery =
      maybeUrl.searchParams.get("hospitalId") ||
      maybeUrl.searchParams.get("hospital") ||
      maybeUrl.searchParams.get("code");
    if (fromQuery) return cleanId(fromQuery);
  } catch (_) {
    // Fall through to plain-code parsing.
  }
  return cleanId(value);
}

function cleanId(value) {
  return String(value).trim().replace(/^\/+|\/+$/g, "");
}

function initializeDateInput() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  els.dateInput.value = "";
  els.dateInput.min = now.toISOString().slice(0, 10);
  els.promptDateInput.min = els.dateInput.min;
}

function renderAuth() {
  const signedIn = Boolean(state.user);
  els.signInBtn.hidden = signedIn;
  els.signOutBtn.hidden = !signedIn;
  els.myBookingsBtn.hidden = !signedIn;
  els.topCityPill.hidden = !signedIn;
  els.signedOutSearchPrompt.hidden = signedIn;
  if (signedIn) {
    els.cityPanel.removeAttribute("hidden");
    els.searchForm.removeAttribute("hidden");
  } else {
    els.cityPanel.setAttribute("hidden", "");
    els.searchForm.setAttribute("hidden", "");
  }
  if (signedIn) {
    els.signOutBtn.textContent = state.user.displayName
      ? `Sign out, ${state.user.displayName.split(" ")[0]}`
      : "Sign out";
  } else {
    els.searchResults.innerHTML = "";
    updateCityLabels("Choose city");
  }
}

function loadProfile() {
  return state.patientProfile;
}

async function saveProfile(profile) {
  const safeProfile = {
    name: profile?.name || "",
    phone: profile?.phone || "",
    updatedAt: profile?.updatedAt || new Date().toISOString(),
  };
  state.patientProfile = safeProfile;
  await writePrivateRecord(PROFILE_KEY, safeProfile);
}

async function hydratePatientProfileFromAuth(user) {
  if (!user) return;
  const existing = loadProfile() || {};
  const profile = {
    ...existing,
    name: existing.name || user.displayName || "",
    phone: existing.phone || user.phoneNumber || "",
    updatedAt: existing.updatedAt || new Date().toISOString(),
  };
  if ((profile.name || profile.phone) && (!existing.name || !existing.phone)) {
    await saveProfile(profile);
  }
}

function renderProfile() {
  const profile = loadProfile();
  if (!profile) {
    els.profileCard.innerHTML = `
      <p class="eyebrow">Patient details</p>
      <h3>Not saved yet</h3>
      <p>Add the name and phone used for your visit.</p>
      <button id="editProfileBtn" type="button">Add details</button>
    `;
  } else {
    els.profileCard.innerHTML = `
      <p class="eyebrow">Patient details</p>
      <h3>${escapeHtml(profile.name || state.user?.displayName || "Patient")}</h3>
      ${profile.phone ? `<p>${escapeHtml(profile.phone)}</p>` : `<p>Add a mobile number before booking.</p>`}
      <p>Gmail is used for sign-in. Calendar invites are sent by the provider.</p>
      <button id="editProfileBtn" class="ghost" type="button">Edit</button>
    `;
  }
  document.querySelector("#editProfileBtn").addEventListener("click", openProfileDialog);
}

function openProfileDialog() {
  const profile = loadProfile();
  els.patientName.value = profile?.name || state.user?.displayName || "";
  els.patientPhone.value = profile?.phone || state.user?.phoneNumber || "";
  els.profileDialog.showModal();
}

async function ensurePatientId() {
  const cached = sessionStorage.getItem("niramay.patient.id");
  if (cached) return cached;
  const result = await callPatientFunction("getOrCreatePatientId");
  const patientId = result.data?.patientId || "";
  if (patientId) sessionStorage.setItem("niramay.patient.id", patientId);
  return patientId;
}

async function ensurePatientGoogleAccessToken() {
  const now = Date.now();
  if (state.patientGoogleAccessToken && state.patientGoogleAccessTokenExpiresAt - now > 60_000) {
    return state.patientGoogleAccessToken;
  }
  if (!state.user) throw new Error("Sign in before syncing Google Drive receipts.");
  await loadGoogleIdentityServices();
  try {
    return await requestPatientGoogleAccessToken({ prompt: "" });
  } catch (error) {
    if (hasGrantedGoogleAccess()) throw error;
    return requestPatientGoogleAccessToken({ prompt: "consent" });
  }
}

function hasGrantedGoogleAccess() {
  return localStorage.getItem(GOOGLE_ACCESS_GRANTED_KEY) === state.user?.uid;
}

function requestPatientGoogleAccessToken({ prompt }) {
  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      scope: GOOGLE_DRIVE_APPDATA_SCOPE,
      prompt,
      callback: (response) => {
        if (response?.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        const token = response?.access_token || "";
        if (!token) {
          reject(new Error("Google Drive authorization did not return an access token."));
          return;
        }
        state.patientGoogleAccessToken = token;
        const expiresInSeconds = Number(response.expires_in || 3600);
        state.patientGoogleAccessTokenExpiresAt = Date.now() + expiresInSeconds * 1000;
        localStorage.setItem(GOOGLE_ACCESS_GRANTED_KEY, state.user.uid);
        resolve(token);
      },
    });
    tokenClient.requestAccessToken();
  });
}

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-google-identity-services]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google authorization library could not be loaded.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentityServices = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google authorization library could not be loaded."));
    document.head.appendChild(script);
  });
}

function showWelcome() {
  clearStatus();
  state.hospitalId = null;
  state.hospital = null;
  state.doctors = [];
  state.selectedDoctor = null;
  els.providerView.hidden = true;
  els.bookingsView.hidden = true;
  els.welcomeView.hidden = false;
  els.slotPanel.hidden = true;
}

function maybeAutoUseLocation() {
  if (state.cityContext) return;
  updateCityLabels("Detecting location...");
  captureLocation().then((location) => {
    if (location) runSearch();
  });
}

function selectCityByName(cityName) {
  const city = normalizeSearchText(cityName);
  if (!city) {
    showStatus("Enter a city name first.", true);
    return false;
  }
  state.location = null;
  state.cityContext = {
    type: "city",
    city,
    label: titleCase(city),
  };
  if (!els.searchInput.value.trim()) els.searchInput.value = "all";
  updateCityLabels(state.cityContext.label);
  els.citySuggestions.innerHTML = "";
  showStatus(`Showing providers in ${state.cityContext.label}.`);
  return true;
}

async function captureLocation() {
  if (!navigator.geolocation) {
    showStatus("Location is not available in this browser.", true);
    return null;
  }
  els.useLocationBtn.disabled = true;
  els.useLocationBtn.textContent = "Getting location...";
  updateCityLabels("Detecting location...");
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 300000,
      });
    });
    state.location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    const inferredCity =
      await reverseGeocodeCity(state.location) ||
      await inferCityFromLocation(state.location);
    state.cityContext = {
      type: "location",
      city: inferredCity.city || "",
      label: inferredCity.label || "Near current location",
      location: state.location,
    };
    if (state.cityContext.city) {
      els.cityInput.value = state.cityContext.label;
    }
    if (!els.searchInput.value.trim()) els.searchInput.value = "all";
    updateCityLabels(state.cityContext.label);
    showStatus("Location added. Showing providers near you.");
    return state.location;
  } catch (error) {
    updateCityLabels(state.cityContext?.label || "Choose city");
    showStatus(locationErrorMessage(error), true);
    return null;
  } finally {
    els.useLocationBtn.disabled = false;
    els.useLocationBtn.textContent = "Use current location";
  }
}

function updateCityLabels(label) {
  const value = label || "Choose city";
  els.cityLabel.textContent = value;
  els.topCityLabel.textContent = value;
}

async function runSearch() {
  if (!state.user) {
    showStatus("Sign in with Google before searching providers.");
    return;
  }
  clearStatus();
  const searchText = providerSearchText();
  if (searchText && searchText.length < 3) {
    els.searchResults.innerHTML = `<div class="empty-state">Type at least 3 characters to search providers.</div>`;
    return;
  }
  ensureCityContextFromInput();
  const city = sanitizeUserText(state.cityContext?.city || "", 100).toLowerCase();

  els.searchBtn.disabled = true;
  els.searchResults.innerHTML = `<div class="empty-state">Searching providers...</div>`;
  try {
    const result = await callPatientFunction("searchPatientProviders", {
      query: searchText || "all",
      city,
    });
    renderSearchResults(result.data?.results || []);
  } catch (error) {
    els.searchResults.innerHTML = "";
    showError(error);
  } finally {
    els.searchBtn.disabled = false;
  }
}

function providerSearchText() {
  const value = normalizeSearchText(els.searchInput.value);
  return value === "all" ? "" : value;
}

function ensureCityContextFromInput() {
  if (state.cityContext) return;
  const city = normalizeSearchText(els.cityInput.value);
  if (city) selectCityByName(city);
}

async function suggestCities(value) {
  const searchText = normalizeSearchText(value);
  if (searchText.length < 3) {
    els.citySuggestions.innerHTML = "";
    return;
  }
  renderCitySuggestions([{ city: searchText, label: titleCase(searchText) }]);
}

function renderCitySuggestions(cities) {
  if (!cities.length) {
    els.citySuggestions.innerHTML = `<div class="empty-state compact">No matching cities found.</div>`;
    return;
  }
  els.citySuggestions.innerHTML = cities.map((city) => `
    <button class="suggestion-button" type="button" data-city="${escapeAttr(city.city)}">
      ${escapeHtml(city.label)}
    </button>
  `).join("");
  els.citySuggestions.querySelectorAll(".suggestion-button").forEach((button) => {
    button.addEventListener("click", async () => {
      els.cityInput.value = button.textContent.trim();
      selectCityByName(button.dataset.city);
      await runSearch();
    });
  });
}

async function searchDoctors(searchText) {
  if (!state.cityContext) {
    const snap = await getDocs(query(collection(state.db, "doctors"), limit(100)));
    return snap.docs
      .map((item) => normalizeSearchDoctor(item.id, item.data()))
      .filter((doctor) => doctor.isAvailable)
      .filter((doctor) => matchesProviderSearch(doctor, searchText));
  }

  if (state.cityContext?.type === "location") {
    const geohash4 = encodeGeohash(
      state.cityContext.location.latitude,
      state.cityContext.location.longitude,
      4,
    );
    const [start, end] = geohashRange(geohash4);
    const snap = await getDocs(
      query(
        collection(state.db, "doctors"),
        where("geohash4", ">=", start),
        where("geohash4", "<", end),
        limit(80),
      ),
    );
    let doctors = snap.docs
      .map((item) => normalizeSearchDoctor(item.id, item.data()))
      .filter((doctor) => doctor.isAvailable)
      .filter((doctor) => matchesProviderSearch(doctor, searchText));
    if (!doctors.length && state.cityContext.city) {
      doctors = await searchDoctorsByCity(state.cityContext.city, searchText);
    }
    if (!doctors.length) {
      const fallbackSnap = await getDocs(query(collection(state.db, "doctors"), limit(100)));
      doctors = fallbackSnap.docs
        .map((item) => normalizeSearchDoctor(item.id, item.data()))
        .filter((doctor) => doctor.isAvailable)
        .filter((doctor) => matchesProviderSearch(doctor, searchText));
    }
    return doctors;
  }

  return searchDoctorsByCity(state.cityContext.city, searchText);
}

async function searchDoctorsByCity(city, searchText) {
  const citySearchSnap = await getDocs(
    query(
      collection(state.db, "doctors"),
      where("citySearch", "==", city),
      limit(80),
    ),
  ).catch(() => ({ docs: [] }));
  const citySnap = await getDocs(
    query(
      collection(state.db, "doctors"),
      where("city", "==", city),
      limit(80),
    ),
  ).catch(() => ({ docs: [] }));
  const byId = new Map([...citySearchSnap.docs, ...citySnap.docs].map((item) => [item.id, item]));
  if (!byId.size) {
    const fallbackSnap = await getDocs(query(collection(state.db, "doctors"), limit(100)));
    for (const item of fallbackSnap.docs) {
      const doctor = normalizeSearchDoctor(item.id, item.data());
      if (normalizeSearchText(doctor.city) === city) {
        byId.set(item.id, item);
      }
    }
  }
  return [...byId.values()]
    .map((item) => normalizeSearchDoctor(item.id, item.data()))
    .filter((doctor) => doctor.isAvailable)
    .filter((doctor) => matchesProviderSearch(doctor, searchText));
}

async function inferCityFromLocation(location) {
  return {};
}

async function reverseGeocodeCity(location) {
  try {
    if (!state.user) return null;
    const result = await callPatientFunction("googlePlacesProxy", {
      action: "reverseGeocode",
      lat: location.latitude,
      lng: location.longitude,
    });
    const data = result.data || {};
    const components = data.results?.flatMap((result) => result.address_components || []) || [];
    const locality = components.find((part) => part.types?.includes("locality")) ||
      components.find((part) => part.types?.includes("administrative_area_level_3")) ||
      components.find((part) => part.types?.includes("administrative_area_level_2"));
    const city = normalizeSearchText(locality?.long_name || locality?.short_name || "");
    return city ? { city, label: titleCase(city) } : null;
  } catch (_) {
    return null;
  }
}

async function buildSearchResults(doctors, searchText) {
  const byHospital = new Map();
  for (const doctor of doctors) {
    const hospitalId = doctor.practiceId || doctor.hospitalId;
    if (!hospitalId) continue;
    if (!byHospital.has(hospitalId)) {
      byHospital.set(hospitalId, {
        hospitalId,
        hospitalName: doctor.clinicName || hospitalId,
        address: doctor.clinicAddress || "",
        city: doctor.city || "",
        doctors: [],
      });
    }
    byHospital.get(hospitalId).doctors.push(doctor);
  }

  if (searchText) {
    const hospitals = await searchHospitalsByName(searchText);
    for (const hospital of hospitals) {
      const existing = byHospital.get(hospital.hospitalId);
      byHospital.set(hospital.hospitalId, {
        hospitalId: hospital.hospitalId,
        hospitalName: hospital.name,
        address: hospital.address,
        city: hospital.city,
        doctors: existing?.doctors || [],
      });
    }
  }

  return [...byHospital.values()].sort((a, b) =>
    a.hospitalName.localeCompare(b.hospitalName),
  );
}

async function searchHospitalsByName(searchText) {
  const hospitalsRef = collection(state.db, "hospitals");
  const snap = state.cityContext?.type === "city"
    ? await getDocs(
      query(
        hospitalsRef,
        where("adminProfile.citySearch", "==", state.cityContext.city),
        limit(50),
      ),
    )
    : await getDocs(query(hospitalsRef, limit(100)));
  return snap.docs
    .map((item) => {
      const data = item.data();
      const adminProfile = data.adminProfile || {};
      return {
        hospitalId: item.id,
        name: adminProfile.clinicName || data.name || data.clinicName || item.id,
        address: adminProfile.clinicAddress || adminProfile.address || data.address || "",
        city: adminProfile.city || data.city || "",
      };
    })
    .filter((hospital) => includesSearch(hospital.name, searchText));
}

function renderSearchResults(results) {
  if (!results.length) {
    els.searchResults.innerHTML = `<div class="empty-state">No matching providers found.</div>`;
    return;
  }
  els.searchResults.innerHTML = results.map((result) => `
    <article class="search-result-card" data-hospital-id="${escapeAttr(result.hospitalId)}">
      <div>
        <p class="eyebrow">Hospital</p>
        <h3>${escapeHtml(result.hospitalName)}</h3>
        ${result.address ? `<p>${escapeHtml(result.address)}</p>` : ""}
        ${result.city ? `<p>${escapeHtml(result.city)}</p>` : ""}
        <p>${escapeHtml(result.doctors.length ? `${result.doctors.length} doctor${result.doctors.length === 1 ? "" : "s"} found` : "Open hospital doctors")}</p>
      </div>
      <button type="button">View doctors</button>
    </article>
  `).join("");
  els.searchResults.querySelectorAll(".search-result-card").forEach((card) => {
    card.addEventListener("click", async () => {
      const hospitalId = card.dataset.hospitalId;
      history.pushState({}, "", `/hospital/${encodeURIComponent(hospitalId)}`);
      await loadHospitalContext(hospitalId);
    });
  });
}

function normalizeSearchDoctor(docId, data) {
  return {
    docId,
    uid: data.uid || docId,
    practiceId: data.practiceId || data.hospitalId || "",
    hospitalId: data.hospitalId || data.practiceId || "",
    name: data.name || "Doctor",
    specialty: data.specialty || "",
    clinicName: data.clinicName || "",
    clinicAddress: data.clinicAddress || "",
    city: data.city || "",
    photoUrl: data.photoUrl || "",
    isAvailable: data.isAvailable !== false,
  };
}

function matchesProviderSearch(doctor, searchText) {
  if (!searchText) return true;
  return includesSearch(doctor.clinicName, searchText) ||
    includesSearch(doctor.clinicAddress, searchText) ||
    includesSearch(doctor.name, searchText) ||
    includesSearch(doctor.specialty, searchText);
}

function includesSearch(value, searchText) {
  return normalizeSearchText(value).includes(normalizeSearchText(searchText));
}

function normalizeSearchText(value) {
  return sanitizeUserText(value, 100).toLowerCase();
}

function sanitizeUserText(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function validatePatientPrivateProfile(nameValue, phoneValue) {
  const name = sanitizeUserText(nameValue, 100);
  const phone = sanitizeUserText(phoneValue, 20);
  if (!name) throw new Error("Patient name is required.");
  if (!/^[A-Za-z][A-Za-z .'-]{1,98}$/.test(name)) {
    throw new Error("Enter a valid patient name.");
  }
  if (!phone) throw new Error("Patient phone is required.");
  const cleanedPhone = phone.replace(/[\s\-.()]/g, "");
  if (!/^(\+91|0)?[6-9]\d{9}$/.test(cleanedPhone)) {
    throw new Error("Enter a valid patient phone number.");
  }
  return { name, phone };
}

function prefixRange(value) {
  const start = normalizeSearchText(value);
  const last = start.charCodeAt(start.length - 1);
  const end = `${start.slice(0, -1)}${String.fromCharCode(last + 1)}`;
  return [start, end];
}

function titleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function geohashRange(geohash) {
  const last = geohash.charCodeAt(geohash.length - 1);
  return [geohash, `${geohash.slice(0, -1)}${String.fromCharCode(last + 1)}`];
}

function encodeGeohash(latitude, longitude, precision = 4) {
  const base32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let isEven = true;
  let bit = 0;
  let ch = 0;
  const hash = [];
  const lat = [-90, 90];
  const lon = [-180, 180];

  while (hash.length < precision) {
    const range = isEven ? lon : lat;
    const value = isEven ? longitude : latitude;
    const mid = (range[0] + range[1]) / 2;
    if (value >= mid) {
      ch |= 1 << (4 - bit);
      range[0] = mid;
    } else {
      range[1] = mid;
    }
    isEven = !isEven;
    if (bit < 4) {
      bit += 1;
    } else {
      hash.push(base32[ch]);
      bit = 0;
      ch = 0;
    }
  }
  return hash.join("");
}

function locationErrorMessage(error) {
  if (error?.code === 1) return "Location permission was denied.";
  if (error?.code === 2) return "Current location could not be detected.";
  if (error?.code === 3) return "Location request timed out.";
  return "Could not read your current location.";
}

async function loadHospitalContext(hospitalId) {
  state.hospitalId = hospitalId;
  clearStatus();
  els.welcomeView.hidden = true;
  els.bookingsView.hidden = true;
  els.providerView.hidden = false;
  els.hospitalCard.classList.add("skeleton");
  els.hospitalCard.innerHTML = "";
  els.doctorList.innerHTML = "";
  els.slotPanel.hidden = true;

  try {
    if (!state.user) {
      showStatus("Sign in with Google to view doctors and book appointments.");
      renderHospitalShell(hospitalId);
      return;
    }

    const [hospital, doctors] = await Promise.all([
      fetchHospital(hospitalId),
      fetchHospitalDoctors(hospitalId),
    ]);

    state.hospital = hospital;
    state.doctors = doctors;
    renderHospital(hospitalId, hospital);
    renderDoctors(doctors);
  } catch (error) {
    showError(error);
    renderHospitalShell(hospitalId);
  }
}

async function fetchHospital(hospitalId) {
  const snap = await getDoc(doc(state.db, "hospitals", hospitalId));
  if (!snap.exists()) throw new Error("Hospital code was not found.");
  return { id: snap.id, ...snap.data() };
}

async function fetchHospitalDoctors(hospitalId) {
  const membersRef = collection(state.db, "hospitals", hospitalId, "members");
  const membersSnap = await getDocs(
    query(
      membersRef,
      where("role", "==", "doctor"),
      limit(50),
    ),
  );

  const doctors = [];
  for (const member of membersSnap.docs) {
    const memberData = member.data();
    const status = memberData.status || "active";
    if (status !== "active" && status !== "pending_verification") continue;
    const uid = member.data().uid || member.id;
    const doctorSnap = await getDoc(doc(state.db, "doctors", uid));
    if (!doctorSnap.exists()) continue;
    const data = { ...doctorSnap.data(), ...emptyToFallback(memberData) };
    if (data.isAvailable === false) continue;
    doctors.push(normalizeDoctor(uid, data));
  }
  return doctors.sort((a, b) => a.name.localeCompare(b.name));
}

function emptyToFallback(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

function normalizeDoctor(uid, data) {
  return {
    uid,
    name: data.name || "Doctor",
    specialty: data.specialty || "",
    clinicName: data.clinicName || "",
    clinicAddress: data.clinicAddress || "",
    city: data.city || "",
    photoUrl: data.photoUrl || "",
    isVerified: data.isVerified !== false,
  };
}

function renderHospitalShell(hospitalId) {
  els.hospitalCard.classList.remove("skeleton");
  els.hospitalCard.innerHTML = `
    <p class="eyebrow">Hospital</p>
    <h2>${escapeHtml(hospitalId)}</h2>
    <p>Sign in to load this provider.</p>
  `;
}

function renderHospital(hospitalId, hospital) {
  const adminProfile = hospital.adminProfile || {};
  const name = adminProfile.clinicName || hospital.name || hospital.clinicName || hospitalId;
  const address = adminProfile.address || hospital.address || hospital.clinicAddress || "";
  const city = hospital.city || adminProfile.city || "";
  const phone = hospital.phone || adminProfile.phone || "";
  els.hospitalCard.classList.remove("skeleton");
  els.hospitalCard.innerHTML = `
    <p class="eyebrow">Hospital</p>
    <h2>${escapeHtml(name)}</h2>
    ${address ? `<p>${escapeHtml(address)}</p>` : ""}
    ${city ? `<p>${escapeHtml(city)}</p>` : ""}
    ${phone ? `<p>${escapeHtml(phone)}</p>` : ""}
  `;
  els.workspaceTitle.textContent = "Available doctors";
}

function renderDoctors(doctors) {
  if (!doctors.length) {
    els.doctorList.innerHTML = `<div class="empty-state">No active doctors are available for this hospital yet.</div>`;
    return;
  }

  els.doctorList.innerHTML = doctors.map((doctor) => `
    <article class="doctor-card" data-doctor-id="${escapeHtml(doctor.uid)}">
      <div class="doctor-card-head">
        ${doctor.photoUrl
          ? `<img class="doctor-avatar" src="${escapeAttr(doctor.photoUrl)}" alt="">`
          : `<div class="doctor-avatar" aria-hidden="true"></div>`}
        <div>
          <h3>${escapeHtml(doctor.name)}</h3>
          <p>${escapeHtml(doctor.specialty || "General consultation")}</p>
        </div>
      </div>
      <p>${escapeHtml(doctor.clinicName || doctor.clinicAddress || doctor.city || "")}</p>
    </article>
  `).join("");

  els.doctorList.querySelectorAll(".doctor-card").forEach((card) => {
    card.addEventListener("click", () => {
      const doctor = doctors.find((item) => item.uid === card.dataset.doctorId);
      if (doctor) selectDoctorForDate(doctor);
    });
  });
}

function selectDoctorForDate(doctor) {
  if (!state.user) {
    showStatus("Sign in before checking appointment slots.");
    return;
  }
  state.selectedDoctor = doctor;
  state.selectedSlotsByStart.clear();
  els.slotPanel.hidden = false;
  els.selectedDoctorName.textContent = doctor.name;
  els.selectedDoctorMeta.textContent = doctor.specialty || "Appointment slots";
  els.slotList.innerHTML = els.dateInput.value
    ? `<div class="empty-state">Loading slots...</div>`
    : `<div class="empty-state">Select a date to view available slots.</div>`;
  document.querySelectorAll(".doctor-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.doctorId === doctor.uid);
  });

  if (els.dateInput.value) {
    loadSlots(doctor);
  } else {
    openDateDialog(doctor);
  }
}

function openDateDialog(doctor) {
  state.pendingDateDoctor = doctor;
  els.dateDialogTitle.textContent = `Choose date with ${doctor.name}`;
  els.promptDateInput.value = els.dateInput.value || els.dateInput.min || "";
  if (!els.dateDialog.open) els.dateDialog.showModal();
  requestAnimationFrame(() => els.promptDateInput.focus());
}

function confirmPromptedDate() {
  const doctor = state.pendingDateDoctor;
  const date = els.promptDateInput.value;
  if (!doctor || !date) return;
  els.dateInput.value = date;
  state.pendingDateDoctor = null;
  els.dateDialog.close();
  loadSlots(doctor);
}

async function loadSlots(doctor) {
  if (!state.user) {
    showStatus("Sign in before checking appointment slots.");
    return;
  }
  if (!els.dateInput.value) {
    els.slotList.innerHTML = `<div class="empty-state">Select a date to view available slots.</div>`;
    return;
  }
  state.selectedDoctor = doctor;
  state.selectedSlotsByStart.clear();
  els.slotPanel.hidden = false;
  els.selectedDoctorName.textContent = doctor.name;
  els.selectedDoctorMeta.textContent = doctor.specialty || "Appointment slots";
  els.slotList.innerHTML = `<div class="empty-state">Loading slots...</div>`;

  try {
    const targetDate = els.dateInput.value;
    const result = await callPatientFunction("getPatientAvailableSlots", {
      hospitalId: state.hospitalId,
      doctorId: doctor.uid,
      targetDate,
    });
    const slots = (result.data?.slots || []).map((slot) => ({
      slotId: slot.slotId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: slot.status || "available",
      startLabel: formatTime(slot.startTime),
      endLabel: formatTime(slot.endTime),
    }));
    for (const slot of slots) state.selectedSlotsByStart.set(slot.slotId, slot);
    renderSlots(slots);
  } catch (error) {
    els.slotList.innerHTML = `<div class="empty-state">Slots could not be loaded.</div>`;
    showError(error);
  }
}

function renderSlots(slots) {
  if (!slots.length) {
    els.slotList.innerHTML = `<div class="empty-state">No available slots for this date.</div>`;
    return;
  }
  els.slotList.innerHTML = slots.map((slot) => `
    <button class="slot-button ${slot.status === "available" ? "" : "unavailable"}" type="button" data-slot-id="${escapeAttr(slot.slotId)}" ${slot.status === "available" ? "" : "disabled"}>
      ${escapeHtml(slot.startLabel)}<br>
      <small>${escapeHtml(slot.endLabel)}</small>
      ${slot.status === "available" ? "" : `<span>${escapeHtml(slotStatusLabel(slot.status))}</span>`}
    </button>
  `).join("");
  els.slotList.querySelectorAll(".slot-button:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => openBookingDialog(button.dataset.slotId, button));
  });
}

function slotStatusLabel(status) {
  switch (status) {
    case "booked":
      return "Booked";
    case "busy":
      return "Busy";
    case "blocked":
      return "Blocked";
    default:
      return "Unavailable";
  }
}

function openBookingDialog(slotId, button) {
  const profile = loadProfile();
  if (!profile?.name || !profile?.phone) {
    showStatus("Add or edit patient name and phone before booking.");
    openProfileDialog();
    return;
  }
  const slot = state.selectedSlotsByStart.get(slotId);
  if (!slot || !state.selectedDoctor) return;
  if (slot.status !== "available") {
    showStatus("This slot is not available for booking.", true);
    return;
  }

  state.pendingBooking = { slotId, button };
  els.bookingConfirmTitle.textContent = "Review your appointment";
  els.bookingConfirmDoctor.textContent = state.selectedDoctor.name || "Doctor";
  els.bookingConfirmDate.textContent = formatDate(els.dateInput.value);
  els.bookingConfirmTime.textContent = `${slot.startLabel} - ${slot.endLabel}`;
  els.bookingPatientName.value = profile.name || state.user?.displayName || "";
  els.bookingPatientPhone.value = profile.phone || state.user?.phoneNumber || "";
  els.confirmBookingBtn.disabled = false;
  els.cancelBookingConfirmBtn.disabled = false;
  els.confirmBookingBtn.textContent = "Book slot";
  els.bookingDialog.showModal();
}

function closeBookingDialog() {
  state.pendingBooking = null;
  els.bookingDialog.close();
}

async function confirmPendingBooking() {
  const pending = state.pendingBooking;
  if (!pending) return;
  let patient;
  try {
    patient = validatePatientPrivateProfile(
      els.bookingPatientName.value,
      els.bookingPatientPhone.value,
    );
  } catch (error) {
    showStatus(error?.message || "Add valid patient name and phone before booking.", true);
    return;
  }
  await saveProfile({
    ...patient,
    updatedAt: new Date().toISOString(),
  });
  renderProfile();
  await bookSlot(pending.slotId, pending.button);
}

async function bookSlot(slotId, button) {
  const slot = state.selectedSlotsByStart.get(slotId);
  if (!slot || !state.selectedDoctor) return;

  button.disabled = true;
  button.textContent = "Booking...";
  els.confirmBookingBtn.disabled = true;
  els.cancelBookingConfirmBtn.disabled = true;
  els.confirmBookingBtn.textContent = "Booking...";
  try {
    const profile = loadProfile() || {};
    const result = await callPatientFunction("bookAppointment", {
      hospitalId: state.hospitalId,
      doctorId: state.selectedDoctor.uid,
      date: els.dateInput.value,
      slotId: slot.slotId,
      patientEmail: state.user.email,
    });
    const appointment = result.data?.appointment || {};
    const receipt = {
      bookingId: appointment.appointmentId,
      hospitalId: state.hospitalId,
      doctorId: state.selectedDoctor.uid,
      slotId: slot.slotId,
      doctorName: state.selectedDoctor.name,
      patientName: profile.name || "",
      patientPhone: profile.phone || "",
      patientGmail: state.user.email,
      date: els.dateInput.value,
      startTime: appointment.startTime || slot.startTime,
      endTime: appointment.endTime || slot.endTime,
      status: appointment.status || "active",
      googleEventId: appointment.googleEventId || "",
      patientGoogleEventId: "",
      createdAt: new Date().toISOString(),
    };
    await saveReceipt(receipt);
    state.pendingBooking = null;
    els.bookingDialog.close();
    showStatus("Appointment booked. The provider calendar event includes your signed-in email as an attendee.");
    await loadSlots(state.selectedDoctor);
  } catch (error) {
    showError(error?.message === "slot_taken" ? new Error("That slot was just taken.") : error);
    els.confirmBookingBtn.disabled = false;
    els.cancelBookingConfirmBtn.disabled = false;
    els.confirmBookingBtn.textContent = "Book slot";
    await loadSlots(state.selectedDoctor);
  }
}

async function showBookings() {
  if (!state.user) return;
  els.welcomeView.hidden = true;
  els.providerView.hidden = true;
  els.bookingsView.hidden = false;
  els.bookingsList.innerHTML = `<div class="empty-state">Loading bookings...</div>`;

  try {
    renderBookings(loadReceipts());
    const driveReceipts = await loadDriveReceipts();
    if (driveReceipts.length) {
      await mergeReceipts(driveReceipts, { syncDrive: false });
      renderBookings(loadReceipts());
    }
    const result = await callPatientFunction("getMyBookings", { limit: 50 });
    const remote = result.data?.bookings || [];
    await mergeRemoteReceipts(remote);
    renderBookings(loadReceipts());
  } catch (error) {
    renderBookings(loadReceipts());
    showError(error);
  }
}

async function saveReceipt(receipt) {
  await mergeReceipts([receipt]);
}

async function mergeReceipts(receipts, { syncDrive = true } = {}) {
  if (!receipts.length) return;
  const byId = new Map(loadReceipts().map((item) => [item.bookingId, item]));
  for (const receipt of receipts) {
    if (!receipt?.bookingId) continue;
    byId.set(receipt.bookingId, {
      ...byId.get(receipt.bookingId),
      ...receipt,
    });
  }
  const merged = [...byId.values()].sort(compareReceipts).slice(0, 100);
  state.receiptCache = merged;
  await writePrivateRecord(RECEIPTS_KEY, merged);
  if (syncDrive) await writeReceiptsToDrive(merged);
}

function loadReceipts() {
  return Array.isArray(state.receiptCache) ? state.receiptCache : [];
}

async function mergeRemoteReceipts(remote) {
  const local = loadReceipts();
  const byId = new Map(local.map((item) => [item.bookingId, item]));
  for (const item of remote) {
    byId.set(item.bookingId, {
      ...byId.get(item.bookingId),
      bookingId: item.bookingId,
      hospitalId: item.hospitalId || byId.get(item.bookingId)?.hospitalId || "",
      doctorId: item.doctorId,
      doctorName: byId.get(item.bookingId)?.doctorName || item.doctorName || "",
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      status: item.status,
    });
  }
  const merged = [...byId.values()].sort(compareReceipts).slice(0, 100);
  state.receiptCache = merged;
  await writePrivateRecord(RECEIPTS_KEY, merged);
  await writeReceiptsToDrive(merged);
}

async function loadDriveReceipts() {
  try {
    const token = await ensurePatientGoogleAccessToken();
    const fileId = await findDriveReceiptsFile(token);
    if (!fileId) return [];
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Drive receipts could not be loaded.");
    const payload = await response.json();
    return Array.isArray(payload?.receipts) ? payload.receipts : [];
  } catch (error) {
    showStatus("Could not sync Google Drive receipts. Showing local bookings.", true);
    return [];
  }
}

async function writeReceiptsToDrive(receipts) {
  try {
    const token = await ensurePatientGoogleAccessToken();
    const fileId = await findDriveReceiptsFile(token);
    const payload = JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      receipts: receipts.slice(0, 100),
    });
    if (fileId) {
      const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: payload,
      });
      if (!response.ok) throw new Error("Drive receipt update failed.");
    } else {
      const metadata = {
        name: DRIVE_RECEIPTS_FILE,
        parents: ["appDataFolder"],
        mimeType: "application/json",
      };
      const boundary = `niramay_${Date.now()}`;
      const multipartBody = [
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        JSON.stringify(metadata),
        `--${boundary}`,
        "Content-Type: application/json",
        "",
        payload,
        `--${boundary}--`,
      ].join("\r\n");
      const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });
      if (!response.ok) throw new Error("Drive receipt creation failed.");
      const created = await response.json();
      state.driveReceiptsFileId = created.id || "";
    }
  } catch (error) {
    showStatus("Booking saved locally, but Google Drive receipt sync failed.", true);
  }
}

async function findDriveReceiptsFile(token) {
  if (state.driveReceiptsFileId) return state.driveReceiptsFileId;
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name='${DRIVE_RECEIPTS_FILE}' and trashed=false`,
    fields: "files(id,name,modifiedTime)",
    pageSize: "1",
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Drive receipt lookup failed.");
  const data = await response.json();
  state.driveReceiptsFileId = data.files?.[0]?.id || "";
  return state.driveReceiptsFileId;
}

function compareReceipts(a, b) {
  return String(b.startTime || b.createdAt || "").localeCompare(String(a.startTime || a.createdAt || ""));
}

function renderBookings(receipts) {
  if (!receipts.length) {
    els.bookingsList.innerHTML = `<div class="empty-state">No bookings yet.</div>`;
    return;
  }
  els.bookingsList.innerHTML = receipts.map((receipt) => `
    <article class="booking-card" data-booking-id="${escapeAttr(receipt.bookingId)}">
      <div class="booking-card-head">
        <div>
          <h3>${escapeHtml(receipt.doctorName || receipt.doctorId || "Doctor")}</h3>
          <p>${escapeHtml(formatDate(receipt.date || isoDate(receipt.startTime)))}</p>
        </div>
      </div>
      <p>${escapeHtml(formatTime(receipt.startTime))} - ${escapeHtml(formatTime(receipt.endTime))}</p>
      <span class="booking-status ${receipt.status === "cancelled" ? "cancelled" : ""}">
        ${escapeHtml(receipt.status || "active")}
      </span>
      ${receipt.status === "cancelled"
        ? ""
        : `<button class="cancel-booking-btn ghost" type="button" data-booking-id="${escapeAttr(receipt.bookingId)}">Cancel booking</button>`}
    </article>
  `).join("");
  els.bookingsList.querySelectorAll(".cancel-booking-btn").forEach((button) => {
    button.addEventListener("click", () => cancelBooking(button.dataset.bookingId, button));
  });
}

async function cancelBooking(bookingId, button) {
  const receipt = loadReceipts().find((item) => item.bookingId === bookingId);
  if (!receipt) return;
  const confirmed = window.confirm(
    `Cancel appointment with ${receipt.doctorName || "doctor"} on ${formatDate(receipt.date || isoDate(receipt.startTime))}?`,
  );
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Cancelling...";
  try {
    await callPatientFunction("cancelAppointment", { bookingId });
    await saveReceipt({
      ...receipt,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    });
    renderBookings(loadReceipts());
    showStatus("Booking cancelled.");
  } catch (error) {
    showError(error);
    button.disabled = false;
    button.textContent = "Cancel booking";
  }
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value) {
  const date = value?.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || "";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function isoDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function showStatus(message, isError = false) {
  els.statusPanel.hidden = false;
  els.statusPanel.classList.toggle("error", isError);
  els.statusPanel.textContent = message;
}

function showError(error) {
  const message = error?.message || "Something went wrong.";
  showStatus(message, true);
}

function showAuthError(error) {
  const code = error?.code || "";
  const rawMessage = error?.message || "";
  if (AUTH_DEBUG) {
    console.error("Niramay auth error", error);
  }
  const messageByCode = {
    "auth/popup-closed-by-user": "Sign-in was closed before it finished.",
    "auth/popup-blocked": "The browser blocked the sign-in popup. Allow popups for this site and try again.",
    "auth/unauthorized-domain": "This hosting domain is not authorized in Firebase Authentication.",
    "auth/operation-not-allowed": "Google sign-in is not enabled in Firebase Authentication.",
    "auth/network-request-failed": "Network failed during sign-in. Please try again.",
  };
  const redirectMismatch =
    rawMessage.toLowerCase().includes("redirect_uri_mismatch") ||
    rawMessage.toLowerCase().includes("redirect uri mismatch");
  const resolvedMessage = redirectMismatch
    ? "Google sign-in redirect URI is not authorized. Add https://vana-apps.firebaseapp.com/ and https://vana-apps.web.app/ to the OAuth client's authorized redirect URIs."
    : messageByCode[code] || rawMessage || "Google sign-in failed.";
  const serverResponse = error?.customData?._tokenResponse?.error?.message
    || error?.customData?._tokenResponse?.error
    || error?.customData?.serverResponse
    || "";
  const diagnostic = [code, rawMessage, serverResponse].filter(Boolean).join(" | ");
  const details = diagnostic && !resolvedMessage.includes(diagnostic)
    ? ` (${diagnostic})`
    : "";
  showStatus(
    `${resolvedMessage}${details}`,
    true,
  );
}

function clearStatus() {
  els.statusPanel.hidden = true;
  els.statusPanel.textContent = "";
  els.statusPanel.classList.remove("error");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
