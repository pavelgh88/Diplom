import React from "react";
import { Table, Tag, Typography } from "antd";
import type { SimplexStep } from "../../types";

const { Text } = Typography;

interface Props {
  step: SimplexStep;
  stepIndex: number;
}

const fmt = (v: number) => {
  const r = Math.round(v * 10000) / 10000;
  return Number.isInteger(r) ? String(r) : r.toFixed(4).replace(/\.?0+$/, "");
};

const SimplexTable: React.FC<Props> = ({ step, stepIndex }) => {
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

  // Prepend row-header column
  const rowHeaderCol = {
    title: <Text strong>База</Text>,
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
      <Tag color={step.description.includes("Оптимальна") ? "success" : step.description.includes("Початкова") ? "default" : "processing"}>
        Крок {stepIndex + 1}: {step.description}
      </Tag>
      {pivot_row !== null && pivot_col !== null && (
        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
          Піvот: рядок {pivot_row + 1}, стовпець "{col_names[pivot_col]}"
        </Text>
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
    </div>
  );
};

export default SimplexTable;
