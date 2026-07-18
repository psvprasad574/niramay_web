# Niramay Patient Web

Static Firebase Hosting UI for patient appointment booking. This is separate
from `niramay_instant` and does not require users to install an app.

The root page starts with Google sign-in, then selects a city context first:
patients can use current location or search by city name. Provider discovery is
then scoped to that city/location by hospital name, doctor name, or speciality.
Provider QR links skip discovery and open the selected hospital's doctors
directly.

Booking receipts are cached locally and synced to the patient's private Google
Drive AppData file (`niramay_bookings.json`) so the My bookings view can restore
history across devices without writing patient PII to Firestore.

## Firebase

`../niramay_apps/firebase.json` points Hosting at generated market folders.
Build them from `../niramay_web`:

```sh
node build-market-web.cjs
```

Then deploy from `../niramay_apps`:

```sh
firebase deploy --only hosting:patient-in --project india
firebase deploy --only hosting:patient-us --project us
```

The generated India app uses `Niramay`, `com.vana.health.patient.in`, and
the India Firebase project. The generated USA app uses `Aura`,
`com.aura.health.patient`, and the Aura Firebase project. Both projects use the
same Firestore collection names.

Before deploying, make sure the `appCheckSiteKey` in `build-market-web.cjs`
matches the Firebase App Check reCAPTCHA Enterprise site keys for the web apps.
The patient callables enforce App Check, so an invalid key causes Cloud
Functions to return `UNAUTHENTICATED` even when the patient is signed in.

To deploy functions with hosting:

```sh
firebase deploy --only hosting:patient-in,functions --project india
firebase deploy --only hosting:patient-us,functions --project us
```

The web app reads Firebase config from Hosting's reserved
`/__/firebase/init.json` endpoint, so no API keys are hard-coded in the source.

## Links

Provider QR codes can point to:

```text
https://<hosting-domain>/hospital/<hospitalId>
```

Query parameters also work:

```text
https://<hosting-domain>/?hospitalId=<hospitalId>
```

## Privacy

Patient name, phone, and local receipts are encrypted with Web Crypto and stored
in browser IndexedDB. Firestore receives no patient name or phone. Booking and
availability go through the existing Cloud Functions in `asia-south1`.

## Ads

Patient web supports Google AdSense display ads. Ads are disabled by default.

Configure `config.js`:

```js
ads: {
  enabled: true,
  signedOutOnly: true,
  client: "ca-pub-1234567890123456",
  desktopLeftSlot: "1111111111",
  desktopRightSlot: "2222222222",
  mobileBottomSlot: "3333333333",
}
```

With `signedOutOnly: true`, ad containers are hidden after Google sign-in so
private booking/profile screens do not load third-party ad scripts.
