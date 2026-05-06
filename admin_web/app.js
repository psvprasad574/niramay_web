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
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const REGION = "asia-south1";
const GOOGLE_OAUTH_CLIENT_ID = "76866563498-ks6v02eb5abro9in7imkc0f5q8kfe29j.apps.googleusercontent.com";
const ADMIN_CONFIG = window.NIRAMAY_ADMIN_CONFIG || {};
const FIREBASE_APP_CHECK_SITE_KEY = ADMIN_CONFIG.appCheckSiteKey || "";
const APP_CHECK_CONFIG_ERROR =
  "Admin web App Check is not configured. Add the Firebase App Check reCAPTCHA Enterprise site key before calling Cloud Functions.";
const GOOGLE_SIGN_IN_STATE_KEY = "niramay.admin.signInState";
const GOOGLE_SIGN_IN_RETURN_KEY = "niramay.admin.signInReturn";
const PATIENT_WEB_BASE_URL = ADMIN_CONFIG.patientWebBaseUrl || "https://vana-apps.web.app";
const FIREBASE_CONFIG_URL = "/__/firebase/init.json";

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const els = {
  signInBtn: document.querySelector("#signInBtn"),
  signOutBtn: document.querySelector("#signOutBtn"),
  statusPanel: document.querySelector("#statusPanel"),
  signInView: document.querySelector("#signInView"),
  dashboardView: document.querySelector("#dashboardView"),
  hospitalName: document.querySelector("#hospitalName"),
  hospitalAddress: document.querySelector("#hospitalAddress"),
  hospitalCity: document.querySelector("#hospitalCity"),
  hospitalPhone: document.querySelector("#hospitalPhone"),
  hospitalId: document.querySelector("#hospitalId"),
  adminProfileDetails: document.querySelector("#adminProfileDetails"),
  editAdminProfileBtn: document.querySelector("#editAdminProfileBtn"),
  doctorSelect: document.querySelector("#doctorSelect"),
  dateSelect: document.querySelector("#dateSelect"),
  loadSlotsBtn: document.querySelector("#loadSlotsBtn"),
  connectCalendarBtn: document.querySelector("#connectCalendarBtn"),
  authorSlotsBtn: document.querySelector("#authorSlotsBtn"),
  slotGrid: document.querySelector("#slotGrid"),
  memberList: document.querySelector("#memberList"),
  bookingDateFrom: document.querySelector("#bookingDateFrom"),
  bookingDateTo: document.querySelector("#bookingDateTo"),
  loadBookingsBtn: document.querySelector("#loadBookingsBtn"),
  bookingList: document.querySelector("#bookingList"),
  scheduleTab: document.querySelector("#scheduleTab"),
  membersTab: document.querySelector("#membersTab"),
  bookingsTab: document.querySelector("#bookingsTab"),
  // Admin profile dialog
  adminProfileDialog: document.querySelector("#adminProfileDialog"),
  adminProfileForm: document.querySelector("#adminProfileForm"),
  cancelAdminProfileBtn: document.querySelector("#cancelAdminProfileBtn"),
  apName: document.querySelector("#apName"),
  apSpecialty: document.querySelector("#apSpecialty"),
  apClinicName: document.querySelector("#apClinicName"),
  apPhone: document.querySelector("#apPhone"),
  apClinicAddress: document.querySelector("#apClinicAddress"),
  apState: document.querySelector("#apState"),
  apDistrict: document.querySelector("#apDistrict"),
  apCity: document.querySelector("#apCity"),
  apYears: document.querySelector("#apYears"),
  apServices: document.querySelector("#apServices"),
  apAbout: document.querySelector("#apAbout"),
  apMapsLink: document.querySelector("#apMapsLink"),
  apLat: document.querySelector("#apLat"),
  apLng: document.querySelector("#apLng"),
  apUseLocationBtn: document.querySelector("#apUseLocationBtn"),
  apLocationStatus: document.querySelector("#apLocationStatus"),
  // Doctor profile dialog
  doctorProfileDialog: document.querySelector("#doctorProfileDialog"),
  doctorProfileForm: document.querySelector("#doctorProfileForm"),
  doctorProfileTitle: document.querySelector("#doctorProfileTitle"),
  cancelDoctorProfileBtn: document.querySelector("#cancelDoctorProfileBtn"),
  dpDoctorId: document.querySelector("#dpDoctorId"),
  dpName: document.querySelector("#dpName"),
  dpEmail: document.querySelector("#dpEmail"),
  dpSpecialty: document.querySelector("#dpSpecialty"),
  dpPhone: document.querySelector("#dpPhone"),
  dpLicense: document.querySelector("#dpLicense"),
  dpYears: document.querySelector("#dpYears"),
  dpServices: document.querySelector("#dpServices"),
  dpAbout: document.querySelector("#dpAbout"),
  dpState: document.querySelector("#dpState"),
  dpDistrict: document.querySelector("#dpDistrict"),
  dpCity: document.querySelector("#dpCity"),
  dpClinicAddress: document.querySelector("#dpClinicAddress"),
  dpLat: document.querySelector("#dpLat"),
  dpLng: document.querySelector("#dpLng"),
  dpUseLocationBtn: document.querySelector("#dpUseLocationBtn"),
  dpLocationStatus: document.querySelector("#dpLocationStatus"),
  // Author / slot dialogs
  authorDialog: document.querySelector("#authorDialog"),
  authorForm: document.querySelector("#authorForm"),
  authorDialogTitle: document.querySelector("#authorDialogTitle"),
  authorStart: document.querySelector("#authorStart"),
  authorEnd: document.querySelector("#authorEnd"),
  authorDuration: document.querySelector("#authorDuration"),
  authorBreakStart: document.querySelector("#authorBreakStart"),
  authorBreakEnd: document.querySelector("#authorBreakEnd"),
  cancelAuthorBtn: document.querySelector("#cancelAuthorBtn"),
  slotActionDialog: document.querySelector("#slotActionDialog"),
  slotActionEyebrow: document.querySelector("#slotActionEyebrow"),
  slotActionTitle: document.querySelector("#slotActionTitle"),
  slotActionMeta: document.querySelector("#slotActionMeta"),
  slotActionMenu: document.querySelector("#slotActionMenu"),
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  app: null,
  auth: null,
  db: null,
  functions: null,
  user: null,
  hospitalId: null,
  hospital: null,
  members: [],
  doctors: [],
  currentSlots: {},
};

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
main().catch(showError);

async function main() {
  state.app = initializeApp(await loadFirebaseConfig());
  initializeAdminAppCheck();
  state.auth = getAuth(state.app);
  state.db = getFirestore(state.app);
  state.functions = getFunctions(state.app, REGION);

  await handleGoogleIdTokenRedirect();
  initDateInputs();
  bindEvents();

  onAuthStateChanged(state.auth, async (user) => {
    state.user = user;
    renderAuth();
    if (user) {
      try {
        await detectHospital();
      } catch (error) {
        showError(error);
      }
    }
  });
}

async function loadFirebaseConfig() {
  if (ADMIN_CONFIG.firebaseConfig) {
    return ADMIN_CONFIG.firebaseConfig;
  }
  const response = await fetch(FIREBASE_CONFIG_URL, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(
      "Firebase config is unavailable. Deploy on Firebase Hosting or set window.NIRAMAY_ADMIN_CONFIG.firebaseConfig for local development.",
    );
  }
  return response.json();
}

function initializeAdminAppCheck() {
  if (!FIREBASE_APP_CHECK_SITE_KEY) {
    throw new Error(APP_CHECK_CONFIG_ERROR);
  }
  if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(state.app, {
    provider: new ReCaptchaEnterpriseProvider(FIREBASE_APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
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

async function handleGoogleIdTokenRedirect() {
  if (!location.hash || !location.hash.includes("id_token=")) return;
  const params = new URLSearchParams(location.hash.slice(1));
  const error = params.get("error");
  if (error) throw new Error(params.get("error_description") || error);

  const returnedState = params.get("state") || "";
  const expectedState = sessionStorage.getItem(GOOGLE_SIGN_IN_STATE_KEY) || "";
  if (!returnedState || returnedState !== expectedState) {
    throw new Error("Google sign-in state did not match. Please try again.");
  }

  const idToken = params.get("id_token") || "";
  if (!idToken) throw new Error("Google sign-in did not return an ID token.");

  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(state.auth, credential);
  sessionStorage.removeItem(GOOGLE_SIGN_IN_STATE_KEY);
  const returnUrl = sessionStorage.getItem(GOOGLE_SIGN_IN_RETURN_KEY) || "/";
  sessionStorage.removeItem(GOOGLE_SIGN_IN_RETURN_KEY);

  const cleanUrl = new URL(returnUrl, location.origin);
  if (cleanUrl.origin !== location.origin) cleanUrl.href = `${location.origin}/`;
  cleanUrl.hash = "";
  history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}`);
}

function randomToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Hospital detection
// ---------------------------------------------------------------------------
async function detectHospital() {
  const email = state.user.email?.toLowerCase();
  if (!email) {
    showStatus("No email found on your Google account.", true);
    return;
  }

  const mapSnap = await getDoc(doc(state.db, "map", email));
  if (!mapSnap.exists()) {
    showStatus("Your account is not linked to any hospital. Set up your hospital in the Niramay app first.", true);
    return;
  }

  const mapData = mapSnap.data();
  const hospitalId = mapData.uuid || mapData.hospitalId || "";
  if (!hospitalId) {
    showStatus("No hospital found for your account.", true);
    return;
  }

  const hospitalSnap = await getDoc(doc(state.db, "hospitals", hospitalId));
  if (!hospitalSnap.exists()) {
    showStatus(`Hospital ${hospitalId} not found in Firestore.`, true);
    return;
  }

  const hospital = hospitalSnap.data();
  if (hospital.adminUid !== state.user.uid) {
    showStatus("You are not the admin of this hospital. Only the hospital admin can access this dashboard.", true);
    return;
  }

  state.hospitalId = hospitalId;
  state.hospital = hospital;
  renderHospital();
  await loadMembers();
}

// ---------------------------------------------------------------------------
// Cloud Function caller
// ---------------------------------------------------------------------------
async function callFunction(name, data = {}) {
  if (!state.auth?.currentUser) throw new Error("Sign in first.");
  if (!FIREBASE_APP_CHECK_SITE_KEY) throw new Error(APP_CHECK_CONFIG_ERROR);
  await state.auth.currentUser.getIdToken(true);
  return httpsCallable(state.functions, name)(data);
}

function sanitizeFormText(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function validateRequiredText(value, label, maxLength = 100) {
  const sanitized = sanitizeFormText(value, maxLength);
  if (!sanitized) throw new Error(`${label} is required.`);
  return sanitized;
}

function validateOptionalPhone(value) {
  const phone = sanitizeFormText(value, 20);
  if (!phone) return "";
  const cleaned = phone.replace(/[\s\-.()]/g, "");
  if (!/^(\+91|0)?[6-9]\d{9}$/.test(cleaned)) {
    throw new Error("Enter a valid phone number.");
  }
  return phone;
}

function validateEmail(value, label = "Email") {
  const email = sanitizeFormText(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  }
  return email;
}

function validateOptionalUrl(value, label = "URL") {
  const url = sanitizeFormText(value, 500);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error();
    return parsed.toString();
  } catch (_) {
    throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  }
}

function validateOptionalNumber(value, label, min, max) {
  if (value === "" || value == null) return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return numberValue;
}

// ---------------------------------------------------------------------------
// Reverse geocoding via Google Maps
// ---------------------------------------------------------------------------
async function reverseGeocode(latitude, longitude) {
  const result = await callFunction("googlePlacesProxy", {
    action: "reverseGeocode",
    lat: latitude,
    lng: longitude,
  });
  const data = result.data || {};
  if (!data.results?.length) return null;

  const components = data.results.flatMap((r) => r.address_components || []);
  const find = (...types) => {
    for (const type of types) {
      const c = components.find((c) => c.types?.includes(type));
      if (c) return c.long_name || c.short_name || "";
    }
    return "";
  };

  const formattedAddress = data.results[0]?.formatted_address || "";
  const sublocality = find("sublocality_level_1", "sublocality");
  const locality = find("locality");
  const district = find("administrative_area_level_3", "administrative_area_level_2");
  const stateName = find("administrative_area_level_1");
  const route = find("route");
  const streetNumber = find("street_number");

  const streetParts = [streetNumber, route, sublocality].filter(Boolean);
  const address = streetParts.length ? streetParts.join(", ") : formattedAddress;

  return {
    address,
    city: locality || district || "",
    district: district || "",
    state: stateName || "",
    formattedAddress,
  };
}

async function getCurrentPositionAndGeocode(statusEl, fields) {
  if (!navigator.geolocation) {
    statusEl.textContent = "Geolocation not available.";
    return;
  }

  statusEl.textContent = "Getting location...";
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000,
      });
    });

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    fields.lat.value = lat;
    fields.lng.value = lng;

    statusEl.textContent = "Reverse geocoding...";
    const geo = await reverseGeocode(lat, lng);
    if (geo) {
      if (fields.address && !fields.address.value) fields.address.value = geo.address;
      if (fields.city && !fields.city.value) fields.city.value = geo.city;
      if (fields.district && !fields.district.value) fields.district.value = geo.district;
      if (fields.state && !fields.state.value) fields.state.value = geo.state;
      statusEl.textContent = `Located: ${geo.formattedAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}`;
    } else {
      statusEl.textContent = `Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)} (address lookup failed)`;
    }
  } catch (error) {
    const msg = error?.code === 1 ? "Location permission denied."
      : error?.code === 3 ? "Location timed out."
      : "Could not get location.";
    statusEl.textContent = msg;
  }
}

// ---------------------------------------------------------------------------
// Admin profile
// ---------------------------------------------------------------------------
function openAdminProfileDialog() {
  const ap = state.hospital?.adminProfile || {};
  els.apName.value = ap.name || state.user?.displayName || "";
  els.apSpecialty.value = ap.specialty || "";
  els.apClinicName.value = ap.clinicName || state.hospital?.name || "";
  els.apPhone.value = ap.phone || state.hospital?.phone || "";
  els.apClinicAddress.value = ap.clinicAddress || ap.address || state.hospital?.address || "";
  els.apState.value = ap.state || "";
  els.apDistrict.value = ap.district || "";
  els.apCity.value = ap.city || state.hospital?.city || "";
  els.apYears.value = ap.yearsOfExperience ?? "";
  els.apServices.value = ap.services || "";
  els.apAbout.value = ap.aboutText || "";
  els.apMapsLink.value = ap.googleMapsLink || "";
  els.apLat.value = ap.latitude ?? "";
  els.apLng.value = ap.longitude ?? "";
  els.apLocationStatus.textContent = "";
  els.adminProfileDialog.showModal();
}

async function saveAdminProfile(event) {
  event.preventDefault();
  try {
    const payload = {
      hospitalId: state.hospitalId,
      name: validateRequiredText(els.apName.value, "Name", 100),
      specialty: sanitizeFormText(els.apSpecialty.value, 500),
      clinicName: validateRequiredText(els.apClinicName.value, "Clinic name", 200),
      phone: validateOptionalPhone(els.apPhone.value),
      clinicAddress: sanitizeFormText(els.apClinicAddress.value, 500),
      state: sanitizeFormText(els.apState.value, 100),
      district: sanitizeFormText(els.apDistrict.value, 100),
      city: sanitizeFormText(els.apCity.value, 100),
      yearsOfExperience: validateOptionalNumber(els.apYears.value, "Years of experience", 0, 80),
      services: sanitizeFormText(els.apServices.value, 500),
      aboutText: sanitizeFormText(els.apAbout.value, 2000),
      googleMapsLink: validateOptionalUrl(els.apMapsLink.value, "Google Maps link"),
      latitude: validateOptionalNumber(els.apLat.value, "Latitude", -90, 90),
      longitude: validateOptionalNumber(els.apLng.value, "Longitude", -180, 180),
    };

    els.adminProfileDialog.close();
    showStatus("Saving admin profile...");
    const result = await callFunction("updateHospitalAdminProfile", payload);
    const adminProfile = result.data?.adminProfile || payload;
    state.hospital = {
      ...state.hospital,
      adminProfile,
      name: payload.clinicName,
      address: payload.clinicAddress,
      phone: payload.phone,
      city: payload.city.toLowerCase(),
      adminName: payload.name,
    };
    renderHospital();
    showStatus("Admin profile saved.");
  } catch (error) {
    showError(error);
  }
}

// ---------------------------------------------------------------------------
// Doctor profile
// ---------------------------------------------------------------------------
function openDoctorProfileDialog(memberId) {
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return;

  const ap = state.hospital?.adminProfile || {};
  els.dpDoctorId.value = memberId;
  els.doctorProfileTitle.textContent = `Edit ${member.name || "doctor"}`;
  els.dpName.value = member.name || "";
  els.dpEmail.value = member.email || "";
  els.dpSpecialty.value = member.specialty || "";
  els.dpPhone.value = member.phone || "";
  els.dpLicense.value = member.licenseNumber || "";
  els.dpYears.value = member.yearsOfExperience ?? "";
  els.dpServices.value = member.services || "";
  els.dpAbout.value = member.aboutText || "";
  // Default location fields from admin profile if doctor has none
  els.dpState.value = member.state || ap.state || "";
  els.dpDistrict.value = member.district || ap.district || "";
  els.dpCity.value = member.city || ap.city || "";
  els.dpClinicAddress.value = member.clinicAddress || ap.clinicAddress || "";
  els.dpLat.value = member.latitude ?? ap.latitude ?? "";
  els.dpLng.value = member.longitude ?? ap.longitude ?? "";
  els.dpLocationStatus.textContent = "";
  els.doctorProfileDialog.showModal();
}

async function saveDoctorProfile(event) {
  event.preventDefault();
  const doctorId = els.dpDoctorId.value;
  if (!doctorId) return;

  try {
    const payload = {
      hospitalId: state.hospitalId,
      doctorId,
      name: validateRequiredText(els.dpName.value, "Doctor name", 100),
      email: validateEmail(els.dpEmail.value, "Doctor email"),
      specialty: sanitizeFormText(els.dpSpecialty.value, 500),
      phone: validateOptionalPhone(els.dpPhone.value),
      licenseNumber: sanitizeFormText(els.dpLicense.value, 50),
      yearsOfExperience: validateOptionalNumber(els.dpYears.value, "Years of experience", 0, 80),
      services: sanitizeFormText(els.dpServices.value, 500),
      aboutText: sanitizeFormText(els.dpAbout.value, 2000),
      state: sanitizeFormText(els.dpState.value, 100),
      district: sanitizeFormText(els.dpDistrict.value, 100),
      city: sanitizeFormText(els.dpCity.value, 100),
      clinicAddress: sanitizeFormText(els.dpClinicAddress.value, 500),
      latitude: validateOptionalNumber(els.dpLat.value, "Latitude", -90, 90),
      longitude: validateOptionalNumber(els.dpLng.value, "Longitude", -180, 180),
    };

    els.doctorProfileDialog.close();
    showStatus("Saving doctor profile...");
    await callFunction("updateHospitalDoctorProfile", payload);
    showStatus("Doctor profile saved.");
    await loadMembers();
  } catch (error) {
    showError(error);
  }
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
async function loadMembers() {
  const membersRef = collection(state.db, "hospitals", state.hospitalId, "members");
  const snap = await getDocs(query(membersRef, limit(100)));
  state.members = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  state.doctors = state.members.filter((m) => m.role === "doctor" && m.status !== "deleted");
  renderMembers();
  populateDoctorSelect();
}

function populateDoctorSelect() {
  els.doctorSelect.innerHTML = `<option value="">Select doctor</option>`;
  for (const doctor of state.doctors) {
    const uid = doctor.uid || doctor.id;
    const name = doctor.name || doctor.email || uid;
    const opt = document.createElement("option");
    opt.value = uid;
    opt.textContent = name;
    els.doctorSelect.appendChild(opt);
  }
  refreshCalendarButton();
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------
async function loadSlots() {
  const doctorId = els.doctorSelect.value;
  const date = els.dateSelect.value;
  if (!doctorId || !date) {
    showStatus("Select a doctor and date first.", true);
    return;
  }

  els.slotGrid.innerHTML = `<div class="empty-state">Loading slots...</div>`;
  els.loadSlotsBtn.disabled = true;

  try {
    const result = await callFunction("getInternalScheduleView", {
      hospitalId: state.hospitalId,
      doctorId,
      targetDate: date,
    });
    const slots = result.data?.slots || [];
    if (!slots.length) {
      state.currentSlots = {};
      els.slotGrid.innerHTML = `<div class="empty-state">No slots found for this date. Use "Author slots" to generate them.</div>`;
      return;
    }
    const slotsMap = Object.fromEntries(slots.map((slot) => {
      const slotId = slot.slotId || slot.startTime;
      return [slotId, {
        slotId,
        start_time: slot.startTime,
        end_time: slot.endTime,
        status: slot.status === "free" ? "available" : slot.status,
        details: slot.details || {},
      }];
    }));
    state.currentSlots = slotsMap;
    renderSlots(slotsMap);
  } catch (error) {
    const message = error?.message || "";
    if (message.toLowerCase().includes("calendar")) {
      els.slotGrid.innerHTML = `<div class="empty-state">Connect this doctor's Google Calendar, then load the schedule again.</div>`;
      showStatus("Google Calendar permission is required for this doctor's live schedule.", true);
    } else {
      showError(error);
      els.slotGrid.innerHTML = `<div class="empty-state">Failed to load slots.</div>`;
    }
  } finally {
    els.loadSlotsBtn.disabled = false;
  }
}

async function refreshCalendarButton() {
  const doctorId = els.doctorSelect.value;
  if (!doctorId) {
    els.connectCalendarBtn.disabled = true;
    els.connectCalendarBtn.textContent = "Connect Calendar";
    return;
  }
  els.connectCalendarBtn.disabled = true;
  try {
    const result = await callFunction("getGoogleCalendarConnectionStatus", {
      hospitalId: state.hospitalId,
      doctorId,
    });
    const connected = result.data?.connected === true;
    els.connectCalendarBtn.textContent = connected ? "Calendar connected" : "Connect Calendar";
    els.connectCalendarBtn.disabled = connected;
  } catch (_) {
    els.connectCalendarBtn.textContent = "Connect Calendar";
    els.connectCalendarBtn.disabled = false;
  }
}

async function connectProviderCalendar() {
  const doctorId = els.doctorSelect.value;
  if (!doctorId) {
    showStatus("Select a doctor first.", true);
    return;
  }
  els.connectCalendarBtn.disabled = true;
  try {
    const result = await callFunction("getGoogleCalendarAuthUrl", {
      hospitalId: state.hospitalId,
      doctorId,
    });
    const url = result.data?.url || "";
    if (!url) throw new Error("Calendar authorization URL was not returned.");
    location.assign(url);
  } catch (error) {
    els.connectCalendarBtn.disabled = false;
    showError(error);
  }
}

function renderSlots(slotsMap) {
  const entries = Object.entries(slotsMap)
    .map(([slotId, slot]) => ({ slotId, ...slot }))
    .sort((a, b) => String(a.start_time || "").localeCompare(String(b.start_time || "")));

  if (!entries.length) {
    els.slotGrid.innerHTML = `<div class="empty-state">No slots for this date.</div>`;
    return;
  }

  els.slotGrid.innerHTML = entries.map((slot) => {
    const status = slot.status || "available";
    return `
      <button class="slot-tile ${esc(status)}" type="button"
        data-slot-id="${esc(slot.slotId)}"
        data-status="${esc(status)}">
        <span class="slot-time">${esc(formatSlotTime(slot.start_time))}</span>
        <span class="slot-time" style="font-weight:400;font-size:0.8rem">${esc(formatSlotTime(slot.end_time))}</span>
        <span class="slot-status">${esc(status)}</span>
      </button>
    `;
  }).join("");

  els.slotGrid.querySelectorAll(".slot-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      openSlotAction(tile.dataset.slotId, tile.dataset.status);
    });
  });
}

function formatSlotTime(value) {
  if (!value) return "";
  if (value.includes("T") || value.includes("Z")) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }
  }
  return value;
}

// ---------------------------------------------------------------------------
// Slot actions
// ---------------------------------------------------------------------------
function openSlotAction(slotId, status) {
  const slot = state.currentSlots[slotId];
  if (!slot) return;

  els.slotActionEyebrow.textContent = `Slot ${slotId}`;
  els.slotActionTitle.textContent = `${formatSlotTime(slot.start_time)} - ${formatSlotTime(slot.end_time)}`;
  els.slotActionMeta.textContent = `Status: ${status}`;

  const actions = [];
  if (status === "available" || status === "free") {
    actions.push({ label: "Block slot", cls: "btn ghost", fn: () => slotAction("adminBlockSlot", slotId) });
    actions.push({ label: "Book slot", cls: "btn", fn: () => slotAction("providerBookSlot", slotId) });
  } else if (status === "booked" || status === "busy") {
    actions.push({ label: "Release slot", cls: "btn danger", fn: () => slotAction("providerReleaseSlot", slotId) });
  } else if (status === "blocked") {
    actions.push({ label: "Unblock slot", cls: "btn ghost", fn: () => slotAction("adminUnblockSlot", slotId) });
  }
  actions.push({ label: "Cancel", cls: "btn ghost", fn: () => els.slotActionDialog.close() });

  els.slotActionMenu.innerHTML = actions.map((a, i) =>
    `<button class="${esc(a.cls)}" type="button" data-action="${i}">${esc(a.label)}</button>`
  ).join("");

  els.slotActionMenu.querySelectorAll("button").forEach((btn) => {
    const action = actions[parseInt(btn.dataset.action, 10)];
    if (action) btn.addEventListener("click", action.fn, { once: true });
  });

  els.slotActionDialog.showModal();
}

async function slotAction(functionName, slotId) {
  els.slotActionDialog.close();
  const doctorId = els.doctorSelect.value;
  const date = els.dateSelect.value;
  if (!doctorId || !date) return;

  showStatus(`Running ${functionName}...`);
  try {
    await callFunction(functionName, {
      hospitalId: state.hospitalId,
      doctorId,
      slotId,
      date,
    });
    showStatus(`${functionName} succeeded.`);
    await loadSlots();
  } catch (error) {
    showError(error);
  }
}

// ---------------------------------------------------------------------------
// Author slots
// ---------------------------------------------------------------------------
function openAuthorDialog() {
  const doctorId = els.doctorSelect.value;
  const date = els.dateSelect.value;
  if (!doctorId || !date) {
    showStatus("Select a doctor and date first.", true);
    return;
  }
  const doctorName = els.doctorSelect.options[els.doctorSelect.selectedIndex]?.textContent || "doctor";
  els.authorDialogTitle.textContent = `Generate slots for ${doctorName} on ${date}`;
  els.authorDialog.showModal();
}

async function submitAuthorSlots(event) {
  event.preventDefault();
  const doctorId = els.doctorSelect.value;
  const date = els.dateSelect.value;
  if (!doctorId || !date) return;

  const startTime = els.authorStart.value;
  const endTime = els.authorEnd.value;
  const duration = parseInt(els.authorDuration.value, 10);
  const breakStart = els.authorBreakStart.value || null;
  const breakEnd = els.authorBreakEnd.value || null;

  if (!startTime || !endTime || !duration || duration < 5) {
    showStatus("Fill in valid start, end, and duration.", true);
    return;
  }

  const slots = generateSlotEntries(date, startTime, endTime, duration, breakStart, breakEnd);
  if (!slots.length) {
    showStatus("No slots generated. Check your time range.", true);
    return;
  }

  els.authorDialog.close();
  showStatus(`Authoring ${slots.length} slots...`);

  try {
    const result = await callFunction("adminAuthorSlots", {
      hospitalId: state.hospitalId,
      doctorId,
      date,
      slots,
    });
    const data = result.data || {};
    showStatus(`Slots authored: ${data.written || 0} written, ${data.skipped || 0} skipped (${data.preservedBooked || 0} booked preserved).`);
    await loadSlots();
  } catch (error) {
    showError(error);
  }
}

function generateSlotEntries(date, startStr, endStr, durationMin, breakStartStr, breakEndStr) {
  const slots = [];
  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const toTimeStr = (mins) => {
    const h = String(Math.floor(mins / 60)).padStart(2, "0");
    const m = String(mins % 60).padStart(2, "0");
    return `${h}:${m}`;
  };

  let cursor = toMinutes(startStr);
  const end = toMinutes(endStr);
  const breakS = breakStartStr ? toMinutes(breakStartStr) : null;
  const breakE = breakEndStr ? toMinutes(breakEndStr) : null;

  while (cursor + durationMin <= end) {
    const slotStart = cursor;
    const slotEnd = cursor + durationMin;

    if (breakS !== null && breakE !== null && slotStart < breakE && slotEnd > breakS) {
      cursor = breakE;
      continue;
    }

    const slotId = `${date}_${toTimeStr(slotStart).replace(":", "")}`;
    slots.push({
      slotId,
      startTime: toTimeStr(slotStart),
      endTime: toTimeStr(slotEnd),
    });
    cursor += durationMin;
  }
  return slots;
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
async function loadBookings() {
  const fromDate = els.bookingDateFrom.value;
  const toDate = els.bookingDateTo.value;
  if (!fromDate || !toDate) {
    showStatus("Select both from and to dates.", true);
    return;
  }

  els.bookingList.innerHTML = `<div class="empty-state">Loading bookings...</div>`;
  els.loadBookingsBtn.disabled = true;

  try {
    const result = await callFunction("getHospitalBookings", {
      hospitalId: state.hospitalId,
      fromDate,
      toDate,
      limit: 200,
    });

    const bookings = (result.data?.bookings || []).map((data) => {
      const start = data.startTime ? new Date(data.startTime) : null;
      const end = data.endTime ? new Date(data.endTime) : null;
      return {
        id: data.id || data.bookingId || "",
        doctorId: data.doctorId || "",
        patientId: data.patientId || "",
        slotId: data.slotId || "",
        date: data.date || (start ? start.toISOString().slice(0, 10) : ""),
        startTime: start ? start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "",
        endTime: end ? end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "",
        status: data.status || "active",
      };
    }).sort((a, b) => String(a.date + a.startTime).localeCompare(String(b.date + b.startTime)));

    renderBookings(bookings);
  } catch (error) {
    showError(error);
    els.bookingList.innerHTML = `<div class="empty-state">Failed to load bookings.</div>`;
  } finally {
    els.loadBookingsBtn.disabled = false;
  }
}

function renderBookings(bookings) {
  if (!bookings.length) {
    els.bookingList.innerHTML = `<div class="empty-state">No bookings found for this date range.</div>`;
    return;
  }

  const doctorNames = {};
  for (const m of state.doctors) {
    const uid = m.uid || m.id;
    doctorNames[uid] = m.name || m.email || uid;
  }

  els.bookingList.innerHTML = bookings.map((b) => `
    <article class="booking-card">
      <div>
        <h3>${esc(doctorNames[b.doctorId] || b.doctorId)}</h3>
        <p class="muted">${esc(b.date)} &middot; ${esc(b.startTime)} - ${esc(b.endTime)}</p>
        <p class="muted">Patient: ${esc(b.patientId)} &middot; Slot: ${esc(b.slotId)}</p>
      </div>
      <span class="booking-badge ${esc(b.status === "cancelled" ? "cancelled" : "active")}">
        ${esc(b.status)}
      </span>
    </article>
  `).join("");
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderAuth() {
  const signedIn = Boolean(state.user);
  els.signInBtn.hidden = signedIn;
  els.signOutBtn.hidden = !signedIn;
  els.signInView.hidden = signedIn;
  if (!signedIn) {
    els.dashboardView.hidden = true;
    state.hospitalId = null;
    state.hospital = null;
    state.members = [];
    state.doctors = [];
  }
  if (signedIn) {
    els.signOutBtn.textContent = state.user.displayName
      ? `Sign out (${state.user.displayName.split(" ")[0]})`
      : "Sign out";
  }
}

function renderHospital() {
  els.dashboardView.hidden = false;
  els.signInView.hidden = true;
  clearStatus();

  const ap = state.hospital?.adminProfile || {};
  els.hospitalName.textContent = ap.clinicName || state.hospital?.name || state.hospitalId;
  els.hospitalAddress.textContent = ap.clinicAddress || ap.address || state.hospital?.address || "";
  els.hospitalCity.textContent = [ap.city || state.hospital?.city || "", ap.district || "", ap.state || ""].filter(Boolean).join(", ");
  els.hospitalPhone.textContent = ap.phone || state.hospital?.phone || "";
  els.hospitalId.textContent = `ID: ${state.hospitalId}`;

  // Render additional profile details
  const details = [];
  if (ap.name) details.push(["Admin", ap.name]);
  if (ap.specialty) details.push(["Specialty", ap.specialty]);
  if (ap.yearsOfExperience) details.push(["Experience", `${ap.yearsOfExperience} years`]);
  if (ap.services) details.push(["Services", ap.services]);
  if (ap.aboutText) details.push(["About", ap.aboutText.length > 80 ? ap.aboutText.slice(0, 80) + "..." : ap.aboutText]);
  if (ap.googleMapsLink) details.push(["Maps", "Link"]);
  if (ap.latitude && ap.longitude) details.push(["Location", `${Number(ap.latitude).toFixed(4)}, ${Number(ap.longitude).toFixed(4)}`]);

  if (details.length) {
    els.adminProfileDetails.innerHTML = `<dl>${details.map(([k, v]) =>
      `<dt>${esc(k)}</dt><dd>${k === "Maps" ? `<a href="${esc(ap.googleMapsLink)}" target="_blank" rel="noopener">Open</a>` : esc(v)}</dd>`
    ).join("")}</dl>${renderPatientShareLink()}`;
  } else {
    els.adminProfileDetails.innerHTML = `<p class="muted" style="font-size:0.84rem">No profile details yet. Click Edit to add.</p>${renderPatientShareLink()}`;
  }
  document.querySelector("#copyPatientLinkBtn")?.addEventListener("click", copyPatientLink);
}

function patientHospitalLink() {
  const url = new URL(`/hospital/${encodeURIComponent(state.hospitalId || "")}`, PATIENT_WEB_BASE_URL);
  return url.toString();
}

function renderPatientShareLink() {
  if (!state.hospitalId) return "";
  const link = patientHospitalLink();
  return `
    <div class="patient-share-card">
      <p class="eyebrow">Patient direct link</p>
      <a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a>
      <button id="copyPatientLinkBtn" class="btn small ghost" type="button">Copy</button>
    </div>
  `;
}

async function copyPatientLink() {
  const link = patientHospitalLink();
  try {
    await navigator.clipboard.writeText(link);
    showStatus("Patient direct link copied. Use it in Google Maps, posters, QR codes, or messages.");
  } catch (_) {
    showStatus(link);
  }
}

function renderMembers() {
  if (!state.members.length) {
    els.memberList.innerHTML = `<div class="empty-state">No members found.</div>`;
    return;
  }

  const filtered = state.members.filter((m) => m.status !== "deleted");
  els.memberList.innerHTML = filtered.map((m) => {
    const role = m.role || "unknown";
    const status = m.status || "active";
    const statusClass = status === "active" ? "active" : "pending";
    const isDoctor = role === "doctor";
    return `
      <article class="member-card" data-member-id="${esc(m.id)}" data-role="${esc(role)}">
        <div>
          <h3>${esc(m.name || m.email || m.id)}</h3>
          <p class="muted">${esc(m.email || "")}</p>
          ${m.specialty ? `<p class="muted">${esc(m.specialty)}</p>` : ""}
          ${m.phone ? `<p class="muted">${esc(m.phone)}</p>` : ""}
          <span class="member-status ${esc(statusClass)}">${esc(status)}</span>
        </div>
        <span class="member-role ${esc(role)}">${esc(role)}</span>
        ${isDoctor ? `<button class="btn small ghost" type="button">Edit</button>` : ""}
      </article>
    `;
  }).join("");

  els.memberList.querySelectorAll(".member-card").forEach((card) => {
    const role = card.dataset.role;
    if (role === "doctor") {
      card.addEventListener("click", () => openDoctorProfileDialog(card.dataset.memberId));
    }
  });
}

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------
function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });
  els.scheduleTab.hidden = tabName !== "schedule";
  els.membersTab.hidden = tabName !== "members";
  els.bookingsTab.hidden = tabName !== "bookings";
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function bindEvents() {
  els.signInBtn.addEventListener("click", () => {
    clearStatus();
    startGoogleIdTokenSignIn();
  });

  els.signOutBtn.addEventListener("click", () => signOut(state.auth));

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  els.loadSlotsBtn.addEventListener("click", loadSlots);
  els.connectCalendarBtn.addEventListener("click", connectProviderCalendar);
  els.authorSlotsBtn.addEventListener("click", openAuthorDialog);
  els.authorForm.addEventListener("submit", submitAuthorSlots);
  els.cancelAuthorBtn.addEventListener("click", () => els.authorDialog.close());
  els.loadBookingsBtn.addEventListener("click", loadBookings);

  els.doctorSelect.addEventListener("change", () => {
    refreshCalendarButton();
    if (els.doctorSelect.value && els.dateSelect.value) loadSlots();
  });
  els.dateSelect.addEventListener("change", () => {
    if (els.doctorSelect.value && els.dateSelect.value) loadSlots();
  });

  // Admin profile
  els.editAdminProfileBtn.addEventListener("click", openAdminProfileDialog);
  els.adminProfileForm.addEventListener("submit", saveAdminProfile);
  els.cancelAdminProfileBtn.addEventListener("click", () => els.adminProfileDialog.close());
  els.apUseLocationBtn.addEventListener("click", () => {
    getCurrentPositionAndGeocode(els.apLocationStatus, {
      lat: els.apLat,
      lng: els.apLng,
      address: els.apClinicAddress,
      city: els.apCity,
      district: els.apDistrict,
      state: els.apState,
    });
  });

  // Doctor profile
  els.doctorProfileForm.addEventListener("submit", saveDoctorProfile);
  els.cancelDoctorProfileBtn.addEventListener("click", () => els.doctorProfileDialog.close());
  els.dpUseLocationBtn.addEventListener("click", () => {
    getCurrentPositionAndGeocode(els.dpLocationStatus, {
      lat: els.dpLat,
      lng: els.dpLng,
      address: els.dpClinicAddress,
      city: els.dpCity,
      district: els.dpDistrict,
      state: els.dpState,
    });
  });
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function initDateInputs() {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  const todayStr = today.toISOString().slice(0, 10);
  els.dateSelect.value = todayStr;
  els.dateSelect.min = todayStr;
  els.bookingDateFrom.value = todayStr;
  els.bookingDateTo.value = todayStr;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------
function showStatus(message, isError = false) {
  els.statusPanel.hidden = false;
  els.statusPanel.classList.toggle("error", isError);
  els.statusPanel.textContent = message;
}

function showError(error) {
  showStatus(error?.message || "Something went wrong.", true);
}

function clearStatus() {
  els.statusPanel.hidden = true;
  els.statusPanel.textContent = "";
  els.statusPanel.classList.remove("error");
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
