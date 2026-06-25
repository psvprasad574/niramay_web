#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = __dirname;
const distRoot = path.join(root, "..", "niramay_apps", "web_dist");
// Public browser identifiers. Restrict the Firebase API key in Google Cloud to
// the production hosting referrers and Firebase APIs before deploying.
const appCheckSiteKey = "6LfeeMssAAAAAJvPq3zt1WxQWGDi-pfWp_3-nDVP";
const patientSha256 =
  "09:5B:41:19:1A:58:65:3E:62:88:F1:C4:60:17:8E:CB:41:8B:EB:31:A8:0B:45:5B:56:10:67:DF:C8:53:30:9F";
const niramayPatientFirebaseConfig = {
  apiKey: "AIzaSyCNtIDAo6DsBkjMjUUsyG5GQ3fOFG9Kc60",
  authDomain: "vana-apps.firebaseapp.com",
  projectId: "vana-apps",
  storageBucket: "vana-apps.firebasestorage.app",
  messagingSenderId: "76866563498",
  appId: "1:76866563498:web:18f532b053a7b5a6d58fd3",
  measurementId: "G-1D85447BN6",
};
const auraPatientFirebaseConfig = {
  apiKey: "AIzaSyCNtIDAo6DsBkjMjUUsyG5GQ3fOFG9Kc60",
  authDomain: "vana-apps.firebaseapp.com",
  projectId: "vana-apps",
  storageBucket: "vana-apps.firebasestorage.app",
  messagingSenderId: "76866563498",
  appId: "1:76866563498:web:c45b5de589d7d0a2d58fd3",
  measurementId: "G-1D85447BN6",
};

const builds = [
  {
    name: "patient_in",
    source: "patient_web",
    marketCountry: "IN",
    brandName: "Niramay",
    appDisplayName: "Niramay Aarogya",
    patientAppPackage: "com.vana.health.patient.in",
    patientAppScheme: "niramay-in",
    patientAppInstallUrl:
      "https://play.google.com/store/apps/details?id=com.vana.health.patient.in",
    firebaseConfig: niramayPatientFirebaseConfig,
  },
  {
    name: "patient_us",
    source: "patient_web",
    marketCountry: "US",
    brandName: "Aura",
    appDisplayName: "Aura Aarogya",
    patientAppPackage: "com.vana.health.patient.us",
    patientAppScheme: "niramay-us",
    patientAppInstallUrl:
      "https://play.google.com/store/apps/details?id=com.vana.health.patient.us",
    firebaseConfig: auraPatientFirebaseConfig,
  },
];

function copyDirectory(source, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writePatientConfig(destination, build) {
  writeFile(
    path.join(destination, "config.js"),
    `window.NIRAMAY_PUBLIC_CONFIG = ${JSON.stringify(
      {
        appCheckSiteKey,
        marketCountry: build.marketCountry,
        brandName: build.brandName,
        appDisplayName: build.appDisplayName,
        patientAppPackage: build.patientAppPackage,
        patientAppScheme: build.patientAppScheme,
        patientAppInstallUrl: build.patientAppInstallUrl,
        firebaseConfig: build.firebaseConfig,
        ads: {
          enabled: false,
          signedOutOnly: true,
          client: "",
          desktopLeftSlot: "",
          desktopRightSlot: "",
          mobileBottomSlot: "",
        },
      },
      null,
      2,
    )};\n`,
  );

  writeJson(path.join(destination, ".well-known", "assetlinks.json"), [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: build.patientAppPackage,
        sha256_cert_fingerprints: [patientSha256],
      },
    },
  ]);

  writeJson(path.join(destination, "manifest.webmanifest"), {
    name: `${build.brandName} Patient Booking`,
    short_name: build.brandName,
    start_url: "/",
    display: "standalone",
    background_color: "#f7fbf8",
    theme_color: "#0f766e",
    icons: [
      {
        src: "/assets/patient_logo_icon.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  });
}

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(distRoot, { recursive: true });

for (const build of builds) {
  const source = path.join(root, build.source);
  const destination = path.join(distRoot, build.name);
  copyDirectory(source, destination);
  writePatientConfig(destination, build);
  console.log(`Built ${build.name}`);
}
