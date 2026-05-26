import React, { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import type { BnBNode } from "../../types";

interface Props {
  nodes: BnBNode[];
}

const STATUS_COLOR: Record<string, string> = {
  branched: "#1677ff",
  integer: "#52c41a",
  pruned: "#ff4d4f",
  infeasible: "#bfbfbf",
};

const STATUS_BG: Record<string, string> = {
  branched: "#e6f4ff",
  integer: "#f6ffed",
  pruned: "#fff1f0",
  infeasible: "#fafafa",
};

const STATUS_LABEL: Record<string, string> = {
  branched: "Розгалуження",
  integer: "✓ Цілочисельний",
  pruned: "✗ Відсічено",
  infeasible: "— Недопустимий",
};

const NODE_WIDTH = 200;
const NODE_HEIGHT = 100;
const H_GAP = 240;
const V_GAP = 130;

function getExplanationLine(node: BnBNode): string {
  switch (node.status) {
    case "branched": {
      if (node.branch_var === undefined) return "";
      const val = (node.branch_value ?? 0).toFixed(2);
      const j = node.branch_var + 1;
      const fl = Math.floor(node.branch_value ?? 0);
      const ce = Math.ceil(node.branch_value ?? 0);
      return `x${j}=${val} → ≤${fl} | ≥${ce}`;
    }
    case "pruned":
      return `LP≥рекорд → відсікаємо`;
    case "infeasible":
      return "Порожня область";
    case "integer":
      return "Оновлено рекорд!";
    default:
      return "";
  }
}

function buildLayout(bnbNodes: BnBNode[]): { rfNodes: Node[]; rfEdges: Edge[] } {
  const childrenMap = new Map<number | null, BnBNode[]>();
  for (const n of bnbNodes) {
    const pid = n.parent_id ?? null;
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid)!.push(n);
  }

  const xCounter = { value: 0 };
  const posMap = new Map<number, { x: number; y: number }>();

  function assignPos(nodeId: number | null, depth: number): number {
    const children = childrenMap.get(nodeId) ?? [];
    if (children.length === 0) {
      const x = xCounter.value * H_GAP;
      xCounter.value++;
      if (nodeId !== null) posMap.set(nodeId, { x, y: depth * V_GAP });
      return x;
    }
    const childXs = children.map((c) => assignPos(c.id, depth + 1));
    const midX = (childXs[0] + childXs[childXs.length - 1]) / 2;
    if (nodeId !== null) posMap.set(nodeId, { x: midX, y: depth * V_GAP });
    return midX;
  }

  assignPos(null, -1);

  const rfNodes: Node[] = bnbNodes.map((n) => {
    const pos = posMap.get(n.id) ?? { x: 0, y: 0 };
    const color = STATUS_COLOR[n.status] ?? "#888";
    const bg = STATUS_BG[n.status] ?? "#fff";
    const explanation = getExplanationLine(n);
    const lpLine = n.lp_value !== null ? `LP = ${n.lp_value?.toFixed(4)}` : "Недопустимо";

    return {
      id: String(n.id),
      position: pos,
      style: {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        background: bg,
        border: `2px solid ${color}`,
        borderRadius: 10,
        padding: 0,
        overflow: "hidden",
      },
      data: {
        label: (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Header bar */}
            <div style={{
              background: color,
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 8px",
              letterSpacing: 0.3,
            }}>
              {STATUS_LABEL[n.status]}
            </div>
            {/* Body */}
            <div style={{ padding: "5px 8px", flex: 1 }}>
              <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
                {lpLine}
              </div>
              {n.solution && (
                <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>
                  x = [{n.solution.map((v) => v.toFixed(2)).join(", ")}]
                </div>
              )}
              {explanation && (
                <div style={{ fontSize: 10, color: color, fontStyle: "italic" }}>
                  {explanation}
                </div>
              )}
            </div>
          </div>
        ),
      },
    };
  });

  const rfEdges: Edge[] = bnbNodes
    .filter((n) => n.parent_id !== null)
    .map((n) => ({
      id: `e${n.parent_id}-${n.id}`,
      source: String(n.parent_id),
      target: String(n.id),
      label: n.label,
      style: { stroke: "#aaa", strokeWidth: 1.5 },
      labelStyle: { fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: "#fff", fillOpacity: 0.85 },
    }));

  return { rfNodes, rfEdges };
}

const BnBTree: React.FC<Props> = ({ nodes }) => {
  const { rfNodes, rfEdges } = useMemo(() => buildLayout(nodes), [nodes]);

  return (
    <div style={{ width: "100%", height: 580, border: "1px solid #f0f0f0", borderRadius: 8, overflow: "hidden" }}>
      <ReactFlow nodes={rfNodes} edges={rfEdges} fitView attributionPosition="bottom-right">
        <Background color="#f5f5f5" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const status = nodes.find((bn) => String(bn.id) === n.id)?.status ?? "branched";
            return STATUS_COLOR[status] ?? "#888";
          }}
          style={{ border: "1px solid #eee" }}
        />
      </ReactFlow>
    </div>
  );
};

export default BnBTree;
