import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api } from "./api";
import { STAGES, type Application, type SavedSearch } from "./shared";
import { Board } from "./components/Board";
import { PipelineFlow } from "./components/PipelineFlow";
import {
ApplicationEditor,
type AppFormInitial,
} from "./components/ApplicationEditor";
import { SearchesView } from "./components/SearchesView";
import { ResumesView } from "./components/ResumesView";
import { FilesView } from "./components/FilesView";

type Tab = "board" | "searches" | "resumes" | "files";

const TABS: { value: Tab; label: string }[] = [
  { value: "board", label: "Pipeline" },
  { value: "searches", label: "Searches" },
  { value: "resumes", label: "Resumes" },
  { value: "files", label: "Files" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("board");
  const [editor, setEditor] = useState<AppFormInitial | null>(null);
  const [tailorAppId, setTailorAppId] = useState<number | null>(null);

  const applicationsQ = useQuery({
    queryKey: ["applications"],
    queryFn: () => api.listApplications({}),
  });
  const searchesQ = useQuery({
    queryKey: ["searches"],
    queryFn: () => api.listSavedSearches({}),
  });
  const resumesQ = useQuery({
    queryKey: ["resumes"],
    queryFn: () => api.listResumes({}),
  });
  const documentsQ = useQuery({
    queryKey: ["documents"],
    queryFn: () => api.listAllDocuments({}),
  });

  const applications = useMemo(
    () => applicationsQ.data?.applications ?? [],
    [applicationsQ.data],
  );
  const searches = searchesQ.data?.searches ?? [];
  const resumes = resumesQ.data?.resumes ?? [];
  const documents = documentsQ.data?.documents ?? [];

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of STAGES) map.set(s.value, 0);
    for (const a of applications) map.set(a.status, (map.get(a.status) ?? 0) + 1);
    return map;
  }, [applications]);

  const openEditor = (initial: AppFormInitial) => setEditor(initial);
  const openApp = (app: Application) => openEditor({ application: app });
  const trackFromSearch = (search: SavedSearch) => {
    openEditor({
      prefill: {
        board: search.board ?? undefined,
        location: search.location ?? undefined,
        savedSearchId: search.id,
      },
    });
    setTab("board");
  };
  const tailorFor = (applicationId: number) => {
    setEditor(null);
    setTailorAppId(applicationId);
    setTab("resumes");
  };

  const loading =
    applicationsQ.isPending || searchesQ.isPending || resumesQ.isPending;
  const loadError =
    applicationsQ.error ?? searchesQ.error ?? resumesQ.error ?? documentsQ.error;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <main className="mx-auto w-full max-w-6xl px-4 pb-10">
        {/* Stage strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-sm">
          <span className="font-bold text-[var(--text)]">
            {applications.length}{" "}
            {applications.length === 1 ? "application" : "applications"}
          </span>
          {STAGES.map((s) => (
            <span key={s.value} className="flex items-center gap-1.5 text-[var(--dim)]">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label} {counts.get(s.value) ?? 0}
            </span>
          ))}
          <button
            type="button"
            onClick={() => openEditor({})}
            className="ml-auto rounded-[var(--radius)] bg-[var(--cta)] px-4 py-2 text-sm font-semibold text-[var(--cta-text)]"
          >
            Add a job
          </button>
        </div>

        {/* Tabs */}
        <nav
          aria-label="Tracker sections"
          className="mt-4 flex gap-1 border-b border-[var(--border)]"
        >
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              aria-current={tab === t.value ? "page" : undefined}
              className={`rounded-t-[var(--radius)] px-3 py-2 text-sm font-semibold sm:px-4 ${
                tab === t.value
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-[inset_0_-2px_0_var(--accent)]"
                  : "text-[var(--dim)]"
              }`}
            >
              {t.label}
              {t.value === "resumes" && resumes.length > 0 && (
                <span className="ml-1.5 text-xs font-medium text-[var(--dim)]">
                  {resumes.length}
                </span>
              )}
              {t.value === "files" && documents.length > 0 && (
                <span className="ml-1.5 text-xs font-medium text-[var(--dim)]">
                  {documents.length}
                </span>
              )}
              {t.value === "searches" && searches.length > 0 && (
                <span className="ml-1.5 text-xs font-medium text-[var(--dim)]">
                  {searches.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="pt-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-[var(--dim)]">
              Loading your tracker…
            </p>
          ) : loadError ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-[var(--danger)]">
                Something went wrong loading your data.
              </p>
              <button
                type="button"
                onClick={() => {
                  void applicationsQ.refetch();
                  void searchesQ.refetch();
                  void resumesQ.refetch();
                  void documentsQ.refetch();
                }}
                className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)]"
              >
                Try again
              </button>
            </div>
          ) : tab === "board" ? (
            applications.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-12 text-center">
                <p className="text-base font-semibold text-[var(--text)]">
                  Your pipeline is empty.
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--dim)]">
                  Add the first job you're eyeing — even one you haven't
                  applied to yet. It lands in Saved, and you move it along as
                  things happen.
                </p>
                <button
                  type="button"
                  onClick={() => openEditor({})}
                  className="mt-4 rounded-[var(--radius)] bg-[var(--cta)] px-4 py-2 text-sm font-semibold text-[var(--cta-text)]"
                >
                  Add your first job
                </button>
              </div>
            ) : (
              <>
                <PipelineFlow applications={applications} />
                <Board applications={applications} onOpen={openApp} />
              </>
            )
          ) : tab === "searches" ? (
            <SearchesView
              searches={searches}
              applications={applications}
              onTrackJob={trackFromSearch}
            />
          ) : tab === "resumes" ? (
            <ResumesView
              resumes={resumes}
              applications={applications}
              tailorAppId={tailorAppId}
              onTailorHandled={() => setTailorAppId(null)}
            />
          ) : (
            <FilesView documents={documents} applications={applications} />
          )}
        </div>
      </main>

      {editor && (
        <ApplicationEditor
          initial={editor}
          searches={searches}
          onClose={() => setEditor(null)}
          onTailor={tailorFor}
        />
      )}
    </div>
  );
}
