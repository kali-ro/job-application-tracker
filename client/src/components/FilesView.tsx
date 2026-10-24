import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fileToBase64 } from "@hatch/space-sdk/client";
import { api } from "../api";
import {
fmtDate,
fmtSize,
inputCls,
labelCls,
type Application,
type DocFile,
} from "../shared";
import { FilePreview } from "./FilePreview";

export function FilesView({
  documents,
  applications,
}: {
  documents: DocFile[];
  applications: Application[];
}) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<DocFile | null>(null);
  const [attachTo, setAttachTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["documents"] });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { dataBase64, mimeType } = await fileToBase64(file);
      return api.uploadDocument({
        name: file.name,
        mimeType: file.type || mimeType,
        dataBase64,
        applicationId: attachTo ? Number(attachTo) : null,
      });
    },
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const reassign = useMutation({
    mutationFn: (args: { id: number; applicationId: number | null }) =>
      api.setDocumentApplication(args),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteDocument({ id }),
    onSuccess: () => {
      invalidate();
      setConfirmDeleteId(null);
    },
  });

  const groups = useMemo(() => {
    const library = documents.filter((d) => d.applicationId == null);
    const byApp = new Map<number, DocFile[]>();
    for (const d of documents) {
      if (d.applicationId != null) {
        const list = byApp.get(d.applicationId) ?? [];
        list.push(d);
        byApp.set(d.applicationId, list);
      }
    }
    return { library, byApp };
  }, [documents]);

  const appName = (id: number) => {
    const a = applications.find((x) => x.id === id);
    return a ? `${a.company} — ${a.title}` : "Removed application";
  };

  const renderRow = (d: DocFile) => (
    <li
      key={d.id}
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setPreview(d)}
          className="min-w-0 flex-1 text-left"
          aria-label={`Preview ${d.name}`}
        >
          <span className="block truncate text-sm font-semibold text-[var(--text)]">
            {d.name}
          </span>
          <span className="block text-xs text-[var(--dim)]">
            {fmtSize(d.sizeBytes)} · {fmtDate(d.createdAt)}
          </span>
        </button>
        <a
          href={d.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--text)]"
        >
          Download
        </a>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`doc-app-${d.id}`}>
          Attach {d.name} to application
        </label>
        <select
          id={`doc-app-${d.id}`}
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1.5 text-xs font-medium text-[var(--text)]"
          value={d.applicationId != null ? String(d.applicationId) : ""}
          onChange={(e) =>
            reassign.mutate({
              id: d.id,
              applicationId: e.target.value ? Number(e.target.value) : null,
            })
          }
        >
          <option value="">Library (no application)</option>
          {applications.map((a) => (
            <option key={a.id} value={a.id}>
              {a.company} — {a.title}
            </option>
          ))}
        </select>
        {confirmDeleteId === d.id ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => remove.mutate(d.id)}
              className="rounded-md bg-[var(--danger)] px-2 py-1.5 text-xs font-semibold text-[#fdf6e3]"
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="px-2 py-1.5 text-xs font-medium text-[var(--text)]"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDeleteId(d.id)}
            className="px-2 py-1.5 text-xs font-medium text-[var(--danger)]"
          >
            Delete
          </button>
        )}
      </div>
    </li>
  );

  return (
    <div>
      <div className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-bold text-[var(--text)]">Upload a file</h2>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Resume PDFs, cover letters, portfolios, offer letters — up to 15 MB
          each. Attach a file to an application, or leave it in the library.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-44 flex-1">
            <label htmlFor="upload-attach" className={labelCls}>
              Attach to
            </label>
            <select
              id="upload-attach"
              className={inputCls}
              value={attachTo}
              onChange={(e) => setAttachTo(e.target.value)}
            >
              <option value="">Library (no application)</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.company} — {a.title}
                </option>
              ))}
            </select>
          </div>
          <label className="cursor-pointer rounded-[var(--radius)] bg-[var(--cta)] px-4 py-2 text-sm font-semibold text-[var(--cta-text)]">
            {upload.isPending ? "Uploading…" : "Choose file"}
            <input
              type="file"
              className="sr-only"
              aria-label="Choose a file to upload"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setError(null);
                  upload.mutate(f);
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-[var(--danger)]">
            {error}
          </p>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
          <p className="text-sm font-medium text-[var(--text)]">
            No files stored yet.
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--dim)]">
            Upload the documents you actually send, so every application keeps
            the exact version that went out the door.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...groups.byApp.entries()].map(([appId, docs]) => (
            <section key={appId} aria-label={`Files for ${appName(appId)}`}>
              <h3 className="mb-2 text-sm font-bold text-[var(--text)]">
                {appName(appId)}
              </h3>
              <ul className="space-y-2">{docs.map(renderRow)}</ul>
            </section>
          ))}
          {groups.library.length > 0 && (
            <section aria-label="Library files">
              <h3 className="mb-2 text-sm font-bold text-[var(--text)]">
                Library
              </h3>
              <ul className="space-y-2">{groups.library.map(renderRow)}</ul>
            </section>
          )}
        </div>
      )}

      {preview && <FilePreview doc={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
