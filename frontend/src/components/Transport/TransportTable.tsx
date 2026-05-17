import React from "react";
import { Table, Tag } from "antd";
import type { TransportStep } from "../../types";

interface Props {
  step: TransportStep;
  supply: number[];
  demand: number[];
  costs: number[][];
}

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  if (Math.abs(v) < 1e-9) return "0";
  return Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/\.?0+$/, "");
};

const TransportTable: React.FC<Props> = ({ step, supply, demand, costs }) => {
  const m = step.allocation.length;
  const n = step.allocation[0]?.length ?? 0;

  const basicSet = new Set(step.basic_cells.map(([r, c]) => `${r}_${c}`));
  const enteringKey = step.entering_cell ? `${step.entering_cell[0]}_${step.entering_cell[1]}` : null;
  const loopKeys = new Set((step.loop ?? []).map(([r, c]) => `${r}_${c}`));

  // Columns: destination labels + supply column
  const columns = [
    {
      title: "",
      dataIndex: "rowLabel",
      key: "rowLabel",
      width: 80,
      render: (v: string) => <strong>{v}</strong>,
    },
    ...Array.from({ length: n }, (_, j) => ({
      title: (
        <span>
          B<sub>{j + 1}</sub>
          {step.v[j] !== null && step.v[j] !== undefined && (
            <Tag color="blue" style={{ marginLeft: 4, fontSize: 11 }}>
              v={fmt(step.v[j])}
            </Tag>
          )}
          <br />
          <small style={{ color: "#999" }}>d={fmt(demand[j])}</small>
        </span>
      ),
      dataIndex: `col_${j}`,
      key: `col_${j}`,
      width: 120,
    })),
    {
      title: "Запас",
      dataIndex: "supply",
      key: "supply",
      width: 80,
      render: (v: string) => <strong>{v}</strong>,
    },
  ];

  const dataSource = Array.from({ length: m }, (_, i) => {
    const row: Record<string, React.ReactNode> = {
      key: i,
      rowLabel: (
        <span>
          A<sub>{i + 1}</sub>
          {step.u[i] !== null && step.u[i] !== undefined && (
            <Tag color="purple" style={{ marginLeft: 2, fontSize: 11 }}>
              u={fmt(step.u[i])}
            </Tag>
          )}
        </span>
      ),
      supply: fmt(supply[i]),
    };

    for (let j = 0; j < n; j++) {
      const key = `${i}_${j}`;
      const isBasic = basicSet.has(key);
      const isEntering = key === enteringKey;
      const isLoop = loopKeys.has(key);

      const allocation = step.allocation[i][j];
      const delta = step.delta?.[i]?.[j];

      let bg = "transparent";
      let border = "none";
      if (isEntering) {
        bg = "#fff7e6";
        border = "2px solid #fa8c16";
      } else if (isLoop) {
        bg = "#f6ffed";
        border = "2px solid #52c41a";
      }

      row[`col_${j}`] = (
        <div
          style={{
            background: bg,
            border,
            borderRadius: 4,
            padding: "4px 6px",
            minHeight: 48,
            fontFamily: "monospace",
            fontSize: 13,
          }}
        >
          {/* cost in top-right */}
          <div style={{ color: "#aaa", fontSize: 11, textAlign: "right" }}>
            c={fmt(costs[i]?.[j])}
          </div>

          {/* allocation (only for basic cells) */}
          {isBasic || allocation > 0 ? (
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1677ff" }}>
              {fmt(allocation)}
            </div>
          ) : null}

          {/* delta (reduced cost) for non-basic cells */}
          {!isBasic && delta !== null && delta !== undefined && (
            <div style={{ color: delta < 0 ? "#f5222d" : "#389e0d", fontSize: 11 }}>
              Δ={fmt(delta)}
            </div>
          )}
        </div>
      );
    }

    return row;
  });

  // Add demand row
  const demandRow: Record<string, React.ReactNode> = {
    key: "demand",
    rowLabel: <strong>Попит</strong>,
    supply: "",
  };
  for (let j = 0; j < n; j++) {
    demandRow[`col_${j}`] = <strong>{fmt(demand[j])}</strong>;
  }
  dataSource.push(demandRow as any);

  return (
    <Table
      dataSource={dataSource}
      columns={columns}
      pagination={false}
      size="small"
      bordered
      style={{ overflowX: "auto" }}
    />
  );
};

export default TransportTable;
