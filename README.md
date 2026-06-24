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

India builds use the Niramay brand and default collections. USA builds use the
Aura brand and `us_*` collections.

Deploy from `../niramay_apps`:

```sh
firebase deploy --only hosting:patient-in --project vana-apps
firebase deploy --only hosting:patient-us --project vana-apps
```

Target mappings live in `../niramay_apps/.firebaserc`. Current Hosting site IDs
are `vana-apps` and `vana-apps-us`. If Firebase Hosting site IDs differ, update
them with `firebase target:apply hosting <target> <site-id>`.
