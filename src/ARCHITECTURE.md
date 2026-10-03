# Source organization

The source tree is organized by responsibility:

- `pages/` contains feature page areas: Dashboard, Projects, Templates, Components, Workspace, and Settings.
- `components/layout/` contains the application shell, sidebar, top bar, and profile menu.
- `components/common/` contains reusable UI controls.
- `components/editor/` contains workspace editing controls.
- `data/` contains template and component catalogs.
- `store/` contains application state modules.
- `types/` contains domain types.
- `hooks/` contains reusable React hooks.
- `utils/` contains storage, date, and validation helpers.
- `styles/` contains feature stylesheet modules.

Compatibility modules currently re-export the existing runtime modules. This keeps the website behavior unchanged while giving future work a clear destination for incremental extraction.
