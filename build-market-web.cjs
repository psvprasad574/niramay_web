#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = __dirname;
const distRoot = path.join(root, "..", "niramay_apps", "web_dist");

const profileArg = process.argv.find((arg) => arg.startsWith("--profile="));
const requestedProfile = profileArg ? profileArg.split("=")[1] : "all";

// Public browser identifiers. Restrict the Firebase API key in Google Cloud to
// the approved hosting referrers and Firebase APIs before deploying.
const appCheckSiteKey = "6LfeeMssAAAAAJvPq3zt1WxQWGDi-pfWp_3-nDVP";
const patientSha256 =
  "09:5B:41:19:1A:58:65:3E:62:88:F1:C4:60:17:8E:CB:41:8B:EB:31:A8:0B:45:5B:56:10:67:DF:C8:53:30:9F";

const firebaseConfigs = {
  dev: {
    IN: {
      apiKey: "AIzaSyCNtIDAo6DsBkjMjUUsyG5GQ3fOFG9Kc60",
      authDomain: "in.vanaapps.org",
      projectId: "vana-apps",
      storageBucket: "vana-apps.firebasestorage.app",
      messagingSenderId: "76866563498",
      appId: "1:76866563498:web:bcbfc5a2c3d6bfdbd58fd3",
      measurementId: "G-VKH2Q3CCV2",
    },
    US: {
      apiKey: "AIzaSyD__akeGtJqyx58835vXqPtqCQrBiJp1GU",
      authDomain: "us.vanaapps.org",
      projectId: "aura-apps-f806a",
      storageBucket: "aura-apps-f806a.firebasestorage.app",
      messagingSenderId: "724240192196",
      appId: "1:724240192196:web:fe48ab2f1da914d735ef91",
      measurementId: "G-GWBWFF5MK7",
    },
  },
  prod: {
    IN: {
      apiKey: "AIzaSyCNtIDAo6DsBkjMjUUsyG5GQ3fOFG9Kc60",
      authDomain: "in.vanaapps.org",
      projectId: "vana-apps",
      storageBucket: "vana-apps.firebasestorage.app",
      messagingSenderId: "76866563498",
      appId: "1:76866563498:web:18f532b053a7b5a6d58fd3",
      measurementId: "G-1D85447BN6",
    },
    US: {
      apiKey: "AIzaSyD__akeGtJqyx58835vXqPtqCQrBiJp1GU",
      authDomain: "us.vanaapps.org",
      projectId: "aura-apps-f806a",
      storageBucket: "aura-apps-f806a.firebasestorage.app",
      messagingSenderId: "724240192196",
      appId: "1:724240192196:web:fe48ab2f1da914d735ef91",
      measurementId: "G-GWBWFF5MK7",
    },
  },
};

const profiles = [
  {
    name: "dev",
    collectionPrefix: "",
    functionsPrefix: "",
    hosts: {
      patientIn: process.env.NIRAMAY_DEV_PATIENT_IN_HOST || "in.vanaapps.org",
      patientUs: process.env.NIRAMAY_DEV_PATIENT_US_HOST || "us.vanaapps.org",
      adminIn: process.env.NIRAMAY_DEV_ADMIN_IN_HOST || "in.vanaapps.org",
      adminUs: process.env.NIRAMAY_DEV_ADMIN_US_HOST || "us.vanaapps.org",
    },
  },
  {
    name: "prod",
    collectionPrefix: "",
    functionsPrefix: "",
    hosts: {
      patientIn: process.env.NIRAMAY_PROD_PATIENT_IN_HOST || "in.vanaapps.org",
      patientUs: process.env.NIRAMAY_PROD_PATIENT_US_HOST || "us.vanaapps.org",
      adminIn: process.env.NIRAMAY_PROD_ADMIN_IN_HOST || "in.vanaapps.org",
      adminUs: process.env.NIRAMAY_PROD_ADMIN_US_HOST || "us.vanaapps.org",
    },
  },
].filter((profile) => requestedProfile === "all" || profile.name === requestedProfile);

if (!profiles.length) {
  throw new Error(`Unknown profile "${requestedProfile}". Use dev, prod, or all.`);
}

const builds = [
  {
    name: "patient_in",
    source: "patient_web",
    appType: "patient",
    marketCountry: "IN",
    brandName: "Niramay",
    oauthAppName: "Niramay",
    appDisplayName: "Niramay Aarogya",
    googleOAuthClientId:
      "76866563498-ks6v02eb5abro9in7imkc0f5q8kfe29j.apps.googleusercontent.com",
    patientAppPackage: "com.vana.health.patient.in",
    patientAppScheme: "niramay-in",
    patientAppInstallUrl:
      "https://play.google.com/store/apps/details?id=com.vana.health.patient.in",
    patientHostKey: "patientIn",
  },
  {
    name: "patient_us",
    source: "patient_web",
    appType: "patient",
    marketCountry: "US",
    brandName: "Aura",
    oauthAppName: "Aura",
    appDisplayName: "Aura Aarogya",
    googleOAuthClientId:
      "724240192196-ni1g6ksu5iv4p3oiu66fgs4len8c5a74.apps.googleusercontent.com",
    patientAppPackage: "com.aura.health.patient",
    patientAppScheme: "niramay-us",
    patientAppInstallUrl:
      "https://play.google.com/store/apps/details?id=com.aura.health.patient",
    patientHostKey: "patientUs",
  },
  {
    name: "admin_in",
    source: "admin_web",
    appType: "admin",
    marketCountry: "IN",
    brandName: "Niramay",
    appDisplayName: "Niramay Admin",
    patientHostKey: "patientIn",
    adminHostKey: "adminIn",
  },
  {
    name: "admin_us",
    source: "admin_web",
    appType: "admin",
    marketCountry: "US",
    brandName: "Aura",
    appDisplayName: "Aura Admin",
    patientHostKey: "patientUs",
    adminHostKey: "adminUs",
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

function configFor(profile, marketCountry) {
  return firebaseConfigs[profile.name][marketCountry];
}

function writePatientConfig(destination, build, profile) {
  writeFile(
    path.join(destination, "config.js"),
    `window.NIRAMAY_PUBLIC_CONFIG = ${JSON.stringify(
      {
        appCheckSiteKey,
        marketCountry: build.marketCountry,
        brandName: build.oauthAppName || build.brandName,
        oauthAppName: build.oauthAppName || `${build.brandName} patient booking`,
        appDisplayName: build.oauthAppName || build.appDisplayName,
        googleOAuthClientId: build.googleOAuthClientId,
        patientAppPackage: build.patientAppPackage,
        patientAppScheme: build.patientAppScheme,
        patientAppInstallUrl: build.patientAppInstallUrl,
        collectionPrefix: profile.collectionPrefix,
        functionsPrefix: profile.functionsPrefix,
        firebaseConfig: configFor(profile, build.marketCountry),
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
    name: build.oauthAppName || `${build.brandName} patient booking`,
    short_name: build.oauthAppName || build.brandName,
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

function writeAdminConfig(destination, build, profile) {
  writeFile(
    path.join(destination, "config.js"),
    `window.NIRAMAY_ADMIN_CONFIG = ${JSON.stringify(
      {
        appCheckSiteKey,
        marketCountry: build.marketCountry,
        brandName: build.brandName,
        appDisplayName: build.appDisplayName,
        patientWebBaseUrl: `https://${profile.hosts[build.patientHostKey]}`,
        collectionPrefix: profile.collectionPrefix,
        functionsPrefix: profile.functionsPrefix,
        firebaseConfig: configFor(profile, build.marketCountry),
      },
      null,
      2,
    )};\n`,
  );
}

if (requestedProfile === "all") {
  fs.rmSync(distRoot, { recursive: true, force: true });
  fs.mkdirSync(distRoot, { recursive: true });
}

for (const profile of profiles) {
  const profileRoot = path.join(distRoot, profile.name);
  if (requestedProfile !== "all") {
    fs.rmSync(profileRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(profileRoot, { recursive: true });

  for (const build of builds) {
    const source = path.join(root, build.source);
    const destination = path.join(profileRoot, build.name);
    copyDirectory(source, destination);
    if (build.appType === "admin") {
      writeAdminConfig(destination, build, profile);
    } else {
      writePatientConfig(destination, build, profile);
    }
    console.log(`Built ${profile.name}/${build.name}`);
  }

  if (profile.name === "prod") {
    for (const build of builds) {
      copyDirectory(path.join(profileRoot, build.name), path.join(distRoot, build.name));
      console.log(`Built ${build.name}`);
    }
  }

  console.log(
    `Web profile: ${profile.name} ` +
      `(collections="${profile.collectionPrefix}", functions="${profile.functionsPrefix}")`,
  );
}
