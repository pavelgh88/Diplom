import React from "react";
import { Table, Tag, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
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
      title: (
        <Tooltip title="Постачальник Aᵢ. Значення uᵢ — потенціал рядка, обчислений з умови uᵢ+vⱼ=cᵢⱼ для базисних клітин">
          <span style={{ cursor: "help" }}>
            &nbsp;<QuestionCircleOutlined style={{ color: "#8c8c8c", fontSize: 11 }} />
          </span>
        </Tooltip>
      ),
      dataIndex: "rowLabel",
      key: "rowLabel",
      width: 90,
      render: (v: string) => <strong>{v}</strong>,
    },
    ...Array.from({ length: n }, (_, j) => ({
      title: (
        <Tooltip title={`Споживач B${j+1}. vⱼ — потенціал стовпця. Оцінка Δᵢⱼ = cᵢⱼ − uᵢ − vⱼ: якщо Δ<0, клітина кандидат на покращення`}>
          <span style={{ cursor: "help" }}>
            B<sub>{j + 1}</sub>
            {step.v[j] !== null && step.v[j] !== undefined && (
              <Tag color="blue" style={{ marginLeft: 4, fontSize: 11 }}>
                v={fmt(step.v[j])}
              </Tag>
            )}
            <br />
            <small style={{ color: "#999" }}>d={fmt(demand[j])}</small>
          </span>
        </Tooltip>
      ),
      dataIndex: `col_${j}`,
      key: `col_${j}`,
      width: 120,
    })),
    {
      title: (
        <Tooltip title="Обсяг товару, який може відвантажити цей постачальник">
          <span style={{ cursor: "help" }}>
            Запас <QuestionCircleOutlined style={{ color: "#8c8c8c", fontSize: 11 }} />
          </span>
        </Tooltip>
      ),
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

  const ColorDot: React.FC<{ color: string; border?: string; label: string; tip: string }> = ({ color, border, label, tip }) => (
    <Tooltip title={tip}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "help" }}>
        <span style={{ width: 12, height: 12, borderRadius: 2, background: color, border: border ?? "none", display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "#666" }}>{label}</span>
      </span>
    </Tooltip>
  );

  return (
    <div>
      <Table
        dataSource={dataSource}
        columns={columns}
        pagination={false}
        size="small"
        bordered
        style={{ overflowX: "auto" }}
      />
      {/* Legend */}
      <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
        <ColorDot color="#e6f4ff" label="Синє число — xᵢⱼ" tip="Базисна клітина: обсяг перевезень від постачальника i до споживача j (xᵢⱼ > 0)" />
        <ColorDot color="#fff7e6" border="2px solid #fa8c16" label="Помаранч. — вхідна клітина" tip="Клітина з найменшою оцінкою Δᵢⱼ < 0, яка входить до базису для покращення плану" />
        <ColorDot color="#f6ffed" border="2px solid #52c41a" label="Зелена — цикл" tip="Клітини циклу перерозподілу: чергування +θ / −θ. θ = мін. значення серед клітин зі знаком «−»" />
        <Tooltip title="Оцінка небазисної клітини: Δᵢⱼ = cᵢⱼ − uᵢ − vⱼ. Якщо Δ ≥ 0 для всіх клітин — план оптимальний">
          <span style={{ fontSize: 11, color: "#666", cursor: "help" }}>
            <span style={{ color: "#f5222d", fontWeight: 600 }}>Δ&lt;0</span> / <span style={{ color: "#389e0d", fontWeight: 600 }}>Δ≥0</span> — оцінки клітин <QuestionCircleOutlined style={{ fontSize: 11 }} />
          </span>
        </Tooltip>
      </div>
    </div>
  );
};

export default TransportTable;
