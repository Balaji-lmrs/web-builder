# Website Builder

The main website is a React/Vite frontend in `src/`. The integrated Code Studio editor and local API live in `code-studio/`. These are connected parts of one application, not duplicate implementations.

For the active folder map, see [src/ARCHITECTURE.md](src/ARCHITECTURE.md). For Code Studio setup, see [code-studio/README.md](code-studio/README.md).

## Run the full local project

From `code-studio/`, run `./start.ps1` in PowerShell. The script prints the local URL; use that URL rather than assuming a fixed port. Keep that terminal running while using the site. The local server serves the built frontend and provides the Code Studio API.

The main frontend can also be built from the repository root with `npm run build`. Code Studio has separate dependencies and tests: run `npm test` inside `code-studio/`.

## Data and generated output

Browser projects use local browser storage. Code Studio saves work in `code-studio/.data/`. Build output (`dist/` and `code-studio/host-dist/`) and dependencies are generated and ignored by Git. Do not delete storage when cleaning source files.
