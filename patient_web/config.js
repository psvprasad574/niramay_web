window.NIRAMAY_PUBLIC_CONFIG = {
  // Firebase App Check reCAPTCHA Enterprise site key for "Niramay Patient Web".
  // This public key is required because Cloud Functions enforce App Check.
  appCheckSiteKey: "6LfeeMssAAAAAJvPq3zt1WxQWGDi-pfWp_3-nDVP",
  // Use "US" for the USA release branding and country-specific behavior.
  marketCountry: "IN",
  brandName: "Niramay",
  oauthAppName: "Niramay",
  appDisplayName: "Niramay",
  patientAppPackage: "com.vana.health.patient.in",
  patientAppScheme: "niramay-in",
  patientAppInstallUrl: "https://play.google.com/store/apps/details?id=com.vana.health.patient.in",
  // Firebase web config is public by design. Keep the API key restricted in
  // Google Cloud/Firebase Console to approved web referrers and Firebase APIs.
  firebaseConfig: {
    apiKey: "AIzaSyCNtIDAo6DsBkjMjUUsyG5GQ3fOFG9Kc60",
    authDomain: "in.vanaapps.org",
    projectId: "vana-apps",
    storageBucket: "vana-apps.firebasestorage.app",
    messagingSenderId: "76866563498",
    appId: "1:76866563498:web:bcbfc5a2c3d6bfdbd58fd3",
    measurementId: "G-VKH2Q3CCV2",
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
