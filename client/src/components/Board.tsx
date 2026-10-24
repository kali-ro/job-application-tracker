import {
useCallback,
useEffect,
useMemo,
useRef,
useState,
type PointerEvent as ReactPointerEvent,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import {
ACTIVE_STAGES,
STAGES,
daysUntil,
defaultNextStep,
fmtDate,
matchColor,
shortNextStep,
stageMeta,
type Application,
type Status,
} from "../shared";

type DragState = {
  app: Application;
  mode: "native" | "pointer";
  active: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  overStage: Status | null;
};

export function Board({
  applications,
  onOpen,
}: {
  applications: Application[];
  onOpen: (app: Application) => void;
}) {
  const [filter, setFilter] = useState("");
  const [stageTab, setStageTab] = useState<Status | "all">("all");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const dragRef = useRef<DragState | null>(null);
  const suppressClickUntilRef = useRef(0);
  const queryClient = useQueryClient();

  const moveMutation = useMutation({
    mutationFn: (args: { id: number; status: Status }) =>
      api.updateApplicationStatus({ id: args.id, status: args.status }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });

  const setDragBoth = useCallback((next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const finishDrag = useCallback(
    (commit: boolean) => {
      const current = dragRef.current;
      if (!current) return;
      if (current.active) {
        suppressClickUntilRef.current = Date.now() + 250;
      }
      if (
        commit &&
        current.active &&
        current.overStage &&
        current.overStage !== current.app.status
      ) {
        const target = current.overStage;
        moveMutation.mutate({ id: current.app.id, status: target });
        setAnnouncement(
          `Moved ${current.app.title} at ${current.app.company} to ${stageMeta(target).label}.`,
        );
      } else if (current.active) {
        setAnnouncement(
          `Drag cancelled for ${current.app.title} at ${current.app.company}.`,
        );
      }
      setDragBoth(null);
    },
    [moveMutation, setDragBoth],
  );

  // --- Pointer drag (touch + mouse via the grip handle) ---
  const handlePointerDown = useCallback(
    (e: ReactPointerEvent, app: Application) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const cardEl = (e.currentTarget as HTMLElement).closest("article");
      const rect = cardEl?.getBoundingClientRect();
      const start: DragState = {
        app,
        mode: "pointer",
        active: false,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        offsetX: rect ? e.clientX - rect.left : 24,
        offsetY: rect ? e.clientY - rect.top : 24,
        width: rect ? rect.width : 260,
        overStage: null,
      };
      setDragBoth(start);
    },
    [setDragBoth],
  );

  useEffect(() => {
    if (!drag || drag.mode !== "pointer") return;

    const findStageAt = (x: number, y: number): Status | null => {
      const els = document.querySelectorAll<HTMLElement>("[data-drop-stage]");
      let found: Status | null = null;
      els.forEach((el) => {
        // Skip elements not visible (e.g. desktop columns while on phone).
        if (el.offsetParent === null && el.getClientRects().length === 0) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          const v = el.getAttribute("data-drop-stage");
          if (v) found = v as Status;
        }
      });
      return found;
    };

    const onMove = (ev: PointerEvent) => {
      const current = dragRef.current;
      if (!current || current.mode !== "pointer") return;
      const dx = ev.clientX - current.startX;
      const dy = ev.clientY - current.startY;
      const active = current.active || Math.hypot(dx, dy) > 7;
      const overStage = active
        ? findStageAt(ev.clientX, ev.clientY)
        : current.overStage;
      const next: DragState = {
        ...current,
        active,
        x: ev.clientX,
        y: ev.clientY,
        overStage,
      };
      dragRef.current = next;
      setDrag(next);
      if (active) {
        ev.preventDefault();
        // Gentle auto-scroll near the viewport edges so long boards stay
        // draggable on a phone screen.
        if (ev.clientY < 90) window.scrollBy(0, -14);
        else if (ev.clientY > window.innerHeight - 90) window.scrollBy(0, 14);
        document.body.style.userSelect = "none";
      }
    };

    const onUp = () => {
      document.body.style.userSelect = "";
      finishDrag(true);
    };
    const onCancel = () => {
      document.body.style.userSelect = "";
      finishDrag(false);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      document.body.style.userSelect = "";
    };
  }, [drag?.mode, finishDrag]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Native HTML5 drag (mouse drag of the whole card on desktop) ---
  const handleNativeDragStart = useCallback(
    (e: React.DragEvent, app: Application) => {
      // Drags started from the grip handle use the pointer path instead.
      if ((e.target as HTMLElement).closest("[data-grip]")) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", String(app.id));
      } catch {
        // Some browsers restrict setData in tests; state below still works.
      }
      const cardEl = (e.currentTarget as HTMLElement).closest("article");
      const rect = cardEl?.getBoundingClientRect();
      setDragBoth({
        app,
        mode: "native",
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        offsetX: rect ? e.clientX - rect.left : 0,
        offsetY: rect ? e.clientY - rect.top : 0,
        width: rect ? rect.width : 260,
        overStage: null,
      });
      setAnnouncement(
        `Dragging ${app.title} at ${app.company}. Drop it on a stage to move it.`,
      );
    },
    [setDragBoth],
  );

  const handleNativeDragEnd = useCallback(() => {
    const current = dragRef.current;
    if (current?.mode === "native") {
      suppressClickUntilRef.current = Date.now() + 250;
      setDragBoth(null);
    }
  }, [setDragBoth]);

  const dropPropsFor = useCallback(
    (stage: Status) => ({
      "data-drop-stage": stage,
      onDragOver: (e: React.DragEvent) => {
        const current = dragRef.current;
        if (!current) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (current.overStage !== stage) {
          const next = { ...current, overStage: stage };
          dragRef.current = next;
          setDrag(next);
        }
      },
      onDragLeave: () => {
        const current = dragRef.current;
        if (current && current.overStage === stage) {
          const next = { ...current, overStage: null };
          dragRef.current = next;
          setDrag(next);
        }
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const current = dragRef.current;
        if (current && current.app.status !== stage) {
          moveMutation.mutate({ id: current.app.id, status: stage });
          setAnnouncement(
            `Moved ${current.app.title} at ${current.app.company} to ${stageMeta(stage).label}.`,
          );
        }
        setDragBoth(null);
      },
    }),
    [moveMutation, setDragBoth],
  );

  const shouldSuppressClick = useCallback(
    () => Date.now() < suppressClickUntilRef.current,
    [],
  );

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return applications;
    return applications.filter(
      (a) =>
        a.company.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        (a.location ?? "").toLowerCase().includes(q),
    );
  }, [applications, filter]);

  const byStage = useMemo(() => {
    const map = new Map<Status, Application[]>();
    for (const s of STAGES) map.set(s.value, []);
    for (const a of visible) map.get(a.status)?.push(a);
    return map;
  }, [visible]);

  const deadlines = useMemo(() => {
    return visible
      .filter(
        (a) =>
          a.deadline &&
          a.status !== "rejected" &&
          a.status !== "withdrawn" &&
          a.status !== "offer",
      )
      .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))
      .slice(0, 4);
  }, [visible]);

  const draggingApp = drag?.active ? drag.app : null;
  const isOver = (stage: Status) =>
    !!drag?.active && drag.overStage === stage && drag.app.status !== stage;

  const cardProps = {
    drag,
    onOpen,
    onPointerDown: handlePointerDown,
    onNativeDragStart: handleNativeDragStart,
    onNativeDragEnd: handleNativeDragEnd,
    shouldSuppressClick,
  };

  const closedStages: Status[] = ["rejected", "withdrawn"];
  const showClosed =
    closedStages.some((st) => (byStage.get(st)?.length ?? 0) > 0) ||
    !!draggingApp;

  return (
    <div>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="mb-3">
        <label htmlFor="board-filter" className="sr-only">
          Filter applications by company, title, or location
        </label>
        <input
          id="board-filter"
          className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          placeholder="Filter by company, title, or location…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <p className="mb-3 flex items-center gap-2 text-xs text-[var(--dim)]">
        <GripIcon />
        <span>
          Drag a card to another stage to move it — drag the card itself, or
          hold its grip handle on touch screens.
        </span>
      </p>

      {deadlines.length > 0 && (
        <section
          aria-label="Upcoming deadlines"
          className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3"
        >
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
            Coming up
          </h2>
          <ul className="mt-2 space-y-1.5">
            {deadlines.map((a) => {
              const d = daysUntil(a.deadline);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(a)}
                    className="flex w-full items-center gap-2 text-left text-sm"
                  >
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        d !== null && d < 0
                          ? "bg-[#dc322f] text-[#fdf6e3]"
                          : d !== null && d <= 3
                            ? "bg-[#b58900] text-[#fdf6e3]"
                            : "bg-[var(--surface-alt)] text-[var(--text)]"
                      }`}
                    >
                      {d === null
                        ? ""
                        : d < 0
                          ? `${Math.abs(d)}d overdue`
                          : d === 0
                            ? "Today"
                            : `In ${d}d`}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--text)]">
                      {a.title} · {a.company}
                    </span>
                    <span
                      className="min-w-0 truncate text-xs text-[var(--dim)]"
                      title={a.nextStep ?? undefined}
                    >
                      {a.nextStep
                        ? shortNextStep(a.nextStep)
                        : fmtDate(a.deadline)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Phone: stage tabs double as drop targets + single list */}
      <div className="md:hidden">
        <div
          className="mb-3 flex flex-wrap gap-1.5"
          role="tablist"
          aria-label="Filter by stage — drag a card onto a stage to move it"
        >
          <StageChip
            label="All"
            count={visible.length}
            active={stageTab === "all"}
            onClick={() => setStageTab("all")}
          />
          {STAGES.map((s) => (
            <StageChip
              key={s.value}
              label={s.label}
              count={byStage.get(s.value)?.length ?? 0}
              active={stageTab === s.value}
              isDropTarget={!!draggingApp && draggingApp.status !== s.value}
              isOver={isOver(s.value)}
              onClick={() => setStageTab(s.value)}
              dropProps={dropPropsFor(s.value)}
            />
          ))}
        </div>
        <div className="space-y-2">
          {(stageTab === "all" ? visible : (byStage.get(stageTab) ?? [])).map(
            (a) => (
              <JobCard key={a.id} app={a} showStage {...cardProps} />
            ),
          )}
          {(stageTab === "all" ? visible : (byStage.get(stageTab) ?? []))
            .length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--dim)]">
              Nothing in this stage yet.
            </p>
          )}
        </div>
      </div>

      {/* Wider: columns per active stage, closed stages below */}
      <div className="hidden md:block">
        <div className="grid grid-cols-5 gap-3">
          {ACTIVE_STAGES.map((s) => (
            <StageColumn
              key={s.value}
              stage={s.value}
              label={s.label}
              color={s.color}
              apps={byStage.get(s.value) ?? []}
              isOver={isOver(s.value)}
              isDragging={!!draggingApp}
              dropProps={dropPropsFor(s.value)}
              cardProps={cardProps}
            />
          ))}
        </div>

        {showClosed && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {closedStages.map((st) => (
              <StageColumn
                key={st}
                stage={st}
                label={stageMeta(st).label}
                color={stageMeta(st).color}
                apps={byStage.get(st) ?? []}
                isOver={isOver(st)}
                isDragging={!!draggingApp}
                muted
                dropProps={dropPropsFor(st)}
                cardProps={cardProps}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating card that follows the pointer during a grip drag */}
      {drag?.mode === "pointer" && drag.active && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 rounded-[var(--radius)] border-2 border-[var(--accent)] bg-[var(--surface)] p-3 shadow-2xl"
          style={{
            left: drag.x - drag.offsetX,
            top: drag.y - drag.offsetY,
            width: drag.width,
            transform: "rotate(1.5deg) scale(1.02)",
          }}
        >
          <p className="text-sm font-bold leading-snug text-[var(--text)]">
            {drag.app.title}
          </p>
          <p className="mt-0.5 text-sm text-[var(--dim)]">{drag.app.company}</p>
          <p className="mt-2 text-xs font-semibold text-[var(--accent)]">
            {drag.overStage && drag.overStage !== drag.app.status
              ? `Release to move to ${stageMeta(drag.overStage).label}`
              : `Currently ${stageMeta(drag.app.status).label} — drag to a stage`}
          </p>
        </div>
      )}
    </div>
  );
}

function GripIcon() {
  return (
    <svg
      aria-hidden
      width="12"
      height="18"
      viewBox="0 0 12 18"
      fill="currentColor"
      className="shrink-0"
    >
      <circle cx="3" cy="3" r="1.6" />
      <circle cx="9" cy="3" r="1.6" />
      <circle cx="3" cy="9" r="1.6" />
      <circle cx="9" cy="9" r="1.6" />
      <circle cx="3" cy="15" r="1.6" />
      <circle cx="9" cy="15" r="1.6" />
    </svg>
  );
}

function StageColumn({
  stage,
  label,
  color,
  apps,
  isOver,
  isDragging,
  muted = false,
  dropProps,
  cardProps,
}: {
  stage: Status;
  label: string;
  color: string;
  apps: Application[];
  isOver: boolean;
  isDragging: boolean;
  muted?: boolean;
  dropProps: Record<string, unknown>;
  cardProps: CardDragProps;
}) {
  return (
    <section
      aria-label={`${label} column${isOver ? " — drop to move here" : ""}`}
      aria-dropeffect={isDragging ? "move" : undefined}
      className={`min-w-0 rounded-[var(--radius)] p-1.5 transition-colors ${
        isOver
          ? "bg-[var(--surface-alt)] outline-2 outline-dashed outline-[var(--accent)]"
          : isDragging
            ? "outline-1 outline-dashed outline-[var(--border)]"
            : ""
      }`}
      {...dropProps}
    >
      <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-[var(--text)]">
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        {label}
        <span className="text-xs font-medium text-[var(--dim)]">
          {apps.length}
        </span>
        {isOver && (
          <span className="ml-auto text-xs font-semibold text-[var(--accent)]">
            Drop here
          </span>
        )}
      </h2>
      <div className={`min-h-16 space-y-2 ${muted ? "opacity-75" : ""}`}>
        {apps.map((a) => (
          <JobCard key={a.id} app={a} {...cardProps} />
        ))}
        {apps.length === 0 && (
          <p
            className={`rounded-[var(--radius)] border border-dashed px-2 py-4 text-center text-xs ${
              isOver
                ? "border-[var(--accent)] font-semibold text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--dim)]"
            }`}
          >
            {isDragging ? `Drop here to move to ${label}` : "Empty"}
          </p>
        )}
      </div>
    </section>
  );
}

function StageChip({
  label,
  count,
  active,
  onClick,
  isDropTarget = false,
  isOver = false,
  dropProps,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  isDropTarget?: boolean;
  isOver?: boolean;
  dropProps?: Record<string, unknown>;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
        isOver
          ? "bg-[var(--accent)] text-[var(--accent-text)] outline-2 outline-dashed outline-offset-2 outline-[var(--accent)]"
          : active
            ? "bg-[var(--accent)] text-[var(--accent-text)]"
            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
      } ${isDropTarget && !isOver ? "border-dashed" : ""}`}
      {...(dropProps ?? {})}
    >
      {label} · {count}
      {isOver ? " — drop" : ""}
    </button>
  );
}

type CardDragProps = {
  drag: DragState | null;
  onOpen: (app: Application) => void;
  onPointerDown: (e: ReactPointerEvent, app: Application) => void;
  onNativeDragStart: (e: React.DragEvent, app: Application) => void;
  onNativeDragEnd: () => void;
  shouldSuppressClick: () => boolean;
};

function JobCard({
  app,
  showStage = false,
  drag,
  onOpen,
  onPointerDown,
  onNativeDragStart,
  onNativeDragEnd,
  shouldSuppressClick,
}: {
  app: Application;
  showStage?: boolean;
} & CardDragProps) {
  const meta = stageMeta(app.status);
  const d = daysUntil(app.deadline);
  const workLabel =
    app.workType === "remote"
      ? "Remote"
      : app.workType === "hybrid"
        ? "Hybrid"
        : app.workType === "onsite"
          ? "On-site"
          : null;
  const locationDupesWork =
    workLabel !== null &&
    app.location?.trim().toLowerCase() === workLabel.toLowerCase();
  const metaBits = [
    app.location,
    locationDupesWork ? null : workLabel,
    app.salaryText,
  ].filter(Boolean);

  const isThisDragging = drag?.app.id === app.id && drag.active;

  return (
    <article
      draggable
      onDragStart={(e) => onNativeDragStart(e, app)}
      onDragEnd={onNativeDragEnd}
      aria-grabbed={isThisDragging}
      className={`rounded-[var(--radius)] border bg-[var(--surface)] p-3 shadow-sm transition-opacity ${
        isThisDragging
          ? "border-dashed border-[var(--accent)] opacity-40"
          : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={() => {
            if (!shouldSuppressClick()) onOpen(app);
          }}
          className="block min-w-0 flex-1 cursor-grab text-left active:cursor-grabbing"
          aria-label={`Open ${app.title} at ${app.company}`}
        >
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-snug text-[var(--text)]">
            {app.title}
          </h3>
          <p className="mt-0.5 truncate text-sm text-[var(--dim)]">
            {app.company}
          </p>
          <p className="mt-1 h-4 truncate text-xs text-[var(--dim)]">
            {metaBits.length > 0 ? metaBits.join(" · ") : " "}
          </p>
          <div className="mt-2 flex h-6 items-center gap-1.5">
            {showStage && (
              <span
                className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold text-[#fdf6e3]"
                style={{ backgroundColor: meta.color }}
              >
                {meta.label}
              </span>
            )}
            {app.matchPercent != null && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-[#fdf6e3]"
                style={{ backgroundColor: matchColor(app.matchPercent) }}
                title={
                  app.matchCheckedAt
                    ? `Resume match checked ${fmtDate(app.matchCheckedAt)}`
                    : "Resume match"
                }
              >
                {app.matchPercent}% match
              </span>
            )}
          </div>
          <p
            className="mt-1.5 flex h-5 items-center gap-1 text-xs"
            title={app.nextStep ?? undefined}
          >
            <span className="shrink-0 font-semibold text-[var(--strong)]">
              Next:
            </span>
            <span
              className={`min-w-0 truncate font-medium ${
                app.nextStep ? "text-[var(--text)]" : "text-[var(--dim)]"
              }`}
            >
              {app.nextStep
                ? shortNextStep(app.nextStep)
                : defaultNextStep(app.status)}
            </span>
          </p>
          <p className="mt-1 h-4 truncate text-xs">
            {app.deadline ? (
              <span
                className={`font-medium ${
                  d !== null && d < 0
                    ? "text-[var(--danger)]"
                    : d !== null && d <= 3
                      ? "text-[var(--cta)]"
                      : "text-[var(--dim)]"
                }`}
              >
                {fmtDate(app.deadline)}
                {d !== null &&
                  (d < 0
                    ? ` · ${Math.abs(d)}d overdue`
                    : d === 0
                      ? " · today"
                      : ` · in ${d}d`)}
              </span>
            ) : app.appliedDate && app.status !== "saved" ? (
              <span className="text-[var(--dim)]">
                Applied {fmtDate(app.appliedDate)}
              </span>
            ) : (
              " "
            )}
          </p>
        </button>
        <button
          type="button"
          data-grip
          draggable={false}
          aria-label={`Drag ${app.title} at ${app.company} to another stage`}
          title="Drag to move to another stage"
          onPointerDown={(e) => {
            e.stopPropagation();
            onPointerDown(e, app);
          }}
          onClick={(e) => e.preventDefault()}
          className="shrink-0 cursor-grab touch-none rounded-md px-1.5 py-2 text-[var(--dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)] active:cursor-grabbing"
        >
          <GripIcon />
        </button>
      </div>
    </article>
  );
}
