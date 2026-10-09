# Source map

`main.tsx` starts the React app. `app/App.tsx` contains only the route table.

- `app/Shell.tsx`: shared website navigation, account controls, and page shell.
- `app/Auth.tsx`: login and signup screens.
- `pages/Dashboard/`: dashboard UI.
- `pages/Projects/`: My Projects, project cards, filters, and published-item thumbnails.
- `pages/Templates/`, `pages/Components/`, `pages/Settings/`: their respective pages.
- `pages/Workspace/`: visual website builder and canvas behavior.
- `pages/Preview/`, `pages/Cart/`: preview and cart pages.
- `app/AssetsLibrary.tsx`, `app/ProjectCartDrawer.tsx`: My Projects asset library and cart sidebar.
- `codeStudio/CodeStudioRoute.tsx`: route that embeds the separate Code Studio application.
- `codeStudio/CodeStudio.tsx`: iframe host for that application.
- `assetLibrary.ts`, `publishedLibrary.tsx`, `store.ts`, `types.ts`, `data.ts`: shared storage, published content, project state, domain types, and built-in data.

The separate top-level `code-studio/` directory is **not a duplicate page**. It is the Code Studio editor, local API, SQLite storage integration, and its own test/build configuration. Its generated `host-dist/` is the built main website served by that local server. Do not delete `code-studio/.data/`; it contains saved local work.

`src/styles.css` remains the shared stylesheet. Its existing cascade order is part of the current UI, so it was not split during the behavior-preserving source reorganization.
