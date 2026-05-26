import React from "react";
import { Table, Tag, Typography, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import type { SimplexStep } from "../../types";

const { Text } = Typography;

interface Props {
  step: SimplexStep;
  stepIndex: number;
  hideExplanation?: boolean;
}

const fmt = (v: number) => {
  const r = Math.round(v * 10000) / 10000;
  return Number.isInteger(r) ? String(r) : r.toFixed(4).replace(/\.?0+$/, "");
};

const ColorDot: React.FC<{ color: string; label: string; tip: string }> = ({ color, label, tip }) => (
  <Tooltip title={tip}>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "help" }}>
      <span style={{ width: 12, height: 12, borderRadius: 2, background: color, display: "inline-block", flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: "#666" }}>{label}</span>
    </span>
  </Tooltip>
);

const StepExplanation: React.FC<{ step: SimplexStep }> = ({ step }) => {
  const { tableau, col_names, row_names, pivot_row, pivot_col } = step;
  const m = tableau.length - 1; // number of constraint rows
  const lastCol = tableau[0].length - 1;

  if (pivot_row !== null && pivot_col !== null) {
    const objCoeff = tableau[m][pivot_col];
    const bVal = tableau[pivot_row][lastCol];
    const pivotEl = tableau[pivot_row][pivot_col];
    const ratio = pivotEl !== 0 ? bVal / pivotEl : NaN;
    const entering = col_names[pivot_col];
    const leaving = row_names[pivot_row];

    return (
      <div style={{ background: "#f6f8ff", border: "1px solid #d6e4ff", borderRadius: 6, padding: "8px 12px", marginTop: 8, fontSize: 12, lineHeight: 1.8 }}>
        <div>
          <Text style={{ color: "#1d3557", fontSize: 12 }}>
            <span style={{ background: "#f0f5ff", padding: "1px 6px", borderRadius: 3, marginRight: 4 }}>Ведучий стовпець</span>
            <strong>«{entering}»</strong> — коефіцієнт рядка ЦФ = <strong style={{ color: "#d4380d" }}>{fmt(objCoeff)}</strong> (найменший від'ємний → найбільший виграш при збільшенні цієї змінної)
          </Text>
        </div>
        <div>
          <Text style={{ color: "#1d3557", fontSize: 12 }}>
            <span style={{ background: "#fff7e6", padding: "1px 6px", borderRadius: 3, marginRight: 4 }}>Ведучий рядок</span>
            <strong>«{leaving}»</strong> — мін. відношення b/a = {fmt(bVal)} / {fmt(pivotEl)} = <strong style={{ color: "#d4380d" }}>{fmt(ratio)}</strong> (обмеження на скільки можна збільшити {entering})
          </Text>
        </div>
        <div>
          <Text style={{ color: "#1d3557", fontSize: 12 }}>
            <span style={{ background: "#ff7875", padding: "1px 5px", borderRadius: 3, marginRight: 4, color: "#fff", fontSize: 11 }}>Елемент зведення</span>
            a = <strong>{fmt(pivotEl)}</strong> — ділимо ведучий рядок на нього, потім обнуляємо стовпець «{entering}» в усіх інших рядках.{" "}
            <strong>«{entering}»</strong> входить до базису, <strong>«{leaving}»</strong> виходить.
          </Text>
        </div>
      </div>
    );
  }

  if (step.description.toLowerCase().includes("оптимальн")) {
    return (
      <div style={{ background: "#f6ffed", border: "1px solid #b7eb8f", borderRadius: 6, padding: "8px 12px", marginTop: 8, fontSize: 12 }}>
        <Text style={{ color: "#135200", fontSize: 12 }}>
          ✅ <strong>Умова оптимальності виконана:</strong> всі коефіцієнти рядка цільової функції ≥ 0 — жодна змінна поза базисом не може покращити значення ЦФ. Розв'язання завершено.
        </Text>
      </div>
    );
  }

  const basisNames = row_names.slice(0, m).join(", ");
  return (
    <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 6, padding: "8px 12px", marginTop: 8, fontSize: 12 }}>
      <Text style={{ color: "#595959", fontSize: 12 }}>
        <strong>Початкова таблиця.</strong> Базис: {"{" + basisNames + "}"}. До кожного обмеження «≤» додано <em>змінну відхилення</em> sᵢ ≥ 0 — вона «поглинає» нев'язку. При x = 0 маємо s = b — це початковий допустимий план.
      </Text>
    </div>
  );
};

const SimplexTable: React.FC<Props> = ({ step, stepIndex, hideExplanation }) => {
  const { tableau, col_names, row_names, pivot_row, pivot_col } = step;

  const columns = col_names.map((name, colIdx) => ({
    title: <Text strong>{name}</Text>,
    dataIndex: `col_${colIdx}`,
    key: `col_${colIdx}`,
    width: 90,
    align: "center" as const,
    render: (val: string, _: any, rowIdx: number) => {
      const isPivot = pivot_row !== null && pivot_col !== null && rowIdx === pivot_row && colIdx === pivot_col;
      const isPivotRow = pivot_row !== null && rowIdx === pivot_row && colIdx !== col_names.length - 1;
      const isPivotCol = pivot_col !== null && colIdx === pivot_col && rowIdx !== tableau.length - 1;

      let bg = "transparent";
      if (isPivot) bg = "#ff7875";
      else if (isPivotRow) bg = "#fff7e6";
      else if (isPivotCol) bg = "#f0f5ff";

      return (
        <div style={{ background: bg, borderRadius: 4, padding: "2px 6px", fontFamily: "monospace" }}>
          {val}
        </div>
      );
    },
  }));

  const rowHeaderCol = {
    title: (
      <Tooltip title="Змінні, що зараз знаходяться в базисі (їхні значення ≠ 0)">
        <span style={{ cursor: "help" }}>
          База <QuestionCircleOutlined style={{ color: "#8c8c8c", fontSize: 11 }} />
        </span>
      </Tooltip>
    ),
    dataIndex: "rowHeader",
    key: "rowHeader",
    width: 60,
    align: "center" as const,
    render: (val: string, _: any, rowIdx: number) => (
      <Text strong style={{ color: rowIdx === tableau.length - 1 ? "#1677ff" : undefined }}>
        {val}
      </Text>
    ),
  };

  const dataSource = tableau.map((row, rowIdx) => {
    const record: Record<string, string> = {
      key: String(rowIdx),
      rowHeader: row_names[rowIdx],
    };
    col_names.forEach((_, colIdx) => {
      record[`col_${colIdx}`] = fmt(row[colIdx]);
    });
    return record;
  });

  return (
    <div style={{ marginBottom: 24 }}>
      {!hideExplanation && (
        <>
          <Tag color={step.description.includes("Оптимальна") ? "success" : step.description.includes("Початкова") ? "default" : "processing"}>
            Крок {stepIndex + 1}: {step.description}
          </Tag>
          <StepExplanation step={step} />
        </>
      )}

      <Table
        columns={[rowHeaderCol, ...columns]}
        dataSource={dataSource}
        pagination={false}
        size="small"
        bordered
        style={{ marginTop: 8 }}
        scroll={{ x: "max-content" }}
      />

      {/* Color legend */}
      <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
        <ColorDot color="#f0f5ff" label="Ведучий стовпець" tip="Змінна, що входить до базису — має найменший (найбільш від'ємний) коефіцієнт у рядку цільової функції" />
        <ColorDot color="#fff7e6" label="Ведучий рядок" tip="Обмеження, яке визначає максимально допустиме збільшення ведучої змінної (мінімальне відношення b/a)" />
        <ColorDot color="#ff7875" label="Елемент зведення" tip="Опорний елемент (pivot) — на нього ділять ведучий рядок і через нього обнуляють стовпець" />
        <ColorDot color="#1677ff" label="Рядок ЦФ" tip="Рядок цільової функції z. Від'ємні значення вказують на можливість покращення розв'язку" />
      </div>
    </div>
  );
};

export default SimplexTable;
