import { mimeFor } from "./archive";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import Editor, { language, type EditorHandle } from "./editor";
import {
  api,
  type Project,
  type Account,
  type StudioFile,
  type Release,
} from "./types";
import "./style.css";
import { isTextFile, previewEntry } from "./folders";
type Selection = {
  node: number;
  tag: string;
  text: string | null;
  background: string;
  color: string;
  width: string;
  height: string;
  borderRadius: string;
  padding: string;
  href: string;
};
const fingerprint = (p: Project) =>
  JSON.stringify({
    name: p.name,
    description: p.description,
    kind: p.kind,
    category: p.category,
    entry: p.entry,
    files: p.files.map((f) => ({
      path: f.path,
      content: f.content,
      binary: !!f.binary,
      directory: !!f.directory,
      mime: f.mime || "",
    })),
  });
const pathError = (p: string) =>
  !p ||
  p.length > 240 ||
  p.startsWith("/") ||
  /[\\\x00-\x1f:]/.test(p) ||
  p
    .split("/")
    .some((x) => !x || x === "." || x === ".." || x === ".git");
const filename = (p: string) => p.split("/").pop()!;
function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function App() {
  const [user, setUser] = useState<Account | null>(null),
    [loaded, setLoaded] = useState(false),
    [setup, setSetup] = useState(false),
    [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [projects, setProjects] = useState<Project[]>([]),
    [project, setProject] = useState<Project | null>(null),
    [active, setActive] = useState(""),
    [selectedFile, setSelectedFile] = useState(""),
    [collapsed, setCollapsed] = useState<string[]>([]);
  const [view, setView] = useState("editor"),
    [library, setLibrary] = useState<Release[]>([]),
    [query, setQuery] = useState(""),
    [history, setHistory] = useState<{ id: string; created: number }[]>([]),
    [modifications, setModifications] = useState<
      (Project & { user: string })[]
    >([]);
  const [modal, setModal] = useState(""),
    [value, setValue] = useState(""),
    [description, setDescription] = useState(""),
    [kind, setKind] = useState("component"),
    [category, setCategory] = useState("Auto");
  const [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("Saved"),
    [runtime, setRuntime] = useState({
      available: false,
      message: "Checking terminal runtime…",
    });
  const [preview, setPreview] = useState(""),
    [token, setToken] = useState(""),
    [previewState, setPreviewState] = useState("Ready to preview"),
    [buildErrors, setBuildErrors] = useState<string[]>([]),
    [diagnostics, setDiagnostics] = useState<string[]>([]),
    [output, setOutput] = useState<string[]>([]),
    [panel, setPanel] = useState("Output"),
    [live, setLive] = useState(true),
    [device, setDevice] = useState("desktop"),
    [inspect, setInspect] = useState(false),
    [selection, setSelection] = useState<Selection | null>(null);
  const [dragging, setDragging] = useState(false);
  const [editorWidth, setEditorWidth] = useState(() =>
    Number(localStorage.getItem("code-studio-editor-width")) || 650,
  );
  const [command, setCommand] = useState(""),
    [running, setRunning] = useState(false),
    [terminal, setTerminal] = useState<string[]>([]);
  const current = useRef<Project | null>(null),
    savedHash = useRef(""),
    saveTask = useRef<Promise<Project> | null>(null),
    editTask = useRef<Promise<void> | null>(null),
    previewError = useRef(false),
    previewSeq = useRef(0),
    editor = useRef<EditorHandle | null>(null),
    iframe = useRef<HTMLIFrameElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    folderInput = useRef<HTMLInputElement>(null),
    zipInput = useRef<HTMLInputElement>(null),
    compiledProject = useRef<Project | null>(null);
  current.current = project;
  const safe = (fn: () => unknown) => {
    setError("");
    Promise.resolve()
      .then(fn)
      .catch((e) => setError(e.message));
  };
  const refresh = async () => setProjects(await api("projects"));
  useEffect(() => {
    api("status").then((s) => {
      setSetup(s.setup);
      setRuntime(s.runtime);
    });
    api<Account>("me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (user) safe(refresh);
  }, [user]);
  function open(p: Project) {
    savedHash.current = fingerprint(p);
    current.current = p;
    setProject(p);
    const first = p.entry || p.files.find((file) => !file.directory && !file.binary)?.path || "";
    setActive(first);
    setSelectedFile(first);
    setView("editor");
    setSaved("Saved");
    setSelection(null);
    setOutput([]);
    setBuildErrors([]);
  }
  async function save(): Promise<Project> {
    if (editTask.current) await editTask.current;
    if (saveTask.current) {
      await saveTask.current;
      return save();
    }
    const p = current.current;
    if (!p) throw new Error("Open a project first.");
    if (fingerprint(p) === savedHash.current) return p;
    setSaved("Saving…");
    const task = api<Project>("projects/" + p.id, "PUT", p);
    saveTask.current = task;
    try {
      const result = await task;
      savedHash.current = fingerprint(result);
      if (current.current?.id === result.id) {
        const next =
          fingerprint(current.current) === fingerprint(p)
            ? { ...result, files: current.current.files }
            : { ...current.current, revision: result.revision };
        current.current = next;
        setProject(next);
        setSaved(fingerprint(next) === savedHash.current ? "Saved" : "Unsaved");
      }
      return result;
    } catch (e) {
      setSaved("Save failed");
      throw e;
    } finally {
      saveTask.current = null;
    }
  }
  useEffect(() => {
    if (!project || fingerprint(project) === savedHash.current) return;
    setSaved("Unsaved");
    const t = setTimeout(() => safe(() => save()), 1300);
    return () => clearTimeout(t);
  }, [project]);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (
        current.current &&
        fingerprint(current.current) !== savedHash.current
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    addEventListener("beforeunload", prevent);
    return () => removeEventListener("beforeunload", prevent);
  }, []);
  function update(partial: Partial<Project>) {
    if (current.current) {
      current.current = { ...current.current, ...partial };
      setProject(current.current);
    }
  }
  async function applyInspector(node: number, changes: unknown) {
    if (!current.current) return;
    const p = current.current;
    const task = (async () => {
      const r = await api("inspect", "POST", { project: p, node, changes });
      if (current.current?.id !== p.id) return;
      if (fingerprint(current.current) !== fingerprint(p))
        throw new Error(
          "The source changed while editing. Run the preview and try again.",
        );
      update({ files: r.files });
      setSelection(null);
    })();
    editTask.current = task;
    try {
      await task;
    } finally {
      if (editTask.current === task) editTask.current = null;
    }
  }
  async function run(p = current.current) {
    if (!p) return;
    const seq = ++previewSeq.current;
    setPreviewState("Building…");
    try {
      const nextToken = crypto.randomUUID();
      const result = await api("preview", "POST", { ...p, token: nextToken });
      if (seq !== previewSeq.current) return;
      compiledProject.current = structuredClone(p);
      previewError.current = false;
      setSelection(null);
      setBuildErrors([]);
      setOutput((v) => [
        ...v.slice(-100),
        ...result.warnings.map((w: string) => "Warning: " + w),
        "Build successful — " + new Date().toLocaleTimeString(),
      ]);
      setToken(nextToken);
      setPreview(result.html);
      setPreviewState("Loading preview…");
    } catch (e) {
      if (seq === previewSeq.current) {
        setBuildErrors([(e as Error).message]);
        setPreviewState("Build failed — showing last successful preview");
        setPanel("Problems");
      }
    }
  }
  useEffect(() => {
    if (project && live) {
      if (!project.entry) {
        setPreview("");
        setPreviewState("Create or import an HTML, JavaScript, TypeScript, JSX or TSX file to preview.");
        return;
      }
      setPreviewState("Updating preview…");
      const t = setTimeout(() => void run(), 650);
      return () => clearTimeout(t);
    }
  }, [project?.files, project?.entry, project?.id, live]);
  useEffect(() => {
    localStorage.setItem("code-studio-editor-width", String(editorWidth));
  }, [editorWidth]);
  useEffect(() => {
    const receive = (e: MessageEvent) => {
      if (
        e.source !== iframe.current?.contentWindow ||
        e.data?.studioPreview !== token
      )
        return;
      const d = e.data;
      if (d.kind === "ready") {
        if (!previewError.current) setPreviewState("Preview running");
        iframe.current?.contentWindow?.postMessage(
          { studioPreview: token, inspect },
          "*",
        );
      }
      if (d.kind === "console")
        setOutput((v) => [
          ...v.slice(-199),
          `[${d.level}] ${String(d.text).slice(0, 4000)}`,
        ]);
      if (d.kind === "error") {
        previewError.current = true;
        setBuildErrors((v) => [...v.slice(-30), String(d.text)]);
        setPanel("Problems");
        setPreviewState("Runtime error");
      }
      if (d.kind === "select") setSelection(d);
      if (d.kind === "drag-start") setDragging(true);
      if (d.kind === "drag-end") setDragging(false);
      if (
        d.kind === "move" &&
        current.current &&
        compiledProject.current &&
        fingerprint(current.current) === fingerprint(compiledProject.current)
      ) {
        safe(() => applyInspector(d.node, { style: d.style }));
      }
      if (d.kind === "navigate" && current.current) {
        const path = d.path.replace(/^\.\//, "").replace(/^\//, "");
        if (current.current.files.some((f) => f.path === path))
          update({ entry: path });
        else setNotice("Preview link: " + d.path);
      }
    };
    addEventListener("message", receive);
    return () => removeEventListener("message", receive);
  }, [token, inspect]);
  useEffect(() => {
    iframe.current?.contentWindow?.postMessage(
      { studioPreview: token, inspect },
      "*",
    );
    if (!inspect) setSelection(null);
  }, [inspect, token]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        safe(() => save());
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void run();
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  function request(action: string) {
    setError("");
    setValue(
      action === "rename"
        ? selectedFile
        : action === "new-file"
          ? "index.html"
          : action === "new-folder"
            ? "components"
            : action === "new-project"
              ? "Untitled project"
              : "",
    );
    if (action === "metadata" && project) {
      setValue(project.name);
      setDescription(project.description);
      setKind(project.kind);
      setCategory(project.category);
    } else {
      setDescription("");
      if (action === "new-project") {
        setKind(user?.role === "admin" ? "component" : "container");
        setCategory("Auto");
      }
    }
    setModal(action);
  }
  function editFile(name: string, content: string) {
    setProject((p) =>
      p
        ? {
            ...p,
            files: p.files.map((f) =>
              f.path === name ? { ...f, content } : f,
            ),
          }
        : p,
    );
  }
  async function fileAction() {
    if (!project) return;
    if (modal === "reset") {
      const p = await api<Project>("projects/" + project.id);
      open(p);
      setModal("");
      return;
    }
    const files = project.files;
    const original =
      files.find((f) => f.path === selectedFile) ||
      (files.some((f) => f.path.startsWith(selectedFile + "/"))
        ? { path: selectedFile, content: "", directory: true }
        : undefined);
    if (modal === "delete") {
      const next = files.filter(
        (f) =>
          f.path !== selectedFile && !f.path.startsWith(selectedFile + "/"),
      );
      const entry = previewEntry(next, project.entry);
      update({ files: next, entry });
      if (!next.some((f) => f.path === active)) setActive(entry || next.find((f) => !f.directory && !f.binary)?.path || "");
      setSelectedFile(entry || next[0]?.path || "");
      setModal("");
      return;
    }
    const dest = value.trim();
    if (pathError(dest))
      throw new Error(
        "Enter a relative path, for example components/button.html.",
      );
    if (files.some((f) => f.path === dest || f.path.startsWith(dest + "/")))
      throw new Error("A file or folder with that name already exists.");
    let next = files;
    if (modal === "new-file" || modal === "new-folder")
      next = [
        ...files,
        { path: dest, content: "", directory: modal === "new-folder" },
      ];
    if (modal === "rename" || modal === "duplicate") {
      if (!original) throw new Error("Select a file or folder.");
      if (original.directory && dest.startsWith(selectedFile + "/"))
        throw new Error("Choose a destination outside the selected folder.");
      const affected = files.filter(
        (f) => f.path === selectedFile || f.path.startsWith(selectedFile + "/"),
      );
      const moved = affected.map((f) => ({
        ...f,
        path: dest + f.path.slice(selectedFile.length),
      }));
      if (moved.some((f) => files.some((x) => x.path === f.path)))
        throw new Error("Destination contains an existing file.");
      next =
        modal === "duplicate"
          ? [...files, ...moved]
          : [...files.filter((f) => !affected.includes(f)), ...moved];
    }
    let entry = project.entry;
    if (
      modal === "rename" &&
      (entry === selectedFile || entry.startsWith(selectedFile + "/"))
    )
      entry = dest + entry.slice(selectedFile.length);
    if (!entry && modal === "new-file") entry = previewEntry(next, dest);
    update({ files: next, entry });
    setSelectedFile(dest);
    if (
      modal === "new-file" ||
      (!original?.directory && modal !== "new-folder")
    )
      setActive(dest);
    setModal("");
  }
  async function imported(list: FileList | null, folder = false) {
    if (!list || !project) return;
    const incoming: StudioFile[] = [];
    for (const f of Array.from(list)) {
      if (f.size > 20 * 1024 * 1024)
        throw new Error("Each imported file must be below 20 MB.");
      let name = folder
        ? f.webkitRelativePath.split("/").slice(1).join("/")
        : f.name;
      if (!name || pathError(name)) throw new Error("Unsupported file path.");
      if (/(^|\/)(node_modules|\.git)(\/|$)/.test(name)) continue;
      const text = isTextFile(name);
      const content = text
        ? await f.text()
        : await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(",")[1]);
            r.onerror = reject;
            r.readAsDataURL(f);
          });
      incoming.push({ path: name, content, binary: !text, mime: f.type });
    }
    if (
      incoming.some((f) => project.files.some((x) => x.path === f.path)) &&
      !window.confirm("Replace files with matching names?")
    )
      return;
    const files = [
        ...project.files.filter(
          (f) => !incoming.some((x) => x.path === f.path),
        ),
        ...incoming,
      ];
    const entry = previewEntry(files, project.entry);
    update({ files, entry });
    if (!active || !files.some((f) => f.path === active)) setActive(entry || files.find((f) => !f.directory && !f.binary)?.path || "");
    setNotice(`${incoming.length} files imported`);
  }
  async function importZip(f: File | undefined) {
    if (!f || !project) return;
    if (f.size > 40 * 1024 * 1024) throw new Error("ZIP must be below 40 MB.");
    let total = 0;
    const unpacked = unzipSync(new Uint8Array(await f.arrayBuffer()), {
      filter: (f) => {
        total += f.originalSize;
        if (total > 50 * 1024 * 1024)
          throw new Error("Expanded ZIP exceeds 50 MB.");
        return !f.name.endsWith("/");
      },
    });
    const incoming: StudioFile[] = Object.entries(unpacked).map(([name, data]) => {
      if (pathError(name)) throw new Error("ZIP contains an unsafe path.");
      const text = isTextFile(name);
      let binary = "";
      if (!text) for (const b of data) binary += String.fromCharCode(b);
      return {
        path: name,
        content: text ? strFromU8(data) : btoa(binary),
        binary: !text,
        mime: mimeFor(name),
      };
    });
    if (
      incoming.some((f) => project.files.some((x) => x.path === f.path)) &&
      !confirm("Replace files with matching names?")
    )
      return;
    const files = [
        ...project.files.filter(
          (f) => !incoming.some((x) => x.path === f.path),
        ),
        ...incoming,
      ];
    const entry = previewEntry(files, project.entry);
    update({ files, entry });
    if (!active || !files.some((item) => item.path === active)) setActive(entry || files.find((item) => !item.directory && !item.binary)?.path || "");
    setNotice("ZIP imported");
  }
  function exportZip() {
    if (!project) return;
    const data = Object.fromEntries(
      project.files
        .filter((f) => !f.directory)
        .map((f) => [
          f.path,
          f.binary
            ? Uint8Array.from(atob(f.content), (c) => c.charCodeAt(0))
            : strToU8(f.content),
        ]),
    );
    download(
      project.name + ".zip",
      zipSync(data) as BlobPart,
      "application/zip",
    );
  }
  async function libraryView() {
    setQuery("");
    await saveIfOpen();
    setLibrary(await api("library"));
    setView("library");
  }
  async function saveIfOpen() {
    if (current.current) await save();
  }
  async function inspectChange(changes: unknown) {
    if (!selection || !compiledProject.current || !project) return;
    if (fingerprint(compiledProject.current) !== fingerprint(project))
      throw new Error("Run the current preview before editing an element.");
    await applyInspector(selection.node, changes);
  }
  const selected = project?.files.find((f) => f.path === active);
  useEffect(() => {
    parent.postMessage({studioLayout: project && view === "editor" ? "editor" : "welcome"}, location.origin);
  }, [project?.id, view]);
  if (!loaded) return <div className="cs-welcome">Opening Code Studio…</div>;
  if (!user)
    return (
      <div className="cs-auth">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            safe(async () => {
              setUser(
                await api("session", "POST", {
                  email,
                  password,
                  register: setup || register,
                }),
              );
              setPassword("");
              setSetup(false);
              setRegister(false);
            });
          }}
        >
          <div className="cs-logo">&lt;/&gt;</div>
          <small>WEBSITE BUILDER · CODE STUDIO</small>
          <h1>
            {setup
              ? "Set up Code Studio"
              : register
                ? "Create your workspace"
                : "Welcome to Code Studio"}
          </h1>
          <p>
            {setup
              ? "Create the first administrator account to start publishing components."
              : "Sign in to save your work and use published components."}
          </p>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              minLength={10}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <small>At least 10 characters</small>
          </label>
          {error && (
            <p role="alert" className="cs-error">
              {error}
            </p>
          )}
          <button className="cs-primary">
            {setup
              ? "Create admin account"
              : register
                ? "Create user account"
                : "Sign in"}
          </button>
          {!setup && (
            <button type="button" onClick={() => setRegister(!register)}>
              {register
                ? "Already have an account? Sign in"
                : "Create a user account"}
            </button>
          )}
        </form>
      </div>
    );
  return (
    <div className={`cs-root ${project && view === "editor" ? "cs-edit-layout" : "cs-home-layout"}`}>
      {dragging && (
        <div
          className="cs-drag-overlay"
          onPointerMove={(e) => {
            const r = iframe.current?.getBoundingClientRect();
            if (r)
              iframe.current?.contentWindow?.postMessage(
                {
                  studioPreview: token,
                  drag: { x: e.clientX - r.left, y: e.clientY - r.top },
                },
                "*",
              );
          }}
          onPointerUp={() => {
            iframe.current?.contentWindow?.postMessage(
              { studioPreview: token, finishDrag: true },
              "*",
            );
            setDragging(false);
          }}
          onPointerCancel={() => {
            iframe.current?.contentWindow?.postMessage(
              { studioPreview: token, finishDrag: true },
              "*",
            );
            setDragging(false);
          }}
        />
      )}
      <header className="cs-top">
        {project && view === "editor" && <button className="cs-home-button" onClick={() => safe(async () => {await saveIfOpen();await refresh();setView("projects");})}>← Home</button>}
        <div className="cs-brand">
          <span className="cs-logo">&lt;/&gt;</span>
          <div>
            <strong>Code Studio</strong>
            <small>{project?.name || "Your development workspace"}</small>
          </div>
        </div>
        <span className="cs-role">{user.role}</span>
        <div className="cs-top-actions">
          <button onClick={() => request("new-project")}>＋ New project</button>
          <button
            onClick={() =>
              safe(async () => {
                await saveIfOpen();
                await refresh();
                setView("projects");
              })
            }
          >
            Open project
          </button>
          {project && (
            <>
              <button
                onClick={() =>
                  safe(async () => {
                    await save();
                    setNotice("Draft saved");
                  })
                }
              >
                Save draft
              </button>
              <button onClick={() => void run()}>▷ Run preview</button>
              {user.role === "admin" && (
                <button
                  className="cs-primary"
                  onClick={() =>
                    safe(async () => {
                      const p = await save();
                      const r = await api(
                        "projects/" + p.id + "/publish",
                        "POST",
                        { revision: p.revision },
                      );
                      setNotice(
                        `Published ${p.kind} · version ${r.version}. Available in Containers.`,
                      );
                    })
                  }
                >
                  Publish {project.kind}
                </button>
              )}
            </>
          )}
          {!user.local && (
            <button
              title={user.email}
              onClick={() =>
                safe(async () => {
                  await saveIfOpen();
                  await api("logout", "POST", {});
                  setProject(null);
                  setUser(null);
                })
              }
            >
              Sign out
            </button>
          )}
        </div>
      </header>
      <details className="cs-library-menu" open={!(project && view === "editor")}><summary>Library</summary><nav className="cs-nav">
        <button
          className={view === "editor" ? "active" : ""}
          onClick={() => setView("editor")}
        >
          Files & editor
        </button>
        <button
          className={view === "library" ? "active" : ""}
          onClick={() => safe(libraryView)}
        >
          Containers
        </button>
        <button
          onClick={() =>
            safe(async () => {
              await libraryView();
              setQuery("template");
            })
          }
        >
          Templates
        </button>
        <button
          onClick={() => {
            setView("editor");
            fileInput.current?.click();
          }}
        >
          Assets
        </button>
        {user.role === "admin" && (
          <button
            onClick={() =>
              safe(async () => {
                setModifications(await api("modifications"));
                setView("modifications");
              })
            }
          >
            User modifications
          </button>
        )}
        <span>{saved}</span>
      </nav></details>
      {(error || notice) && (
        <div
          className={error ? "cs-banner error" : "cs-banner"}
          role={error ? "alert" : "status"}
        >
          {error || notice}
          <button
            aria-label="Dismiss message"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            ×
          </button>
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        aria-label="Upload files"
        onChange={(e) => safe(() => imported(e.target.files))}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        hidden
        {...({ webkitdirectory: "" } as any)}
        aria-label="Open folder"
        onChange={(e) => safe(() => imported(e.target.files, true))}
      />
      <input
        ref={zipInput}
        type="file"
        accept=".zip"
        hidden
        aria-label="Import ZIP"
        onChange={(e) => safe(() => importZip(e.target.files?.[0]))}
      />
      {view === "projects" || (!project && view === "editor") ? (
        <section className="cs-welcome">
          <span className="cs-eyebrow">YOUR WORKSPACE</span>
          <h1>Build something worth sharing.</h1>
          <p>
            Create a component with code. Preview it, refine it, and publish it
            to your library.
          </p>
          <button className="cs-primary" onClick={() => request("new-project")}>
            ＋ Create project
          </button>
          <div className="cs-cards">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  safe(async () => {
                    await saveIfOpen();
                    open(await api("projects/" + p.id));
                  })
                }
              >
                <span className="cs-card-icon">&lt;/&gt;</span>
                <strong>{p.name}</strong>
                <small>
                  {p.kind} · {p.files.length} files
                </small>
                <span>Continue editing →</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {view === "library" && (
        <section className="cs-library">
          <h1>Published components</h1>
          <p>
            Use a published item to create your own editable copy. Changes to
            your copy are visible to its publishing administrator.
          </p>
          <input
            aria-label="Search published components"
            placeholder="Search components, templates, categories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="cs-cards">
            {library
              .filter((r) =>
                `${r.name} ${r.kind} ${r.category}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((r) => (
                <article key={r.id}>
                  <span className="cs-card-icon">
                    {r.kind === "template" ? "▧" : "◇"}
                  </span>
                  <small>
                    {r.category} · v{r.version}
                  </small>
                  <h2>{r.name}</h2>
                  <p>{r.description}</p>
                  <button
                    className="cs-primary"
                    onClick={() =>
                      safe(async () => {
                        await saveIfOpen();
                        open(
                          await api("library/" + r.id + "/fork", "POST", {}),
                        );
                        await refresh();
                      })
                    }
                  >
                    Use in my project
                  </button>
                  {user.role === "admin" && (
                    <button
                      onClick={() =>
                        safe(async () => {
                          await api(
                            "library/" + r.id + "/unpublish",
                            "POST",
                            {},
                          );
                          setLibrary(await api("library"));
                        })
                      }
                    >
                      Unpublish
                    </button>
                  )}
                </article>
              ))}
          </div>
          {!library.length && (
            <p>
              No items published yet. An administrator can publish a tested
              project here.
            </p>
          )}
        </section>
      )}
      {view === "modifications" && (
        <section className="cs-library">
          <h1>User modifications</h1>
          <p>
            Changed copies appear here automatically. Original published items
            stay separate.
          </p>
          {modifications.map((p) => (
            <details key={p.id}>
              <summary>
                {p.name} · {p.user}
              </summary>
              {p.files
                .filter((f) => !f.binary && !f.directory)
                .map((f) => (
                  <details key={f.path}>
                    <summary>{f.path}</summary>
                    <pre>{f.content}</pre>
                  </details>
                ))}
            </details>
          ))}
          {!modifications.length && <p>No modified copies yet.</p>}
        </section>
      )}
      {view === "editor" && project && (
        <>
          <details className="cs-file-menu"><summary>File</summary><div className="cs-tools">
            <button onClick={() => request("new-file")}>＋ File</button>
            <button onClick={() => request("new-folder")}>＋ Folder</button>
            <button onClick={() => folderInput.current?.click()}>
              Open folder
            </button>
            <button onClick={() => fileInput.current?.click()}>
              Open files / upload
            </button>
            <button onClick={() => zipInput.current?.click()}>
              Import ZIP
            </button>
            <button onClick={exportZip}>Export ZIP</button>
            <button
              onClick={() =>
                safe(async () => {
                  setHistory(await api("projects/" + project.id + "/history"));
                  setModal("history");
                })
              }
            >
              History
            </button>
            <button onClick={() => request("reset")}>Reset to saved</button>
            <button onClick={() => request("metadata")}>
              Project settings
            </button>
          </div></details>
          <div className="cs-workbench" style={{ "--source-width": editorWidth + "px" } as React.CSSProperties}>
            <aside className="cs-explorer">
              <div className="cs-pane-heading">
                EXPLORER{" "}
                <span>{project.files.filter((f) => !f.directory).length}</span>
              </div>
              <div className="cs-file-actions">
                <button
                  title="Rename selected file"
                  onClick={() => request("rename")}
                >
                  Rename
                </button>
                <button
                  title="Duplicate selected file"
                  onClick={() => request("duplicate")}
                >
                  Duplicate
                </button>
                <button
                  title="Delete selected file"
                  onClick={() => request("delete")}
                >
                  Delete
                </button>
              </div>
              <div className="cs-tree">
                {[
                  ...new Set(
                    project.files.flatMap((f) => {
                      const bits = f.path.split("/");
                      return bits
                        .slice(0, -1)
                        .map((_, i) => bits.slice(0, i + 1).join("/"));
                    }),
                  ),
                ]
                  .filter((p) => !project.files.some((f) => f.path === p))
                  .map<StudioFile>((p) => ({
                    path: p,
                    content: "",
                    directory: true,
                  }))
                  .concat(project.files)
                  .sort((a, b) => a.path.localeCompare(b.path))
                  .filter(
                    (f) => !collapsed.some((p) => f.path.startsWith(p + "/")),
                  )
                  .map((f) => (
                    <button
                      className={selectedFile === f.path ? "active" : ""}
                      style={{
                        paddingLeft: 12 + (f.path.split("/").length - 1) * 12,
                      }}
                      key={f.path}
                      title={f.path}
                      onClick={() => {
                        setSelectedFile(f.path);
                        if (f.directory)
                          setCollapsed((v) =>
                            v.includes(f.path)
                              ? v.filter((x) => x !== f.path)
                              : [...v, f.path],
                          );
                        else setActive(f.path);
                      }}
                    >
                      <span className={"cs-file-icon " + language(f.path)}>
                        {f.directory
                          ? collapsed.includes(f.path)
                            ? "▸"
                            : "▾"
                          : f.binary
                            ? "▧"
                            : f.path.endsWith(".html")
                              ? "◇"
                              : "#"}
                      </span>
                      {filename(f.path)}
                    </button>
                  ))}
              </div>
              <div className="cs-explorer-footer">
                {project.kind}
                <br />
                {project.category}
                <br />
                <small>Ctrl+S saves · Ctrl+Enter runs</small>
              </div>
            </aside>
            <section className="cs-source">
              <div className="cs-tabs">
                {project.files
                  .filter((f) => !f.directory)
                  .map((f) => (
                    <button
                      key={f.path}
                      className={active === f.path ? "active" : ""}
                      onClick={() => {
                        setActive(f.path);
                        setSelectedFile(f.path);
                      }}
                    >
                      {filename(f.path)}
                    </button>
                  ))}
              </div>
              <div className="cs-editor-tools">
                <span>{active}</span>
                <button onClick={() => editor.current?.action("undo")}>
                  Undo
                </button>
                <button onClick={() => editor.current?.action("redo")}>
                  Redo
                </button>
                <button
                  onClick={() =>
                    editor.current?.action(
                      "editor.action.startFindReplaceAction",
                    )
                  }
                >
                  Find / replace
                </button>
                <button onClick={() => safe(() => editor.current?.format())}>
                  Format
                </button>
              </div>
              {selected?.binary ? (
                <div className="cs-asset">
                  <p>{selected.path}</p>
                  {selected.mime?.startsWith("image/") && (
                    <img
                      src={`data:${selected.mime};base64,${selected.content}`}
                      alt={selected.path}
                    />
                  )}
                  <button
                    onClick={() =>
                      download(
                        filename(selected.path),
                        Uint8Array.from(atob(selected.content), (c) =>
                          c.charCodeAt(0),
                        ),
                        selected.mime || "application/octet-stream",
                      )
                    }
                  >
                    Download asset
                  </button>
                </div>
              ) : (
                <Editor
                  key={project.id}
                  projectId={project.id}
                  files={project.files}
                  active={active}
                  onChange={editFile}
                  onProblems={setDiagnostics}
                  onReady={(e) => (editor.current = e)}
                />
              )}
              <div className="cs-console">
                <nav>
                  {["Terminal", "Problems", "Output"].map((p) => (
                    <button
                      key={p}
                      className={panel === p ? "active" : ""}
                      onClick={() => setPanel(p)}
                    >
                      {p}
                      {p === "Problems" &&
                        ` (${buildErrors.length + diagnostics.length})`}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      panel === "Terminal" ? setTerminal([]) : setOutput([])
                    }
                  >
                    Clear
                  </button>
                </nav>
                {panel === "Terminal" ? (
                  <>
                    <pre>{runtime.message + "\n" + terminal.join("\n")}</pre>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        safe(async () => {
                          setRunning(true);
                          const cmd = command;
                          setCommand("");
                          setTerminal((v) => [...v, "$ " + cmd]);
                          try {
                            const p = await save();
                            const r = await api(
                              "projects/" + p.id + "/terminal",
                              "POST",
                              { command: cmd },
                            );
                            setTerminal((v) => [
                              ...v,
                              r.output,
                              `Exit ${r.code}${r.error ? " · " + r.error : ""}`,
                            ]);
                          } finally {
                            setRunning(false);
                          }
                        });
                      }}
                    >
                      <span>❯</span>
                      <input
                        aria-label="Terminal command"
                        value={command}
                        disabled={!runtime.available || running}
                        placeholder={
                          runtime.available
                            ? "Enter command…"
                            : "Runtime not connected"
                        }
                        onChange={(e) => setCommand(e.target.value)}
                      />
                      <button
                        disabled={
                          !runtime.available || running || !command.trim()
                        }
                      >
                        Run
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          safe(async () => setRuntime(await api("runtime")))
                        }
                      >
                        Check runtime
                      </button>
                    </form>
                  </>
                ) : (
                  <pre role="log">
                    {panel === "Problems"
                      ? [...buildErrors, ...diagnostics].join("\n") ||
                        "No reported build or editor problems."
                      : output.join("\n") ||
                        "Run a preview to see build and console output."}
                  </pre>
                )}
              </div>
            </section>
            <div
              className="cs-workbench-resizer"
              role="separator"
              aria-label="Resize editor and preview"
              aria-orientation="vertical"
              tabIndex={0}
              onDoubleClick={() => setEditorWidth(650)}
              onPointerDown={(event) => {
                const divider = event.currentTarget;
                const parent = divider.parentElement;
                if (!parent) return;
                divider.setPointerCapture(event.pointerId);
                const start = event.clientX;
                const initial = editorWidth;
                const available = parent.getBoundingClientRect().width;
                divider.onpointermove = (move) => {
                  const next = Math.max(280, Math.min(available - 460, initial + move.clientX - start));
                  setEditorWidth(next);
                };
                divider.onpointerup = (up) => {
                  divider.releasePointerCapture(up.pointerId);
                  divider.onpointermove = null;
                };
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") setEditorWidth((value) => Math.max(280, value - 20));
                if (event.key === "ArrowRight") setEditorWidth((value) => value + 20);
              }}
            />
            <section className="cs-preview">
              <div className="cs-preview-heading">
                <strong>
                  <i /> LIVE PREVIEW
                </strong>
                <div>
                  {["desktop", "tablet", "mobile"].map((d) => (
                    <button
                      key={d}
                      aria-label={d + " preview"}
                      className={device === d ? "active" : ""}
                      onClick={() => setDevice(d)}
                    >
                      {d === "desktop" ? "▰" : d === "tablet" ? "▯" : "▥"}
                    </button>
                  ))}
                  <button
                    aria-label="Refresh preview"
                    onClick={() => void run()}
                  >
                    ↻
                  </button>
                </div>
              </div>
              <div className="cs-preview-tools">
                <select
                  aria-label="Preview entry file"
                  value={project.entry}
                  onChange={(e) => update({ entry: e.target.value })}
                >
                  <option value="" disabled>Select preview file</option>
                  {project.files
                    .filter((f) => /\.(html?|[jt]sx?)$/.test(f.path))
                    .map((f) => (
                      <option key={f.path}>{f.path}</option>
                    ))}
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={live}
                    onChange={(e) => setLive(e.target.checked)}
                  />
                  Live
                </label>
                <button
                  className={inspect ? "active" : ""}
                  onClick={() => setInspect(!inspect)}
                >
                  ⌖ Inspect
                </button>
              </div>
              <div className={"cs-canvas " + device}>
                <iframe
                  ref={iframe}
                  key={token}
                  title="Component preview"
                  sandbox="allow-scripts"
                  style={{
                    pointerEvents:
                      previewState === "Preview running" ||
                      previewState === "Runtime error"
                        ? undefined
                        : "none",
                  }}
                  srcDoc={preview}
                />
              </div>
              <div className="cs-preview-status" role="status">
                {previewState}
              </div>
              {inspect && (
                <div className="cs-inspector">
                  <p className="cs-inspect-help">
                    Click to select. Drag the selected element to move it; hold
                    Shift while dragging to resize.
                  </p>
                  <strong>
                    {selection
                      ? `Selected: ${selection.tag}`
                      : "Click an element to edit it"}
                  </strong>
                  {selection && (
                    <form
                      key={token + "-" + selection.node}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        safe(() =>
                          inspectChange({
                            text: f.has("text")
                              ? String(f.get("text"))
                              : undefined,
                            href:
                              selection.tag === "a" ? f.get("href") : undefined,
                            style: {
                              background: f.get("background"),
                              color: f.get("color"),
                              "border-radius": f.get("radius"),
                              padding: f.get("padding"),
                              width: f.get("width"),
                              height: f.get("height"),
                            },
                          }),
                        );
                      }}
                    >
                      {selection.text !== null && (
                        <label>
                          Text
                          <input name="text" defaultValue={selection.text} />
                        </label>
                      )}
                      {selection.tag === "a" && (
                        <label>
                          Link
                          <input name="href" defaultValue={selection.href} />
                        </label>
                      )}
                      <div>
                        {[
                          ["background", "Background", selection.background],
                          ["color", "Text color", selection.color],
                          ["radius", "Radius", selection.borderRadius],
                          ["padding", "Padding", selection.padding],
                          ["width", "Width", selection.width],
                          ["height", "Height", selection.height],
                        ].map(([name, label, v]) => (
                          <label key={name}>
                            {label}
                            <input name={name} defaultValue={v} />
                          </label>
                        ))}
                      </div>
                      <button className="cs-primary">Apply properties</button>
                      <button
                        type="button"
                        onClick={() =>
                          safe(() => inspectChange({ duplicate: true }))
                        }
                      >
                        Duplicate element
                      </button>
                      <button
                        type="button"
                        className="cs-danger"
                        onClick={() =>
                          safe(() => inspectChange({ delete: true }))
                        }
                      >
                        Delete element
                      </button>
                    </form>
                  )}
                </div>
              )}
            </section>
          </div>
          <footer className="cs-status">
            <span>◉ {user.local ? "Local workspace" : user.email}</span>
            <span>{project.files.length} files</span>
            <span>{language(active)} · UTF-8</span>
            <span>{saved}</span>
          </footer>
        </>
      )}
      {modal && (
        <div className="cs-modal-backdrop">
          <form
            className="cs-modal"
            role="dialog"
            aria-label={modal}
            onSubmit={(e) => {
              e.preventDefault();
              safe(async () => {
                if (modal === "new-project") {
                  await saveIfOpen();
                  open(
                    await api("projects", "POST", {
                      name: value,
                      description,
                      kind,
                      category,
                      entry: "",
                      files: [],
                    }),
                  );
                  await refresh();
                  setModal("");
                } else if (modal === "metadata") {
                  update({ name: value, description, kind, category });
                  setModal("");
                } else await fileAction();
              });
            }}
          >
            <h2>
              {
                (
                  {
                    "new-project": "Create a project",
                    "new-file": "New file",
                    "new-folder": "New folder",
                    rename: "Rename",
                    duplicate: "Duplicate",
                    delete: "Delete selected item",
                    reset: "Discard unsaved changes?",
                    metadata: "Project settings",
                    history: "Version history",
                  } as Record<string, string>
                )[modal]
              }
            </h2>
            {[
              "new-project",
              "new-file",
              "new-folder",
              "rename",
              "duplicate",
              "metadata",
            ].includes(modal) && (
              <label>
                {["new-project", "metadata"].includes(modal) ? "Name" : "Path"}
                <input
                  autoFocus
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
            )}
            {["new-project", "metadata"].includes(modal) && (
              <>
                <label>
                  Description
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <label>
                  Type
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    {user.role === "admin" && (
                      <option value="component">Component</option>
                    )}
                    <option value="container">Container</option>
                    <option value="template">Template</option>
                  </select>
                </label>
                <label>
                  Category
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {[
                      "Auto",
                      "Buttons",
                      "Forms",
                      "Navigation",
                      "Footers",
                      "Cards",
                      "Hero sections",
                      "Custom",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {modal === "delete" && (
              <p>Delete {selectedFile} and its contents from this project?</p>
            )}
            {modal === "reset" && (
              <p>
                Reload the last saved files. Save history remains available.
              </p>
            )}
            {modal === "history" && (
              <div className="cs-history">
                {history.map((h) => (
                  <button
                    type="button"
                    key={h.id}
                    onClick={() =>
                      safe(async () => {
                        const p = await save();
                        open(
                          await api("projects/" + p.id + "/restore", "POST", {
                            version: h.id,
                            revision: p.revision,
                          }),
                        );
                        setModal("");
                      })
                    }
                  >
                    Restore {new Date(h.created).toLocaleString()}
                  </button>
                ))}
                {!history.length && <p>No earlier saved versions yet.</p>}
              </div>
            )}
            {error && (
              <p className="cs-error" role="alert">
                {error}
              </p>
            )}
            <div className="cs-modal-actions">
              <button type="button" onClick={() => setModal("")}>
                Cancel
              </button>
              {modal !== "history" && (
                <button className="cs-primary">
                  {modal === "delete"
                    ? "Delete"
                    : modal === "new-project"
                      ? "Create project"
                      : modal === "reset"
                        ? "Discard changes"
                        : "Confirm"}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

