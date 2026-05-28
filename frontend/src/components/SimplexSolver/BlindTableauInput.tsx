import React, { useState } from "react";
import { Alert, Button, InputNumber, Space, Tag, Typography } from "antd";
import { CheckOutlined, EyeOutlined } from "@ant-design/icons";
import { checkSimplexTableau } from "../../api/client";
import type { SimplexStep, TableauCellError } from "../../types";

const { Text } = Typography;

interface Props {
  prevStep: SimplexStep;
  pivotCol: number;
  pivotRow: number;
  maximize: boolean;
  onConfirmed: () => void;
  onMistake: () => void;
}

const BlindTableauInput: React.FC<Props> = ({
  prevStep, pivotCol, pivotRow, maximize, onConfirmed, onMistake,
}) => {
  const { tableau: prevT, col_names, row_names } = prevStep;
  const m = prevT.length - 1;
  const cols = col_names.length;

  // New basis: pivot variable replaces leaving variable in pivot row
  const newRowNames = row_names.map((name, r) =>
    r === pivotRow ? col_names[pivotCol] : name
  );

  const [cells, setCells] = useState<(number | null)[][]>(
    () => Array.from({ length: m + 1 }, () => Array(cols).fill(null))
  );
  const [cellErrors, setCellErrors] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const setCell = (r: number, c: number, val: number | null) => {
    setCells((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = val;
      return next;
    });
    setCellErrors((prev) => {
      const s = new Set(prev);
      s.delete(`${r},${c}`);
      return s;
    });
  };

  const handleCheck = async () => {
    const studentTableau = cells.map((row) => row.map((v) => v ?? 0));
    setChecking(true);
    try {
      const res = await checkSimplexTableau(
        maximize
          ? prevT.map((row, i) => i === m ? row.map((v) => -v) : row)
          : prevT,
        pivotCol, pivotRow,
        studentTableau,
      );
      const newErrors = new Set<string>(
        res.errors.map((e: TableauCellError) => `${e.row},${e.col}`)
      );
      setCellErrors(newErrors);
      setResult({ valid: res.valid, message: res.message });
      if (!res.valid) onMistake();
      else onConfirmed();
    } finally {
      setChecking(false);
    }
  };

  const pivotEl = prevT[pivotRow][pivotCol];

  return (
    <div style={{ marginBottom: 24 }}>
      <Tag color="warning" style={{ marginBottom: 8 }}>
        Режим навчання: обчисліть наступну таблицю вручну
      </Tag>
      <div style={{ fontSize: 12, color: "#595959", marginBottom: 10 }}>
        Елемент зведення: рядок <strong>{row_names[pivotRow]}</strong>, стовпець{" "}
        <strong>{col_names[pivotCol]}</strong>, значення = <strong>{pivotEl.toFixed(4)}</strong>.
        Введіть усі значення нової таблиці.
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={thStyle}>База</th>
              {col_names.map((name, ci) => (
                <th key={ci} style={{ ...thStyle, background: ci === pivotCol ? "#f0f5ff" : undefined }}>
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: m + 1 }, (_, ri) => (
              <tr key={ri}>
                <td style={{ ...tdStyle, fontWeight: 600, color: ri === m ? "#1677ff" : undefined }}>
                  {newRowNames[ri]}
                </td>
                {Array.from({ length: cols }, (_, ci) => {
                  const hasErr = cellErrors.has(`${ri},${ci}`);
                  return (
                    <td key={ci} style={{
                      ...tdStyle,
                      background: hasErr ? "#fff1f0" : ri === pivotRow ? "#fff7e6" : ci === pivotCol ? "#f0f5ff" : undefined,
                      border: hasErr ? "1px solid #ff4d4f" : "1px solid #d9d9d9",
                    }}>
                      <InputNumber
                        size="small"
                        style={{ width: 72, fontSize: 12 }}
                        value={cells[ri][ci]}
                        onChange={(v) => setCell(ri, ci, v)}
                        step={0.0001}
                        precision={4}
                        controls={false}
                        disabled={revealed}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Space style={{ marginTop: 10 }}>
        <Button
          type="primary"
          icon={<CheckOutlined />}
          loading={checking}
          onClick={handleCheck}
          disabled={revealed || result?.valid === true}
        >
          Перевірити таблицю
        </Button>
        <Button
          icon={<EyeOutlined />}
          onClick={() => setRevealed(true)}
          disabled={revealed}
        >
          Показати відповідь
        </Button>
      </Space>

      {result && (
        <Alert
          type={result.valid ? "success" : "error"}
          message={result.message}
          style={{ marginTop: 8 }}
          showIcon
        />
      )}

      {revealed && (
        <Alert
          type="info"
          message="Відповідь розкрита — перейдіть до наступного кроку"
          style={{ marginTop: 8 }}
          showIcon
        />
      )}
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: "4px 8px", border: "1px solid #d9d9d9",
  background: "#fafafa", fontWeight: 600,
};
const tdStyle: React.CSSProperties = {
  padding: "3px 4px", border: "1px solid #d9d9d9", textAlign: "center",
};

export default BlindTableauInput;
