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

`../niramay_apps/firebase.json` points Hosting at this folder:

```sh
firebase deploy --only hosting
```

Before deploying, set `appCheckSiteKey` in `config.js` to the Firebase App
Check reCAPTCHA Enterprise site key for the `Niramay Patient Web` Firebase web app.
The patient callables enforce App Check, so leaving this blank causes Cloud
Functions to return `UNAUTHENTICATED` even when the patient is signed in.

To deploy functions with it:

```sh
firebase deploy --only hosting,functions
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

Patient name, phone, and local receipts are stored in browser `localStorage`.
Firestore receives no patient name or phone. Booking and availability go
through the existing Cloud Functions in `asia-south1`.
