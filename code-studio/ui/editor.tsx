import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import * as prettier from "prettier/standalone";
import * as html from "prettier/plugins/html";
import * as css from "prettier/plugins/postcss";
import * as babel from "prettier/plugins/babel";
import * as estree from "prettier/plugins/estree";
import * as ts from "prettier/plugins/typescript";
import type { StudioFile } from "./types";
(self as typeof self & { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    return label === "json"
      ? new JsonWorker()
      : label === "css"
        ? new CssWorker()
        : label === "html"
          ? new HtmlWorker()
          : ["typescript", "javascript"].includes(label)
            ? new TsWorker()
            : new EditorWorker();
  },
};
monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
  allowNonTsExtensions: true,
  target: monaco.languages.typescript.ScriptTarget.ESNext,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
});
export const language = (p: string) =>
  ({
    html: "html",
    htm: "html",
    css: "css",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    py: "python",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    go: "go",
    rs: "rust",
    php: "php",
    sql: "sql",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
    sh: "shell",
    ps1: "powershell",
    xml: "xml",
    svg: "xml",
  })[p.split(".").pop() || ""] || "plaintext";
export type EditorHandle = {
  action: (name: string) => void;
  format: () => Promise<void>;
  getValue: () => string;
};
export default function Editor({
  projectId,
  files,
  active,
  onChange,
  onProblems,
  onReady,
}: {
  projectId: string;
  files: StudioFile[];
  active: string;
  onChange: (path: string, value: string) => void;
  onProblems: (v: string[]) => void;
  onReady: (editor: EditorHandle) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    instance = useRef<monaco.editor.IStandaloneCodeEditor | null>(null),
    models = useRef(new Map<string, monaco.editor.ITextModel>()),
    change = useRef(onChange),
    problems = useRef(onProblems);
  change.current = onChange;
  problems.current = onProblems;
  useEffect(() => {
    const editor = monaco.editor.create(element.current!, {
      theme: document.documentElement.dataset.theme === "light" ? "vs" : "vs-dark",
      automaticLayout: true,
      fontSize: 13,
      fontFamily: "Consolas, monospace",
      minimap: { enabled: false },
      padding: { top: 18 },
      scrollBeyondLastLine: false,
      tabSize: 2,
      wordWrap: "on",
      ariaLabel: "Source code editor",
      model: null,
    });
    instance.current = editor;
    const themeObserver = new MutationObserver(() => monaco.editor.setTheme(document.documentElement.dataset.theme === "light" ? "vs" : "vs-dark"));
    themeObserver.observe(document.documentElement, {attributes:true,attributeFilter:['data-theme']});
    const sub = editor.onDidChangeModelContent(() => {
      const m = editor.getModel();
      if (m) change.current(m.uri.path.slice(1), m.getValue());
    });
    const diagnostic = monaco.editor.onDidChangeMarkers(() => {
      const current = Array.from(models.current.values()).flatMap((m) =>
        monaco.editor.getModelMarkers({ resource: m.uri }),
      );
      problems.current(
        current
          .filter((m) => m.severity >= monaco.MarkerSeverity.Warning)
          .map(
            (m) =>
              `${m.resource.path.slice(1)}:${m.startLineNumber} ${m.message}`,
          )
          .slice(0, 80),
      );
    });
    onReady({
      action: (name) => {
        editor.focus();
        if (name === "undo" || name === "redo")
          editor.trigger("toolbar", name, null);
        else void editor.getAction(name)?.run();
      },
      getValue: () => editor.getValue(),
      format: async () => {
        const m = editor.getModel();
        if (!m) return;
        const lang = m.getLanguageId();
        const parser = (
          {
            html: "html",
            css: "css",
            javascript: "babel",
            typescript: "typescript",
            json: "json",
          } as Record<string, string>
        )[lang];
        if (!parser)
          throw new Error(
            "Formatting is available for HTML, CSS, JavaScript, TypeScript and JSON.",
          );
        const result = await prettier.format(m.getValue(), {
          parser,
          plugins: [html, css, babel, estree, ts],
          tabWidth: 2,
        });
        editor.pushUndoStop();
        editor.executeEdits("format", [
          { range: m.getFullModelRange(), text: result },
        ]);
        editor.pushUndoStop();
      },
    });
    return () => {
      sub.dispose();
      diagnostic.dispose();
      themeObserver.disconnect();
      editor.dispose();
      models.current.forEach((m) => m.dispose());
      models.current.clear();
    };
  }, [projectId]);
  useEffect(() => {
    for (const file of files.filter((f) => !f.directory && !f.binary)) {
      let model = models.current.get(file.path);
      if (!model) {
        model = monaco.editor.createModel(
          file.content,
          language(file.path),
          monaco.Uri.from({
            scheme: "inmemory",
            authority: projectId,
            path: "/" + file.path,
          }),
        );
        models.current.set(file.path, model);
      } else if (model.getValue() !== file.content)
        model.setValue(file.content);
    }
    for (const [name, model] of models.current) {
      if (!files.some((f) => f.path === name)) {
        if (instance.current?.getModel() === model)
          instance.current.setModel(null);
        model.dispose();
        models.current.delete(name);
      }
    }
    const m = models.current.get(active);
    if (m && instance.current?.getModel() !== m) instance.current?.setModel(m);
  }, [files, active, projectId]);
  return <div ref={element} className="cs-editor" />;
}
