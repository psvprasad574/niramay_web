# Niramay Web

Static web clients for the Niramay project.

- `patient_web/` — patient-facing Firebase Hosting UI.
- `admin_web/` — admin Firebase Hosting UI.
- `../niramay_apps/web_dist/` — generated hosting folders for India/USA deploys.

Firebase deploy configuration stays in `../niramay_apps/firebase.json`, which
points Hosting targets at generated folders.

## Market Builds

Build the four static hosting outputs:

```sh
node build-market-web.cjs
```

This creates:

```text
../niramay_apps/web_dist/patient_in
../niramay_apps/web_dist/patient_us
```

India builds use the Niramay brand and the India Firebase project. USA builds
use the Aura brand and the Aura Firebase project. Both projects use the same
Firestore collection names.

Deploy from `../niramay_apps`:

```sh
firebase deploy --only hosting:patient-in --project india
firebase deploy --only hosting:patient-us --project us
```

Target mappings live in `../niramay_apps/.firebaserc`. India deploys to
`vana-apps`; USA deploys to the Aura Firebase project `aura-apps-f806a`. If
Firebase Hosting site IDs differ, update them with
`firebase target:apply hosting <target> <site-id> --project <project-alias>`.
