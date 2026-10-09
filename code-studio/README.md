# Code Studio

A local, working code workspace integrated into the existing Code Studio route.

## Start the website

Open PowerShell and run:

```powershell
cd 'C:\Users\balaj\Desktop\web ide\th\website\code-studio'
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Open http://localhost:4317/dashboard and click **Code Studio**. Direct link: http://localhost:4317/code/atlas.
Keep the terminal open while using the site. Stop with Ctrl+C. If port 4317 is busy, stop its earlier Code Studio server or use `-Port 4318` and open that port instead. The existing server on 4173 is independent. Browser-stored projects on 4173 remain under that origin; the new Code Studio uses its own database.

After changing Code Studio source, use `-Rebuild`. Generated website output stays in `code-studio/host-dist`; the original website `dist` is preserved. The ordinary root Vite preview command alone does not start the Code Studio API.

Requires Node.js 24 or newer. Dependencies are installed separately in this folder. If they are missing, run `npm ci` here, then the startup command. The main website dependencies must also be present for rebuilding the host.

## First use

1. Open Code Studio. No email, password, signup, or login is required.
2. Create a project and enter its name, description, type, and category.
3. Edit the HTML, CSS, and JavaScript files and test the preview.
4. Save and publish to the Containers library inside Code Studio.

The local workspace has publishing access automatically. Existing administrator projects are preserved. Local access is a single shared workspace on this computer. The optional account/role backend remains available for regression tests, but is not enabled by the normal startup command.

## Working features

- Monaco editor: multiple files, language highlighting, error markers for supported editor languages, undo/redo, search/replace, and formatting for HTML/CSS/JS/TS/JSON.
- New files/folders, nested folders, rename, duplicate, delete, file/folder import, assets, ZIP import/export.
- HTML/CSS/JavaScript and React/TypeScript compilation. React and react-dom are bundled. Relative project imports and CSS assets are resolved from their source files.
- Live preview, manual run/refresh, viewport controls, console output, build errors, and source-backed HTML inspector.
- Real SQLite persistence, automatic and manual draft saving, version history/restore, optimistic concurrency checks, admin-only publishing, user copies, and modified-copy detection.
- Direct local workspace access without login. Optional account-based backend behavior is retained for future multi-user integration and regression tests.

## Storage and preservation

Code Studio data lives in `.data/studio.sqlite` with SQLite journal files. Stop the service before copying the entire `.data` folder as a backup. Keep it private and do not commit it.

The original website source and original distribution were backed up before integration at:

`C:\Users\balaj\Documents\Codex\backups\website-desktop-before-code-studio-20261003`

The top-level `code-studio/` folder contains the editor, local API, and persistence. The main website embeds it through `src/codeStudio/`. The rest of the website source is mapped in `src/ARCHITECTURE.md`.

## Current boundaries

- This is a **local web-development IDE**, not the complete VS Code application. No extension marketplace, Git UI, debugger, or support for every framework/package is claimed.
- Many languages can be edited. Python, Java, C++, Go, Rust, and server-side applications do not run in the browser preview. Adding syntax highlighting does not install their runtimes.
- React/TypeScript preview includes React and react-dom. Arbitrary npm dependencies, remote module imports, external API calls, and backend servers need a separately configured runtime.
- The HTML inspector updates static HTML source. React elements are edited through their source files. Duplicating markup does not automatically rewrite custom event handlers or application state.
- Preview uses an opaque-origin sandbox and restrictive content policy. Code is still running in the browser; this is not a production-grade hostile-code execution system.
- Device controls constrain the preview within available screen space; they are not emulators of specific devices.
- File/folder opening imports copies into this workspace. It does not continuously edit the original disk folder. Export ZIP to obtain files.
- Published items are shared with the main website through its published-library integration.
- The service binds to loopback only. Netlify's static drop alone cannot host its API or database. Production hosting, account recovery, central website authentication, backups, abuse limits, and deployment security remain separate work.
- Project limits are 400 files and 10 MB of stored content. Automatic category detection is a simple non-AI rule; ambiguous components can use a manual category.

## Optional terminal runtime — not verified on this computer

The Terminal panel uses disposable Docker containers. Docker is **not installed on this computer**, so the panel reports the unavailable runtime and does not invent command results.

After installing and starting Docker with Linux containers, build the provided Node.js image:

```powershell
cd C:\Users\balaj\Desktop\2026-09-15\th\website\code-studio
docker build -t lmrs-studio-runtime:local .
```

Then click **Check runtime** in the terminal. Each command receives a fresh project snapshot with no network, no host folder mount, a read-only container root, memory/process limits, and a 30-second timeout. Changes made inside that temporary command container are not synchronized back into the editor. This is a bounded command runner, not a persistent interactive terminal or long-running dev server. The image includes Node.js only; other languages need additional runtime images and tests.

## Tests

```powershell
npm test
npm run build
npm run test:browser
```

Browser tests use installed Google Chrome and temporary test accounts/databases. They do not alter real user projects. Results and screenshots are under `test-results/`.

The executed tests cover the implemented web workflow. A passing report does not mean all programming languages, frameworks, devices, or external runtimes have been tested. See `test-results/verification.md` for the recorded results and remaining requirements.
