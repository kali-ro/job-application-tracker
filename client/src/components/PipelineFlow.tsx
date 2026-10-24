import { useEffect, useMemo, useRef, useState } from "react";
import {
Layer,
Rectangle,
ResponsiveContainer,
Sankey,
Tooltip,
} from "recharts";
import { STAGES, type Application, type Status } from "../shared";

// Sankey of where the tracked jobs sit today.
//
// The tracker only stores each job's *current* status — there is no
// stage-history — so this chart is a snapshot, not a journey: every job
// flows "All applications" → "In pipeline" / "Closed" → its current stage,
// and every link value is a count recomputed from those same rows. A job
// rejected after interviewing therefore counts under Rejected only; the
// chart never claims it passed through Interview.

const ACTIVE: Status[] = ["saved", "applied", "screening", "interview", "offer"];
const CLOSED: Status[] = ["rejected", "withdrawn"];

type FlowNodeData = {
  name: string;
  shortName: string;
  fill: string;
  depth: number;
};

type SankeyNodeRenderProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: FlowNodeData & { value?: number };
  containerWidth?: number;
};

function FlowNode(
  props: SankeyNodeRenderProps & { compact?: boolean },
) {
  const { x = 0, y = 0, width = 0, height = 0, payload, compact = false } =
    props;
  if (!payload) return <Layer />;
  const name = compact
    ? (payload.shortName ?? payload.name ?? "")
    : (payload.name ?? "");
  const value = payload.value ?? 0;
  const fill = payload.fill ?? "#93a1a1";
  const depth = payload.depth ?? 0;
  // Leaves (current stages) label to the right of their bar; the source and
  // grouping bars label to the left, in the margin. A surface-coloured halo
  // keeps the text readable where it crosses a translucent link.
  const isLeaf = depth === 2;
  const labelX = isLeaf ? x + width + 8 : x - 8;
  const anchor = isLeaf ? "start" : "end";
  return (
    <Layer>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={0.92}
        radius={3}
      />
      <text
        x={labelX}
        y={y + height / 2}
        textAnchor={anchor}
        dominantBaseline="middle"
        fontSize={compact ? 12 : 12.5}
        fontWeight={600}
        fill="var(--text)"
        style={{
          paintOrder: "stroke",
          stroke: "var(--surface)",
          strokeWidth: 4,
          strokeLinejoin: "round",
        }}
      >
        {name} · {value}
      </text>
    </Layer>
  );
}

type SankeyLinkRenderProps = {
  sourceX?: number;
  sourceY?: number;
  sourceControlX?: number;
  targetX?: number;
  targetY?: number;
  targetControlX?: number;
  linkWidth?: number;
  payload?: {
    source?: FlowNodeData;
    target?: FlowNodeData;
  };
};

function FlowLink(props: SankeyLinkRenderProps) {
  const {
    sourceX = 0,
    sourceY = 0,
    sourceControlX = 0,
    targetX = 0,
    targetY = 0,
    targetControlX = 0,
    linkWidth = 0,
    payload,
  } = props;
  const stroke =
    payload?.source?.fill ?? payload?.target?.fill ?? "#93a1a1";
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={stroke}
      strokeWidth={Math.max(linkWidth, 1)}
      strokeOpacity={0.32}
    />
  );
}

function FlowTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    name?: string;
    value?: number;
    payload?: {
      source?: { name?: string };
      target?: { name?: string };
      value?: number;
    };
  }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  if (!item) return null;
  const link = item.payload;
  const isLink =
    link && typeof link === "object" && "source" in link && "target" in link;
  const text = isLink
    ? `${link.source?.name ?? ""} → ${link.target?.name ?? ""}: ${link.value ?? item.value ?? 0}`
    : `${item.name ?? ""}: ${item.value ?? 0}`;
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] shadow-md">
      {text}{" "}
      {text.endsWith(": 1") ? "application" : "applications"}
    </div>
  );
}

export function PipelineFlow({
  applications,
}: {
  applications: Application[];
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [wrapWidth, setWrapWidth] = useState(900);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWrapWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const compact = wrapWidth < 560;

  const total = applications.length;

  const counts = useMemo(() => {
    const map = new Map<Status, number>();
    for (const s of STAGES) map.set(s.value, 0);
    for (const a of applications)
      map.set(a.status, (map.get(a.status) ?? 0) + 1);
    return map;
  }, [applications]);

  const activeTotal = ACTIVE.reduce((n, s) => n + (counts.get(s) ?? 0), 0);
  const closedTotal = CLOSED.reduce((n, s) => n + (counts.get(s) ?? 0), 0);

  const data = useMemo(() => {
    const nodes: FlowNodeData[] = [];
    const links: { source: number; target: number; value: number }[] = [];
    const addNode = (node: FlowNodeData): number => {
      nodes.push(node);
      return nodes.length - 1;
    };

    const allIdx = addNode({
      name: "All applications",
      shortName: "All",
      fill: "#586e75",
      depth: 0,
    });
    const pipelineIdx =
      activeTotal > 0
        ? addNode({
            name: "In pipeline",
            shortName: "Open",
            fill: "#268bd2",
            depth: 1,
          })
        : -1;
    const closedIdx =
      closedTotal > 0
        ? addNode({
            name: "Closed",
            shortName: "Closed",
            fill: "#93a1a1",
            depth: 1,
          })
        : -1;
    if (pipelineIdx >= 0)
      links.push({ source: allIdx, target: pipelineIdx, value: activeTotal });
    if (closedIdx >= 0)
      links.push({ source: allIdx, target: closedIdx, value: closedTotal });

    for (const s of STAGES) {
      const count = counts.get(s.value) ?? 0;
      if (count === 0) continue;
      const idx = addNode({
        name: s.label,
        shortName: s.label,
        fill: s.color,
        depth: 2,
      });
      const parent = ACTIVE.includes(s.value) ? pipelineIdx : closedIdx;
      if (parent >= 0)
        links.push({ source: parent, target: idx, value: count });
    }
    return { nodes, links };
  }, [counts, activeTotal, closedTotal]);

  if (total === 0) return null;

  const stageRows = STAGES.map((s) => ({
    ...s,
    count: counts.get(s.value) ?? 0,
  })).filter((r) => r.count > 0);

  return (
    <section
      aria-label="Pipeline flow diagram"
      className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-bold text-[var(--text)]">
          Pipeline flow
        </h2>
        <p className="text-xs text-[var(--dim)]">
          {activeTotal} in pipeline
          {closedTotal > 0 ? ` · ${closedTotal} closed` : ""} · {total} total
        </p>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-[var(--dim)]">
        How your {total} tracked{" "}
        {total === 1 ? "application splits" : "applications split"} between
        still being in play and closed out — and the stage each one is in
        right now.
      </p>

      <div
        ref={wrapRef}
        className="mt-2 w-full"
        role="img"
        aria-label={`Sankey diagram: ${total} applications, ${stageRows
          .map((r) => `${r.count} ${r.label}`)
          .join(", ")}`}
      >
        <ResponsiveContainer width="100%" height={320}>
          <Sankey
            data={data}
            nodePadding={28}
            nodeWidth={16}
            linkCurvature={0.55}
            iterations={64}
            margin={
              compact
                ? { top: 12, right: 92, bottom: 12, left: 76 }
                : { top: 12, right: 120, bottom: 12, left: 148 }
            }
            node={(p: SankeyNodeRenderProps) => (
              <FlowNode {...p} compact={compact} />
            )}
            link={(p: SankeyLinkRenderProps) => <FlowLink {...p} />}
          >
            <Tooltip content={<FlowTooltip />} />
          </Sankey>
        </ResponsiveContainer>
      </div>

      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[var(--border)] pt-3 text-sm">
        {stageRows.map((r) => (
          <li key={r.value} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: r.color }}
            />
            <span className="font-medium text-[var(--text)]">{r.label}</span>
            <span className="text-[var(--dim)]">
              {r.count} · {Math.round((r.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[var(--dim)]">
        Based on each job&rsquo;s current stage. A job closed after
        interviewing counts under Rejected or Withdrawn, not Interview.
      </p>
    </section>
  );
}
