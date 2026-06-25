window.NIRAMAY_PUBLIC_CONFIG = {
  // Firebase App Check reCAPTCHA Enterprise site key for "Niramay Patient Web".
  // This public key is required because Cloud Functions enforce App Check.
  appCheckSiteKey: "6LfeeMssAAAAAJvPq3zt1WxQWGDi-pfWp_3-nDVP",
  // Use "US" for the USA release to read/write us_* Firestore collections.
  marketCountry: "IN",
  brandName: "Niramay",
  appDisplayName: "Niramay Aarogya",
  patientAppPackage: "com.vana.health.patient.in",
  patientAppScheme: "niramay-in",
  patientAppInstallUrl: "https://play.google.com/store/apps/details?id=com.vana.health.patient.in",
  // Firebase web config is public by design. Keep the API key restricted in
  // Google Cloud/Firebase Console to approved web referrers and Firebase APIs.
  firebaseConfig: {
    apiKey: "AIzaSyCNtIDAo6DsBkjMjUUsyG5GQ3fOFG9Kc60",
    authDomain: "vana-apps.firebaseapp.com",
    projectId: "vana-apps",
    storageBucket: "vana-apps.firebasestorage.app",
    messagingSenderId: "76866563498",
    appId: "1:76866563498:web:18f532b053a7b5a6d58fd3",
    measurementId: "G-1D85447BN6",
  },
  ads: {
    enabled: false,
    signedOutOnly: true,
    // Fill these with your AdSense publisher ID and banner ad unit slot IDs.
    // Example client format: ca-pub-1234567890123456
    client: "",
    desktopLeftSlot: "",
    desktopRightSlot: "",
    mobileBottomSlot: "",
  },
};
