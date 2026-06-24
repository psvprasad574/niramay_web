import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check.js";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithRedirect,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

const REGION = "asia-south1";
const PRIVATE_DB_NAME = "niramay_patient_private";
const PRIVATE_STORE_NAME = "private_records";
const DRIVE_RECEIPTS_FILE = "niramay_bookings.json";
const ENCRYPTED_RECORD_PREFIX = "niramay-web-v2:";
const LEGACY_ENCRYPTED_RECORD_PREFIX = "niramay-web-v1:";
const ENCRYPTION_SALT_PREFIX = "NiramayPatientWeb2026";
const GOOGLE_DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const GOOGLE_OAUTH_CLIENT_ID = "76866563498-ks6v02eb5abro9in7imkc0f5q8kfe29j.apps.googleusercontent.com";
const PUBLIC_CONFIG = window.NIRAMAY_PUBLIC_CONFIG || {};
const URL_PARAMS = new URLSearchParams(location.search);
const FIREBASE_APP_CHECK_SITE_KEY = PUBLIC_CONFIG.appCheckSiteKey || "";
const ADS_CONFIG = PUBLIC_CONFIG.ads || {};
const MARKET_COUNTRY = normalizeMarket(URL_PARAMS.get("market") || PUBLIC_CONFIG.marketCountry);
const IS_US_MARKET = MARKET_COUNTRY === "US";
const BRAND_NAME = PUBLIC_CONFIG.brandName || (IS_US_MARKET ? "Aura" : "Niramay");
const APP_DISPLAY_NAME = PUBLIC_CONFIG.appDisplayName || `${BRAND_NAME} Aarogya`;
const PROFILE_KEY = `niramay.patient.${MARKET_COUNTRY.toLowerCase()}.profile.v1`;
const RECEIPTS_KEY = `niramay.patient.${MARKET_COUNTRY.toLowerCase()}.receipts.v1`;
const MAX_PHONE_LENGTH = 25;
const PUBLIC_HOSPITAL_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
];
const EXPECTED_PATIENT_APP_PACKAGE = IS_US_MARKET ? "com.vana.health.patient.us" : "com.vana.health.patient.in";
const EXPECTED_PATIENT_APP_SCHEME = IS_US_MARKET ? "niramay-us" : "niramay-in";
const PATIENT_APP_PACKAGE = allowedPatientPackage(PUBLIC_CONFIG.patientAppPackage);
const PATIENT_APP_SCHEME = allowedPatientScheme(PUBLIC_CONFIG.patientAppScheme);
const PATIENT_APP_INSTALL_URL = allowedPatientInstallUrl(PUBLIC_CONFIG.patientAppInstallUrl);
const APP_CHECK_CONFIG_ERROR =
  "Patient web App Check is not configured. Add the Firebase App Check reCAPTCHA v3 site key before calling Cloud Functions.";
const GOOGLE_SIGN_IN_STATE_KEY = "niramay.googleSignInState";
const GOOGLE_SIGN_IN_RETURN_KEY = "niramay.googleSignInReturnUrl";
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
  bookingPatientStateField: document.querySelector("#bookingPatientStateField"),
  bookingPatientState: document.querySelector("#bookingPatientState"),
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
  patientGoogleAccessGranted: false,
  driveReceiptsFileId: "",
  citySuggestTimer: null,
  providerSuggestTimer: null,
  patientProfile: null,
  receiptCache: [],
  pendingBooking: null,
  waitingForWebChoice: false,
  patientState: "",
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
  return httpsCallable(state.functions, name)({ market: MARKET_COUNTRY, ...data });
}

function normalizeMarket(value) {
  const market = String(value || "IN").trim().toUpperCase();
  return market === "US" ? "US" : "IN";
}

function allowedPatientPackage(value) {
  const packageName = String(value || EXPECTED_PATIENT_APP_PACKAGE).trim();
  if (packageName !== EXPECTED_PATIENT_APP_PACKAGE) {
    console.error("Ignoring invalid patient app package config.");
    return EXPECTED_PATIENT_APP_PACKAGE;
  }
  return packageName;
}

function allowedPatientScheme(value) {
  const scheme = String(value || EXPECTED_PATIENT_APP_SCHEME).trim();
  if (scheme !== EXPECTED_PATIENT_APP_SCHEME) {
    console.error("Ignoring invalid patient app scheme config.");
    return EXPECTED_PATIENT_APP_SCHEME;
  }
  return scheme;
}

function allowedPatientInstallUrl(value) {
  const fallback = `https://play.google.com/store/apps/details?id=${EXPECTED_PATIENT_APP_PACKAGE}`;
  try {
    const url = new URL(value || fallback);
    if (
      url.protocol === "https:" &&
      url.hostname === "play.google.com" &&
      url.pathname === "/store/apps/details" &&
      url.searchParams.get("id") === EXPECTED_PATIENT_APP_PACKAGE
    ) {
      return url.toString();
    }
  } catch (_) {
    // Fall through to the safe default.
  }
  console.error("Ignoring invalid patient app install URL config.");
  return fallback;
}

async function loadFirebaseConfig() {
  if (PUBLIC_CONFIG.firebaseConfig) return normalizeFirebaseConfig(PUBLIC_CONFIG.firebaseConfig);
  const response = await fetch(FIREBASE_CONFIG_URL, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(
      "Firebase config is unavailable. Deploy on Firebase Hosting or set window.NIRAMAY_PUBLIC_CONFIG.firebaseConfig for local development.",
    );
  }
  return normalizeFirebaseConfig(await response.json());
}

function normalizeFirebaseConfig(config) {
  return { ...config };
}

async function main() {
  state.app = initializeApp(await loadFirebaseConfig());
  initializePatientAppCheck();
  initializeMarketUi();
  state.auth = getAuth(state.app);
  state.db = getFirestore(state.app);
  state.functions = getFunctions(state.app, REGION);
  await setPersistence(state.auth, browserLocalPersistence);
  await getRedirectResult(state.auth).catch((error) => {
    showAuthError(error);
  });

  bindEvents();
  hydrateInitialRoute();
  showHospitalLinkChoice();
  initializeDateInput();
  renderProfile();

  onAuthStateChanged(state.auth, async (user) => {
    state.user = user;
    updateAdVisibilityForAuthState();
    renderAuth();
    if (user) {
      try {
        await hydratePrivateCaches();
        await hydratePatientProfileFromAuth(user);
        renderProfile();
        await ensurePatientId();
        if (!state.hospitalId) maybeAutoUseLocation();
      } catch (error) {
        showError(error);
      }
    } else {
      state.patientProfile = null;
      state.receiptCache = [];
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

function updateAdVisibilityForAuthState() {
  if (!ADS_CONFIG.enabled || (ADS_CONFIG.signedOutOnly !== false && state.user)) {
    hideBannerAds();
    return;
  }
  initializeBannerAds();
}

function initializeMarketUi() {
  document.title = `${BRAND_NAME} Patient Booking`;
  document
    .querySelector("meta[name='description']")
    ?.setAttribute(
      "content",
      `Book appointments with ${BRAND_NAME} providers from the web.`,
    );
  document
    .querySelector(".brand")
    ?.setAttribute("aria-label", `${BRAND_NAME} home`);
  const brandLabel = document.querySelector(".brand strong");
  if (brandLabel) brandLabel.textContent = BRAND_NAME;
  const linkChoiceText = document.querySelector("#hospitalLinkChoice .link-choice-card > p:not(.eyebrow)");
  if (linkChoiceText) {
    linkChoiceText.textContent = `Continue in browser or install ${APP_DISPLAY_NAME}.`;
  }
  if (els.installAppBtn) {
    els.installAppBtn.href = PATIENT_APP_INSTALL_URL;
  }
  on(els.installAppBtn, "click", (event) => {
    if (!state.hospitalId || !isAndroidUserAgent()) return;
    event.preventDefault();
    openPatientApp(state.hospitalId);
  });
  if (els.patientPhone) els.patientPhone.maxLength = MAX_PHONE_LENGTH;
  if (els.bookingPatientPhone) els.bookingPatientPhone.maxLength = MAX_PHONE_LENGTH;
  if (!els.bookingPatientState) return;
  els.bookingPatientState.innerHTML = `<option value="">Select state</option>${US_STATES
    .map((stateCode) => `<option value="${stateCode}">${stateCode}</option>`)
    .join("")}`;
  els.bookingPatientState.addEventListener("change", () => {
    state.patientState = normalizePatientState(els.bookingPatientState.value);
  });
}

function initializeBannerAds() {
  if (!ADS_CONFIG.enabled) return;
  if (ADS_CONFIG.signedOutOnly !== false && state.user) return;
  const client = ADS_CONFIG.client || "";
  if (!client) {
    console.warn("Patient web ads are enabled but ads.client is missing.");
    return;
  }

  const slots = [
    { element: els.desktopLeftAd, slot: ADS_CONFIG.desktopLeftSlot, className: "ad-unit-side" },
    { element: els.desktopRightAd, slot: ADS_CONFIG.desktopRightSlot, className: "ad-unit-side" },
    { element: els.mobileBottomAd, slot: ADS_CONFIG.mobileBottomSlot, className: "ad-unit-mobile" },
  ].filter((item) => item.element && item.slot);

  if (!slots.length) {
    console.warn("Patient web ads are enabled but no ad slot IDs are configured.");
    return;
  }
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

function hideBannerAds() {
  for (const element of [els.desktopLeftAd, els.desktopRightAd, els.mobileBottomAd]) {
    if (element) {
      element.hidden = true;
      element.innerHTML = "";
    }
  }
  document.body.classList.remove("has-mobile-ad");
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
  state.patientProfile = profile || null;
  state.receiptCache = Array.isArray(receipts) ? receipts : [];
}

function currentUserIdForPrivateData() {
  const uid = state.auth?.currentUser?.uid || state.user?.uid || "";
  if (!uid) throw new Error("Sign in before accessing private records.");
  return uid;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function legacyPrivateCryptoKey() {
  const uid = currentUserIdForPrivateData();
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(uid),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(`${ENCRYPTION_SALT_PREFIX}:${MARKET_COUNTRY}`),
      iterations: 100000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function getStoredPrivateCryptoKey(uid) {
  const db = await openPrivateDb();
  return new Promise((resolve) => {
    const tx = db.transaction(PRIVATE_STORE_NAME, "readonly");
    const request = tx.objectStore(PRIVATE_STORE_NAME).get(`crypto:${uid}:${MARKET_COUNTRY}:v2`);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
}

async function storePrivateCryptoKey(uid, key) {
  const db = await openPrivateDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRIVATE_STORE_NAME, "readwrite");
    tx.objectStore(PRIVATE_STORE_NAME).put(key, `crypto:${uid}:${MARKET_COUNTRY}:v2`);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Private key storage failed."));
    };
  });
}

async function privateCryptoKey() {
  const uid = currentUserIdForPrivateData();
  const stored = await getStoredPrivateCryptoKey(uid);
  if (stored) return stored;
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  await storePrivateCryptoKey(uid, key);
  return key;
}

async function encryptPrivateJson(value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await privateCryptoKey();
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  return `${ENCRYPTED_RECORD_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(cipher)}`;
}

async function decryptPrivateJson(value) {
  if (typeof value !== "string") {
    throw new Error("Private payload is not encrypted.");
  }
  const isCurrent = value.startsWith(ENCRYPTED_RECORD_PREFIX);
  const prefix = isCurrent ? ENCRYPTED_RECORD_PREFIX : LEGACY_ENCRYPTED_RECORD_PREFIX;
  if (!value.startsWith(prefix)) throw new Error("Private payload is not encrypted.");
  const payload = value.substring(prefix.length);
  const separator = payload.indexOf(":");
  if (separator <= 0) throw new Error("Invalid encrypted private payload.");
  const iv = base64ToBytes(payload.substring(0, separator));
  const cipher = base64ToBytes(payload.substring(separator + 1));
  const key = isCurrent ? await privateCryptoKey() : await legacyPrivateCryptoKey();
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
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
    request.onsuccess = async () => {
      try {
        resolve(request.result ? await decryptPrivateJson(request.result) : null);
      } catch (_) {
        resolve(null);
      }
    };
    request.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
}

async function writePrivateRecord(key, value) {
  const encrypted = await encryptPrivateJson(value);
  const db = await openPrivateDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRIVATE_STORE_NAME, "readwrite");
    tx.objectStore(PRIVATE_STORE_NAME).put(encrypted, key);
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
    els.signInBtn.textContent = "Opening sign in...";
    try {
      await startGoogleRedirectSignIn();
    } catch (error) {
      showAuthError(error);
      els.signInBtn.disabled = false;
      els.signInBtn.textContent = "Sign in";
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
    state.patientGoogleAccessGranted = false;
    state.driveReceiptsFileId = "";
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

function startGoogleRedirectSignIn() {
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithRedirect(state.auth, provider);
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

function isAndroidUserAgent() {
  return /Android/i.test(navigator.userAgent || "");
}

function openPatientApp(hospitalId) {
  const validHospitalId = cleanId(hospitalId);
  if (!validHospitalId) return;
  const encodedHospitalId = encodeURIComponent(validHospitalId);
  const fallbackUrl = encodeURIComponent(window.location.href);
  window.location.href = `intent://hospital/${encodedHospitalId}#Intent;scheme=${PATIENT_APP_SCHEME};package=${PATIENT_APP_PACKAGE};S.browser_fallback_url=${fallbackUrl};end`;
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
  const id = sanitizeUserText(value, 128).replace(/^\/+|\/+$/g, "");
  return PUBLIC_HOSPITAL_ID_PATTERN.test(id) ? id : "";
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
    els.signInBtn.disabled = false;
    els.signInBtn.textContent = "Sign in";
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
  return Boolean(state.user && state.patientGoogleAccessGranted);
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
        state.patientGoogleAccessGranted = true;
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

function renderSearchResults(results) {
  if (!results.length) {
    els.searchResults.innerHTML = `<div class="empty-state">No matching providers found.</div>`;
    return;
  }
  els.searchResults.innerHTML = results.map((result) => `
    <article class="search-result-card" data-hospital-id="${escapeAttr(result.hospitalId)}">
      ${result.photoUrl
        ? `<img class="hospital-thumb" src="${escapeAttr(result.photoUrl)}" alt="">`
        : `<div class="hospital-thumb hospital-thumb-empty" aria-hidden="true"></div>`}
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
  const phone = sanitizeUserText(phoneValue, MAX_PHONE_LENGTH);
  if (!name) throw new Error("Patient name is required.");
  if (!/^[A-Za-z][A-Za-z .'-]{1,98}$/.test(name)) {
    throw new Error("Enter a valid patient name.");
  }
  if (!phone) throw new Error("Patient phone is required.");
  const cleanedPhone = phone.replace(/[\s\-\u2010-\u2015\u2212.()]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(cleanedPhone)) {
    throw new Error("Enter a valid international phone number, including country code.");
  }
  return { name, phone };
}

function normalizePatientState(value) {
  return String(value || "").trim().toUpperCase();
}

function isUsVerifiedDoctor(doctor) {
  const credential = doctor?.credential || {};
  return credential.country === "US" && credential.status === "verified";
}

function allowedPatientStates(doctor) {
  const states = doctor?.credential?.allowedPatientStates;
  return Array.isArray(states)
    ? states.map((item) => String(item).trim().toUpperCase()).filter(Boolean)
    : [];
}

function titleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function locationErrorMessage(error) {
  if (error?.code === 1) return "Location permission was denied.";
  if (error?.code === 2) return "Current location could not be detected.";
  if (error?.code === 3) return "Location request timed out.";
  return "Could not read your current location.";
}

async function loadHospitalContext(hospitalId) {
  const requestedHospitalId = cleanId(hospitalId);
  state.hospitalId = requestedHospitalId;
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
      renderHospitalShell(requestedHospitalId);
      return;
    }

    const context = await fetchPatientHospitalContext(requestedHospitalId);
    const hospital = context.hospital;
    state.hospitalId = hospital.id;
    const doctors = context.doctors;

    state.hospital = hospital;
    state.doctors = doctors;
    renderHospital(hospital);
    renderDoctors(doctors);
  } catch (error) {
    showError(error);
    renderHospitalShell(requestedHospitalId);
  }
}

async function fetchPatientHospitalContext(hospitalId) {
  const result = await callPatientFunction("getPatientHospitalContext", {
    hospitalId: cleanId(hospitalId),
  });
  const hospital = result.data?.hospital;
  if (!hospital?.hospitalId) throw new Error("Hospital code was not found.");
  return {
    hospital: normalizeHospital(hospital.hospitalId, hospital),
    doctors: Array.isArray(result.data?.doctors)
      ? result.data.doctors.map((doctor) => normalizeDoctor(doctor.uid || doctor.docId, doctor))
      : [],
  };
}

function normalizeHospital(hospitalId, data) {
  const adminProfile = data.adminProfile || {};
  const address = firstText(
    adminProfile.clinicAddress,
    adminProfile.address,
    data.clinicAddress,
    data.address,
  );
  return {
    ...data,
    id: hospitalId,
    name: firstText(
      adminProfile.clinicName,
      data.clinicName,
      data.name,
      adminProfile.name,
      "Hospital",
    ),
    address,
    city: firstText(adminProfile.city, data.city),
    state: firstText(adminProfile.state, data.state),
    phone: firstText(adminProfile.phone, data.phone),
    photoUrl: hospitalImageUrl(data),
    hospitalPhotoUrls: hospitalImageUrls(data),
    adminProfile: { ...adminProfile, address },
  };
}

function firstText(...values) {
  return values.map((value) => sanitizeUserText(value, 180)).find(Boolean) || "";
}

function firstUrl(...values) {
  return values.map((value) => sanitizeUserText(value, 2000)).find(Boolean) || "";
}

function firstStringArray(...values) {
  for (const value of values) {
    if (!Array.isArray(value)) continue;
    const urls = value
      .map((url) => sanitizeUserText(url, 1000))
      .filter(Boolean);
    if (urls.length) return [...new Set(urls)];
  }
  return [];
}

function hospitalImageUrl(data) {
  const adminProfile = data.adminProfile || {};
  return firstUrl(
    adminProfile.hospitalPhotoUrl,
    data.hospitalPhotoUrl,
    adminProfile.profilePhotoUrl,
    adminProfile.adminPhotoUrl,
    adminProfile.photoUrl,
    data.hospitalIconUrl,
    data.profilePhotoUrl,
    data.photoUrl,
    ...hospitalImageUrls(data),
  );
}

function hospitalImageUrls(data) {
  const adminProfile = data.adminProfile || {};
  return firstStringArray(adminProfile.hospitalPhotoUrls, data.hospitalPhotoUrls);
}

function doctorImageUrl(data) {
  return firstUrl(
    data.photoUrl,
    data.profilePhotoUrl,
    data.doctorPhotoUrl,
    data.memberPhotoUrl,
    data.avatarUrl,
    data.imageUrl,
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
    photoUrl: doctorImageUrl(data),
    hospitalIconUrl: firstText(data.hospitalIconUrl),
    hospitalPhotoUrls: firstStringArray(data.hospitalPhotoUrls),
    credential: data.credential || null,
    isVerified: data.isVerified !== false,
    isAvailable: data.isAvailable !== false,
  };
}

function renderHospitalShell(hospitalId) {
  els.hospitalCard.classList.remove("skeleton");
  els.hospitalCard.innerHTML = `
    <p class="eyebrow">Hospital</p>
    <h2>Hospital booking</h2>
    <p>Sign in to load this provider.</p>
  `;
}

function renderHospital(hospital) {
  const name = hospital.name || "Hospital";
  const address = hospital.address || "";
  const city = hospital.city || "";
  const phone = hospital.phone || "";
  const photoUrl = hospital.photoUrl || "";
  els.hospitalCard.classList.remove("skeleton");
  els.hospitalCard.innerHTML = `
    ${photoUrl ? `<img class="hospital-photo" src="${escapeAttr(photoUrl)}" alt="">` : ""}
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
    })).filter((slot) => isFutureSlot(slot));
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

function isFutureSlot(slot) {
  const start = new Date(slot?.startTime || "");
  return Number.isFinite(start.getTime()) && start > new Date();
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
  if (!isFutureSlot(slot)) {
    showStatus("This slot has already passed. Please choose a future slot.", true);
    return;
  }
  if (IS_US_MARKET && !isUsVerifiedDoctor(state.selectedDoctor)) {
    showStatus("Doctor license verification is pending.", true);
    return;
  }

  state.pendingBooking = { slotId, button };
  const allowedStates = allowedPatientStates(state.selectedDoctor);
  els.bookingConfirmTitle.textContent = "Review your appointment";
  els.bookingConfirmDoctor.textContent = state.selectedDoctor.name || "Doctor";
  els.bookingConfirmDate.textContent = formatDate(els.dateInput.value);
  els.bookingConfirmTime.textContent = `${slot.startLabel} - ${slot.endLabel}`;
  els.bookingPatientName.value = profile.name || state.user?.displayName || "";
  els.bookingPatientPhone.value = profile.phone || state.user?.phoneNumber || "";
  if (els.bookingPatientStateField && els.bookingPatientState) {
    els.bookingPatientStateField.hidden = !IS_US_MARKET;
    if (IS_US_MARKET) {
      const options = allowedStates.length ? allowedStates : US_STATES;
      els.bookingPatientState.innerHTML = `<option value="">Select state</option>${options
        .map((stateCode) => `<option value="${escapeAttr(stateCode)}">${escapeHtml(stateCode)}</option>`)
        .join("")}`;
      els.bookingPatientState.value =
        options.includes(state.patientState) ? state.patientState : options.length === 1 ? options[0] : "";
      state.patientState = normalizePatientState(els.bookingPatientState.value);
    }
  }
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
    if (IS_US_MARKET && !normalizePatientState(els.bookingPatientState.value)) {
      throw new Error("Select the patient state.");
    }
    if (IS_US_MARKET) state.patientState = normalizePatientState(els.bookingPatientState.value);
  } catch (error) {
    showStatus(error?.message || "Add valid patient name and phone before booking.", true);
    return;
  }
  els.confirmBookingBtn.disabled = true;
  els.cancelBookingConfirmBtn.disabled = true;
  els.confirmBookingBtn.textContent = "Preparing...";
  try {
    await saveProfile({
      ...patient,
      updatedAt: new Date().toISOString(),
    });
    renderProfile();
    await ensurePatientGoogleAccessToken();
  } catch (error) {
    showStatus(
      error?.message ||
        "Allow Google Drive access before booking so your receipt can be backed up.",
      true,
    );
    els.confirmBookingBtn.disabled = false;
    els.cancelBookingConfirmBtn.disabled = false;
    els.confirmBookingBtn.textContent = "Book slot";
    return;
  }
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
      patientName: profile.name || "",
      patientPhone: profile.phone || "",
      ...(IS_US_MARKET && state.patientState ? { patientState: state.patientState } : {}),
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
    await saveReceipt(receipt, { syncDrive: false });
    try {
      await writeReceiptsToDrive(loadReceipts());
    } catch (driveError) {
      console.warn("Drive receipt backup failed after booking.", driveError);
    }
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

async function saveReceipt(receipt, options) {
  await mergeReceipts([receipt], options);
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
  if (syncDrive) syncReceiptsToDriveIfAuthorized();
}

function syncReceiptsToDriveIfAuthorized() {
  if (!hasGrantedGoogleAccess()) return;
  writeReceiptsToDrive(loadReceipts()).catch((error) => {
    console.warn("Background Drive receipt sync failed.", error);
  });
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
  syncReceiptsToDriveIfAuthorized();
}

async function loadDriveReceipts() {
  if (!hasGrantedGoogleAccess()) return [];
  try {
    const token = await ensurePatientGoogleAccessToken();
    const fileId = await findDriveReceiptsFile(token);
    if (!fileId) return [];
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Drive receipts could not be loaded.");
    const payload = await decryptPrivateJson(await response.text());
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
    const payload = await encryptPrivateJson({
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
    ? "Google sign-in redirect URI is not authorized. Add https://vana-apps.web.app/ to the OAuth client's authorized redirect URIs."
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
