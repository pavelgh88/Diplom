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
  pruned: "#ff7875",
  infeasible: "#bfbfbf",
};

const STATUS_LABEL: Record<string, string> = {
  branched: "Розгалуження",
  integer: "Цілочисельний",
  pruned: "Відсічено",
  infeasible: "Недопустимий",
};

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const H_GAP = 220;
const V_GAP = 120;

function buildLayout(bnbNodes: BnBNode[]): { rfNodes: Node[]; rfEdges: Edge[] } {
  // Compute x positions by depth-first ordering
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
    const valLine =
      n.lp_value !== null
        ? `LP = ${n.lp_value?.toFixed(2)}`
        : "Недопустимо";

    return {
      id: String(n.id),
      position: pos,
      style: {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        background: "#fff",
        border: `2px solid ${color}`,
        borderRadius: 8,
        fontSize: 12,
        padding: 6,
      },
      data: {
        label: (
          <div style={{ lineHeight: 1.4 }}>
            <div style={{ color, fontWeight: 700, fontSize: 11 }}>
              {STATUS_LABEL[n.status]}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 11 }}>{n.label}</div>
            <div style={{ fontSize: 11 }}>{valLine}</div>
            {n.solution && (
              <div style={{ fontSize: 10, color: "#888" }}>
                [{n.solution.map((v) => v.toFixed(2)).join(", ")}]
              </div>
            )}
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
      style: { stroke: "#aaa" },
      labelStyle: { fontSize: 10 },
    }));

  return { rfNodes, rfEdges };
}

const BnBTree: React.FC<Props> = ({ nodes }) => {
  const { rfNodes, rfEdges } = useMemo(() => buildLayout(nodes), [nodes]);

  return (
    <div style={{ width: "100%", height: 560, border: "1px solid #f0f0f0", borderRadius: 8 }}>
      <ReactFlow nodes={rfNodes} edges={rfEdges} fitView attributionPosition="bottom-right">
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

export default BnBTree;
