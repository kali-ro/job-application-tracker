import { PdfViewer } from "@hatch/space-sdk/pdf";
import type { DocFile } from "../shared";
import { fmtSize, fmtDate } from "../shared";

export function FilePreview({
  doc,
  onClose,
}: {
  doc: DocFile;
  onClose: () => void;
}) {
  const isPdf = doc.mimeType === "application/pdf";
  const isImage = doc.mimeType.startsWith("image/");
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${doc.name}`}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-[var(--surface)] p-4 pb-safe sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-[var(--text)]">
              {doc.name}
            </h3>
            <p className="text-xs text-[var(--dim)]">
              {fmtSize(doc.sizeBytes)} · uploaded {fmtDate(doc.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text)]"
          >
            Close
          </button>
        </div>

        {isPdf ? (
          <PdfViewer src={doc.url} ariaLabel={doc.name} className="w-full" />
        ) : isImage ? (
          <img
            src={doc.url}
            alt={doc.name}
            className="max-h-[70vh] w-full rounded-[var(--radius)] object-contain"
          />
        ) : (
          <div className="rounded-[var(--radius)] bg-[var(--surface-alt)] p-6 text-center">
            <p className="text-sm text-[var(--dim)]">
              No inline preview for this file type.
            </p>
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)]"
            >
              Download {doc.name}
            </a>
          </div>
        )}
        {(isPdf || isImage) && (
          <a
            href={doc.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm font-medium text-[var(--cta)] underline"
          >
            Open original file
          </a>
        )}
      </div>
    </div>
  );
}
