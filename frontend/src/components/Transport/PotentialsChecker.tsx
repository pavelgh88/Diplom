import React, { useState } from "react";
import { Alert, Button, Collapse, InputNumber, Space, Tag, Tooltip, Typography } from "antd";
import { CheckOutlined, EyeOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { checkTransportPotentials, checkTransportEntering } from "../../api/client";
import type { TransportStep } from "../../types";

const { Text } = Typography;

interface Props {
  step: TransportStep;
  costs: number[][];
  supply: number[];
  demand: number[];
  onMistake: () => void;
}

const PotentialsChecker: React.FC<Props> = ({ step, costs, supply, demand, onMistake }) => {
  const m = supply.length;
  const n = demand.length;

  const [studentU, setStudentU] = useState<(number | null)[]>(() => [0, ...Array(m - 1).fill(null)]);
  const [studentV, setStudentV] = useState<(number | null)[]>(Array(n).fill(null));
  const [potResult, setPotResult] = useState<{ valid: boolean; message: string; u?: (number | null)[]; v?: (number | null)[] } | null>(null);
  const [potChecking, setPotChecking] = useState(false);
  const [potRevealed, setPotRevealed] = useState(false);

  const [enterRow, setEnterRow] = useState<number | null>(null);
  const [enterCol, setEnterCol] = useState<number | null>(null);
  const [enterResult, setEnterResult] = useState<{ valid: boolean; message: string; hint?: string } | null>(null);
  const [enterChecking, setEnterChecking] = useState(false);

  const correctU = potResult?.u ?? step.u;
  const correctV = potResult?.v ?? step.v;
  const potsDone = potResult?.valid === true || potRevealed;

  const handleCheckPotentials = async () => {
    setPotChecking(true);
    try {
      const res = await checkTransportPotentials(
        step.basic_cells as number[][],
        costs,
        studentU,
        studentV,
      );
      setPotResult({ valid: res.valid, message: res.message, u: res.u, v: res.v });
      if (!res.valid) onMistake();
    } catch {
      setPotResult({ valid: false, message: "Помилка з'єднання з сервером. Спробуйте ще раз." });
    } finally {
      setPotChecking(false);
    }
  };

  const handleCheckEntering = async () => {
    if (enterRow === null || enterCol === null) return;
    const uToUse = potResult?.u ?? step.u;
    const vToUse = potResult?.v ?? step.v;
    setEnterChecking(true);
    try {
      const res = await checkTransportEntering(
        uToUse as (number | null)[],
        vToUse as (number | null)[],
        costs,
        step.basic_cells as number[][],
        enterRow,
        enterCol,
      );
      setEnterResult({ valid: res.valid, message: res.message, hint: res.hint });
      if (!res.valid) onMistake();
    } catch {
      setEnterResult({ valid: false, message: "Помилка з'єднання з сервером. Спробуйте ще раз." });
    } finally {
      setEnterChecking(false);
    }
  };

  const uValues = potRevealed ? step.u : (potResult?.valid ? potResult.u : studentU);
  const vValues = potRevealed ? step.v : (potResult?.valid ? potResult.v : studentV);

  return (
    <Collapse
      size="small"
      style={{ marginTop: 10, background: "#f0f7ff", border: "1px solid #91caff" }}
      items={[{
        key: "train",
        label: (
          <span style={{ fontSize: 13, fontWeight: 500, color: "#1677ff" }}>
            Тренування: обчисліть потенціали та оберіть вхідну клітинку
          </span>
        ),
        children: (
          <div>
            {/* Potentials input */}
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 12 }}>
                Крок 1: Потенціали u_i, v_j{" "}
                <Tooltip title="Умова для базисних клітинок: c_ij = u_i + v_j. Починайте з u₁ = 0.">
                  <QuestionCircleOutlined style={{ color: "#8c8c8c" }} />
                </Tooltip>
              </Text>
              <div style={{ marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <Text style={{ fontSize: 11, color: "#666" }}>u_i (постачальники):</Text>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    {Array.from({ length: m }, (_, i) => (
                      <div key={i} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "#888" }}>u{i + 1}</div>
                        <InputNumber
                          size="small"
                          style={{ width: 68 }}
                          value={i === 0 ? 0 : studentU[i]}
                          disabled={i === 0 || potsDone}
                          onChange={(v) => setStudentU((prev) => { const a = [...prev]; a[i] = v; return a; })}
                          step={1}
                          controls={false}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Text style={{ fontSize: 11, color: "#666" }}>v_j (споживачі):</Text>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    {Array.from({ length: n }, (_, j) => (
                      <div key={j} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "#888" }}>v{j + 1}</div>
                        <InputNumber
                          size="small"
                          style={{ width: 68 }}
                          value={studentV[j]}
                          disabled={potsDone}
                          onChange={(v) => setStudentV((prev) => { const a = [...prev]; a[j] = v; return a; })}
                          step={1}
                          controls={false}
                          placeholder="?"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <Space style={{ marginTop: 8 }}>
                <Button
                  size="small" type="primary" icon={<CheckOutlined />}
                  loading={potChecking} onClick={handleCheckPotentials}
                  disabled={potsDone}
                >
                  Перевірити потенціали
                </Button>
                <Button
                  size="small" icon={<EyeOutlined />}
                  onClick={() => setPotRevealed(true)} disabled={potsDone}
                >
                  Показати
                </Button>
              </Space>
              {potResult && (
                <Alert type={potResult.valid ? "success" : "error"} message={potResult.message}
                  style={{ marginTop: 6 }} showIcon />
              )}
              {potRevealed && !potResult?.valid && (
                <Alert type="info" message="Правильні потенціали розкриті — продовжуйте." style={{ marginTop: 6 }} showIcon />
              )}
            </div>

            {/* Delta / entering cell */}
            {potsDone && (
              <div>
                <Text strong style={{ fontSize: 12 }}>
                  Крок 2: Виберіть вхідну клітинку{" "}
                  <Tooltip title="Натисніть на небазисну клітинку з найменшим Δ_ij = c_ij − u_i − v_j (найбільш від'ємним значенням).">
                    <QuestionCircleOutlined style={{ color: "#8c8c8c" }} />
                  </Tooltip>
                </Text>
                <div style={{ marginTop: 8, overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={thS}></th>
                        {Array.from({ length: n }, (_, j) => (
                          <th key={j} style={thS}>Спожив. {j + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: m }, (_, i) => (
                        <tr key={i}>
                          <td style={{ ...tdS, fontWeight: 600 }}>Пост. {i + 1}</td>
                          {Array.from({ length: n }, (_, j) => {
                            const isBasic = step.basic_cells.some(([r, c]) => r === i && c === j);
                            const ui = correctU[i] ?? 0;
                            const vj = correctV[j] ?? 0;
                            const delta = isBasic ? null : costs[i][j] - ui - vj;
                            const isSelected = enterRow === i && enterCol === j;
                            return (
                              <td
                                key={j}
                                style={{
                                  ...tdS,
                                  background: isBasic ? "#f5f5f5"
                                    : isSelected ? "#e6f7ff"
                                    : delta !== null && delta < 0 ? "#fff7e6" : undefined,
                                  cursor: isBasic ? "default" : "pointer",
                                  border: isSelected ? "2px solid #1677ff" : "1px solid #d9d9d9",
                                }}
                                onClick={() => {
                                  if (!isBasic && enterResult?.valid !== true) {
                                    setEnterRow(i);
                                    setEnterCol(j);
                                    setEnterResult(null);
                                  }
                                }}
                              >
                                {isBasic ? (
                                  <span style={{ color: "#999", fontSize: 11 }}>базисна</span>
                                ) : (
                                  <span style={{ color: delta !== null && delta < 0 ? "#d46b08" : "#595959" }}>
                                    Δ = {delta !== null ? delta.toFixed(2) : "?"}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Space style={{ marginTop: 8 }}>
                  <Button
                    size="small" type="primary" icon={<CheckOutlined />}
                    loading={enterChecking} onClick={handleCheckEntering}
                    disabled={enterRow === null || enterResult?.valid === true}
                  >
                    Перевірити вибір
                  </Button>
                  {enterRow !== null && enterCol !== null && (
                    <Tag>Обрано: ({enterRow + 1}, {enterCol + 1})</Tag>
                  )}
                </Space>
                {enterResult && (
                  <Alert
                    type={enterResult.valid ? "success" : "error"}
                    message={enterResult.message}
                    description={enterResult.hint}
                    style={{ marginTop: 6 }}
                    showIcon
                  />
                )}
              </div>
            )}
          </div>
        ),
      }]}
    />
  );
};

const thS: React.CSSProperties = { padding: "4px 8px", border: "1px solid #d9d9d9", background: "#fafafa", fontWeight: 600, fontSize: 11 };
const tdS: React.CSSProperties = { padding: "5px 10px", border: "1px solid #d9d9d9", textAlign: "center" };

export default PotentialsChecker;
