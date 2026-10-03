# Active Code Studio work

Project: C:/Users/balaj/Desktop/2026-09-15/th/website (the Documents copy is old).

User requested a full browser-area, simple VS Code-style workspace; own files/folders; working form and full frontend websites. Change only code-studio and src/codeStudio. No login. Keep user's projects.

Backup before this layout change: C:/Users/balaj/Documents/Codex/backups/code-studio-layout-20261003-201330.

Found user's form project 19876798-5890-43c5-8a9a-f4d7e7690127. Its preview entry was script.js and its HTML linked style.css although the real file is styles.css. Backed up project JSON, then saved corrected index.html entry and styles.css link through API. Do not replace this form with a sample.

Current edits: src/codeStudio/CodeStudio.tsx now covers viewport via fixed inset 0. UI files formatted for editing. Next: compact menus/activity bar, resizable panels, collapsible console, native folder open/save with import/export fallback, empty new projects, removable entry files, preview errors/alerts, browser tests on actual form. Need rebuild host-dist for wrapper, rebuild Code Studio, restart 4317 service, verify no other original files changed. Docker/language runtimes remain unavailable; do not claim universal execution.

Existing service last started in exec session 74918 on port 4317. API is local direct access. Never delete the SQLite data. Prior completed test counts (before layout changes): 37 backend and 26 browser; tests will need menu/layout updates.
