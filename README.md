# Website Builder

This is a production-oriented website-builder frontend starter. It implements the principal creation flow with local browser persistence: authentication screens, dashboard, templates, project creation, visual editing, section reordering, property updates, responsive canvas modes, a secure iframe preview for custom HTML, and a publish-ready preview route.

## Run

```powershell
npm install
npm run dev
```

## Persistence and services

Project state is stored in `localStorage` to make the demo self-contained. Replace `src/store.ts` with REST client calls when wiring the service layer. The UI deliberately reports publishing as unconfigured rather than claiming a deployment occurred. The code preview runs in a sandboxed iframe and blocks scripts; use a server-side transform/sandbox worker before enabling JSX or JavaScript execution.

## Recommended production service boundary

`React client → Express API → service → repository → PostgreSQL/MongoDB`

Authentication, media upload, real deployment, analytics, and database status screens require configured backend credentials and are intentionally integration points rather than faked connections. Payment processing is outside this project's scope.
