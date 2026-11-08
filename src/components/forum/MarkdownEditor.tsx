"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { previewMarkdown, registerUpload } from "@/server/actions/forum";

/** Textarea with Write/Preview tabs, LaTeX support, and (when configured) image upload. */
export function MarkdownEditor({
  name,
  defaultValue = "",
  rows = 10,
  placeholder,
  uploadsEnabled,
  userId,
  label,
}: {
  name: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
  uploadsEnabled: boolean;
  userId: string;
  label: string;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [value, setValue] = useState(defaultValue);
  const [html, setHtml] = useState("");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const id = `md-${name}`;

  function insert(text: string) {
    const el = ta.current;
    if (!el) return setValue((v) => v + text);
    const { selectionStart: a, selectionEnd: b } = el;
    const next = value.slice(0, a) + text + value.slice(b);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = a + text.length;
    });
  }

  async function onFile(file: File) {
    setErr(null);
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return setErr("Images only: PNG, JPEG, WebP, or GIF.");
    if (file.size > 5 * 1024 * 1024) return setErr("Images must be under 5 MB.");
    setUploading(true);
    try {
      const { upload } = await import("@vercel/blob/client");
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const blob = await upload(`forum/${userId}/${safe}`, file, { access: "public", handleUploadUrl: "/api/uploads" });
      await registerUpload({ url: blob.url, pathname: blob.pathname, contentType: file.type as "image/png", size: file.size });
      insert(`\n![${file.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "")}](${blob.url})\n`);
    } catch {
      setErr("The upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <div role="tablist" className="flex gap-1 text-sm">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={clsx("rounded-t-md px-3 py-1 capitalize", tab === t ? "border border-b-0 border-[var(--c-border)] font-semibold" : "text-muted")}
              onClick={async () => {
                setTab(t);
                if (t === "preview") setHtml(await previewMarkdown(value));
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <textarea
        ref={ta}
        id={id}
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={clsx("input font-mono !text-[0.92rem]", tab === "preview" && "hidden")}
        onPaste={(e) => {
          const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/"));
          if (f && uploadsEnabled) {
            e.preventDefault();
            void onFile(f);
          }
        }}
      />
      {tab === "preview" ? (
        <div className="prose book-prose min-h-[10rem] rounded-md border border-[var(--c-border)] p-4 !text-base" dangerouslySetInnerHTML={{ __html: html || "<p><em>Nothing to preview yet.</em></p>" }} />
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>
          Markdown + LaTeX: <code>**bold**</code> <code>$K_a$</code> <code>$\ce&#123;H2O&#125;$</code> <code>$$…$$</code>
        </span>
        {uploadsEnabled ? (
          <label className="ml-auto cursor-pointer font-semibold text-[var(--c-accent)]">
            {uploading ? "Uploading…" : "Add image"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={uploading} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
        ) : null}
      </div>
      {err ? <p role="alert" className="mt-1 text-xs text-[var(--c-trap)]">{err}</p> : null}
    </div>
  );
}
