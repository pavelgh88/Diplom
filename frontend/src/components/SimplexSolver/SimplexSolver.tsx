import React, { useEffect, useRef, useState } from "react";
import {
  Alert, Button, Card, Collapse, Row, Col, Space,
  Statistic, Switch, Tag, Typography, Spin,
} from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import ProblemInputForm from "../ProblemInputForm";
import type { ProblemInputFormHandle } from "../ProblemInputForm";
import SimplexTable from "./SimplexTable";
import TaskSelector from "../TaskSelector";
import TheoryPanel from "../TheoryPanel";
import { solveSimplex, checkSimplexPivot } from "../../api/client";
import type { LPProblem, SimplexResult, SimplexStep, ValidatorResult } from "../../types";

const { Title, Text } = Typography;

const fmtN = (v: number) => {
  const r = Math.round(v * 10000) / 10000;
  return Number.isInteger(r) ? String(r) : r.toFixed(4).replace(/\.?0+$/, "");
};

// ── Interactive pivot check (two-phase: column → row) ────────────────────────

const PivotCheck: React.FC<{ step: SimplexStep; maximize: boolean; onChecked: () => void }> = ({ step, maximize, onChecked }) => {
  const [phase, setPhase] = useState<"col" | "row" | "done">("col");
  const [colSelected, setColSelected] = useState<number | null>(null);
  const [rowSelected, setRowSelected] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [colResult, setColResult] = useState<ValidatorResult | null>(null);
  const [rowResult, setRowResult] = useState<ValidatorResult | null>(null);

  const { tableau, col_names, row_names } = step;
  const m = tableau.length - 1;
  const lastCol = col_names.length - 1;
  const varCols = col_names.slice(0, lastCol);

  const tableauForValidation = maximize
    ? tableau.map((row, i) => i === m ? row.map((v) => -v) : row)
    : tableau;

  const handleColCheck = async () => {
    if (colSelected === null) return;
    setChecking(true);
    try {
      const res = await checkSimplexPivot({
        tableau: tableauForValidation,
        col_names: step.col_names,
        user_pivot_col: colSelected,
        user_pivot_row: 0,
      });
      setColResult(res);
      if (colSelected === res.correct_col) {
        setPhase("row");
      } else {
        setPhase("done");
        onChecked();
      }
    } catch { /* silent */ } finally {
      setChecking(false);
    }
  };

  const handleRowCheck = async () => {
    if (rowSelected === null || colResult?.correct_col == null) return;
    setChecking(true);
    try {
      const res = await checkSimplexPivot({
        tableau: tableauForValidation,
        col_names: step.col_names,
        user_pivot_col: colResult.correct_col,
        user_pivot_row: rowSelected,
      });
      setRowResult(res);
      setPhase("done");
      onChecked();
    } catch { /* silent */ } finally {
      setChecking(false);
    }
  };

  const colCorrect = colResult !== null && colSelected === colResult.correct_col;
  const rowCorrect = rowResult !== null && rowSelected === rowResult.correct_row;

  const correctCol = colResult?.correct_col ?? null;
  const rowRatios = correctCol !== null
    ? Array.from({ length: m }, (_, i) => {
        const aij = tableau[i][correctCol];
        const bi = tableau[i][lastCol];
        return { rowName: row_names[i], aij, b: bi, theta: aij > 1e-9 ? bi / aij : null };
      })
    : [];

  const borderColor =
    phase === "done" && colCorrect && rowCorrect ? "#52c41a" :
    phase === "done" ? "#ff4d4f" : "#91caff";
  const bg =
    phase === "done" && colCorrect && rowCorrect ? "#f6ffed" :
    phase === "done" ? "#fff1f0" : "#f0f7ff";

  return (
    <div style={{ border: `1.5px dashed ${borderColor}`, borderRadius: 8, padding: "12px 16px", background: bg, marginBottom: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
        🎯 Спробуй сам: оберіть ведучий стовпець та рядок
      </div>

      {/* Phase 1 — column */}
      {phase === "col" && (
        <>
          <div style={{ fontSize: 12, color: "#595959", marginBottom: 8 }}>
            Яку змінну слід ввести в базис? (найменший від'ємний коефіцієнт рядка ЦФ)
          </div>
          <Space wrap style={{ marginBottom: 10 }}>
            {varCols.map((name, idx) => (
              <Button key={idx} size="small"
                type={colSelected === idx ? "primary" : "default"}
                style={{ fontFamily: "monospace" }}
                onClick={() => setColSelected(idx)}
              >
                {name}
              </Button>
            ))}
          </Space>
          <Button size="small" type="primary" disabled={colSelected === null} loading={checking} onClick={handleColCheck}>
            Перевірити стовпець
          </Button>
        </>
      )}

      {/* Phase 2 — row */}
      {phase === "row" && (
        <>
          <div style={{ fontSize: 13, color: "#389e0d", marginBottom: 10 }}>
            ✅ Стовпець <strong style={{ fontFamily: "monospace" }}>{col_names[colSelected!]}</strong> — правильно!
          </div>
          <div style={{ fontSize: 12, color: "#595959", marginBottom: 6 }}>
            Тепер оберіть <strong>ведучий рядок</strong> — мінімальне відношення θ = b / aᵢⱼ (лише для aᵢⱼ &gt; 0):
          </div>
          <table style={{ borderCollapse: "collapse", fontFamily: "monospace", fontSize: 12, marginBottom: 10 }}>
            <thead>
              <tr>
                {["Рядок", "b", "a", "θ = b/a"].map((h) => (
                  <th key={h} style={{ padding: "3px 10px", textAlign: "center", color: "#8c8c8c", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowRatios.map(({ rowName, aij, b, theta }, i) => (
                <tr key={i}>
                  <td style={{ padding: "2px 10px" }}>{rowName}</td>
                  <td style={{ padding: "2px 10px", textAlign: "center" }}>{fmtN(b)}</td>
                  <td style={{ padding: "2px 10px", textAlign: "center", color: theta === null ? "#bbb" : "#000" }}>{fmtN(aij)}</td>
                  <td style={{ padding: "2px 10px", textAlign: "center", color: theta === null ? "#bbb" : "#1677ff" }}>
                    {theta === null ? "— (a≤0)" : fmtN(theta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Space wrap style={{ marginBottom: 10 }}>
            {Array.from({ length: m }, (_, i) => (
              <Button key={i} size="small"
                type={rowSelected === i ? "primary" : "default"}
                disabled={rowRatios[i]?.theta === null}
                style={{ fontFamily: "monospace" }}
                onClick={() => setRowSelected(i)}
              >
                {row_names[i]}
              </Button>
            ))}
          </Space>
          <Button size="small" type="primary" disabled={rowSelected === null} loading={checking} onClick={handleRowCheck}>
            Перевірити рядок
          </Button>
        </>
      )}

      {/* Done — show results */}
      {phase === "done" && colResult && (
        <div style={{ fontSize: 13 }}>
          <div style={{ marginBottom: colResult && rowResult ? 6 : 0 }}>
            {colCorrect ? (
              <span style={{ color: "#389e0d" }}>
                ✅ Стовпець:{" "}
                <Tag color="blue" style={{ fontFamily: "monospace" }}>{col_names[colSelected!]}</Tag>
                — правильно (найменший від'ємний коефіцієнт ЦФ).
              </span>
            ) : (
              <span style={{ color: "#cf1322" }}>
                ❌ Стовпець: обрано <Tag style={{ fontFamily: "monospace" }}>{col_names[colSelected!]}</Tag>,
                правильна відповідь —{" "}
                <Tag color="blue" style={{ fontFamily: "monospace" }}>
                  {colResult.correct_col != null ? col_names[colResult.correct_col] : "?"}
                </Tag>
                {colResult.hint && <div style={{ marginTop: 4, color: "#595959", fontSize: 12 }}>💡 {colResult.hint}</div>}
              </span>
            )}
          </div>
          {rowResult && (
            <div>
              {rowCorrect ? (
                <span style={{ color: "#389e0d" }}>
                  ✅ Рядок:{" "}
                  <Tag color="orange" style={{ fontFamily: "monospace" }}>{row_names[rowSelected!]}</Tag>
                  — правильно (мінімальне θ).
                </span>
              ) : (
                <span style={{ color: "#cf1322" }}>
                  ❌ Рядок: обрано <Tag style={{ fontFamily: "monospace" }}>{row_names[rowSelected!]}</Tag>,
                  правильна відповідь —{" "}
                  <Tag color="orange" style={{ fontFamily: "monospace" }}>
                    {rowResult.correct_row != null ? row_names[rowResult.correct_row] : "?"}
                  </Tag>
                  {rowResult.hint && <div style={{ marginTop: 4, color: "#595959", fontSize: 12 }}>💡 {rowResult.hint}</div>}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Prominent step-by-step view ───────────────────────────────────────────────

interface ProminentProps {
  step: SimplexStep;
  stepIndex: number;
  totalSteps: number;
  maximize: boolean;
  onPrev: () => void;
  onNext: () => void;
}

const ProminentStep: React.FC<ProminentProps> = ({
  step, stepIndex, totalSteps, maximize, onPrev, onNext,
}) => {
  const [checked, setChecked] = useState(false);
  const { tableau, col_names, row_names, pivot_row, pivot_col } = step;
  const m = tableau.length - 1;
  const lastCol = tableau[0].length - 1;

  const isInitial = step.description.toLowerCase().includes("початков");
  const isOptimal = step.description.toLowerCase().includes("оптимальн");

  const currentBasis = row_names.slice(0, m);
  const zValue = tableau[m][lastCol];

  const objCoeffs = col_names.slice(0, lastCol).map((name, j) => ({
    name,
    coeff: tableau[m][j],
  }));

  const negCoeffs = objCoeffs.filter(({ coeff }) => coeff < -1e-9);

  const ratios = (pivot_col !== null)
    ? Array.from({ length: m }, (_, i) => ({
        rowName: row_names[i],
        aij: tableau[i][pivot_col],
        b: tableau[i][lastCol],
        ratio: tableau[i][pivot_col] > 1e-9
          ? tableau[i][lastCol] / tableau[i][pivot_col]
          : null,
      }))
    : [];

  const progress = ((stepIndex + 1) / totalSteps) * 100;

  const blockStyle = (color: string, bg: string): React.CSSProperties => ({
    border: `1px solid ${color}`,
    borderLeft: `4px solid ${color}`,
    background: bg,
    borderRadius: 6,
    padding: "10px 14px",
    marginBottom: 10,
    fontSize: 13,
  });

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Text strong style={{ fontSize: 14 }}>
            Крок {stepIndex + 1} з {totalSteps}
          </Text>
          <Tag color={isOptimal ? "success" : isInitial ? "default" : "processing"} style={{ fontSize: 12 }}>
            {step.description}
          </Tag>
        </div>
        <div style={{ height: 7, background: "#f0f0f0", borderRadius: 4 }}>
          <div style={{
            height: "100%",
            width: `${progress}%`,
            background: isOptimal ? "#52c41a" : "#1677ff",
            borderRadius: 4,
            transition: "width 0.35s ease",
          }} />
        </div>
      </div>

      {/* ── INITIAL STEP ── */}
      {isInitial && (
        <div style={blockStyle("#91caff", "#e6f4ff")}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>📋 Початкова таблиця</div>
          <div>
            До кожного обмеження виду «a₁x₁ + … ≤ b» додається{" "}
            <strong>змінна відхилення sᵢ ≥ 0</strong>, щоб перетворити нерівність на рівність.
          </div>
          <div style={{ marginTop: 6 }}>
            <strong>Початковий базис:</strong>{" "}
            <span style={{ fontFamily: "monospace" }}>{"{ " + currentBasis.join(", ") + " }"}</span>
          </div>
          <div>
            При x = 0 маємо s = b — це <strong>початковий допустимий план</strong>.
          </div>
          <div style={{ marginTop: 6 }}>
            <strong>Поточне значення ЦФ:</strong> z = <strong>{fmtN(zValue)}</strong>
          </div>
        </div>
      )}

      {/* ── ITERATION STEP ── */}
      {!isInitial && !isOptimal && pivot_col !== null && (
        <>
          {/* Current state — always visible */}
          <div style={blockStyle("#d9d9d9", "#fafafa")}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>📋 Поточний стан</div>
            <Row gutter={24}>
              <Col>
                <Text type="secondary" style={{ fontSize: 12 }}>Базис</Text>
                <div style={{ fontFamily: "monospace", fontSize: 13 }}>
                  {"{ " + currentBasis.join(", ") + " }"}
                </div>
              </Col>
              <Col>
                <Text type="secondary" style={{ fontSize: 12 }}>Значення ЦФ</Text>
                <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>
                  z = {fmtN(zValue)}
                </div>
              </Col>
            </Row>
          </div>

          {/* Interactive check — always visible, reveals explanations on submit */}
          <PivotCheck step={step} maximize={maximize} onChecked={() => setChecked(true)} />

          {/* Explanations revealed only after the student has checked */}
          {checked && (
            <>
              {/* Optimality check */}
              <div style={blockStyle("#ffa940", "#fff7e6")}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>🔍 Перевірка оптимальності</div>
                <div style={{ marginBottom: 6 }}>
                  Коефіцієнти рядка ЦФ:{" "}
                  {objCoeffs.map(({ name, coeff }) => (
                    <Tag
                      key={name}
                      color={coeff < -1e-9 ? "orange" : "default"}
                      style={{ fontFamily: "monospace", fontSize: 11, marginBottom: 3 }}
                    >
                      {name} = {fmtN(coeff)}
                    </Tag>
                  ))}
                </div>
                {negCoeffs.length > 0 ? (
                  <div>
                    ❌ Є від'ємні коефіцієнти:{" "}
                    {negCoeffs.map(({ name }) => <strong key={name}>{name} </strong>)} —{" "}
                    план <strong>не оптимальний</strong>, продовжуємо.
                  </div>
                ) : (
                  <div>✅ Всі коефіцієнти ≥ 0 — план <strong>оптимальний</strong>.</div>
                )}
              </div>

              {/* Pivot column */}
              <div style={blockStyle("#91caff", "#e6f4ff")}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>⚡ Вибір ведучого стовпця</div>
                <div>
                  Обираємо стовпець з <strong>найменшим (найбільш від'ємним)</strong> коефіцієнтом рядка ЦФ.
                </div>
                <div style={{ marginTop: 6 }}>
                  Ведучий стовпець:{" "}
                  <Tag color="blue" style={{ fontFamily: "monospace", fontSize: 13 }}>
                    {col_names[pivot_col]}
                  </Tag>
                  із коефіцієнтом{" "}
                  <strong style={{ color: "#d4380d", fontFamily: "monospace" }}>
                    {fmtN(tableau[m][pivot_col])}
                  </strong>
                  {" "}— найбільший можливий виграш при збільшенні цієї змінної.
                </div>
              </div>

              {/* Pivot row — min ratio test */}
              {pivot_row !== null && (
                <div style={blockStyle("#ffd591", "#fffbe6")}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    📐 Вибір ведучого рядка — правило мінімального відношення
                  </div>
                  <div style={{ marginBottom: 8, fontSize: 12 }}>
                    Для кожного рядка де a<sub>ij</sub> &gt; 0 рахуємо відношення b / a<sub>ij</sub>.
                    Обираємо <strong>мінімальне</strong> — воно показує, наскільки можна збільшити
                    ведучу змінну перш ніж порушимо допустимість.
                  </div>
                  <table style={{ borderCollapse: "collapse", fontFamily: "monospace", fontSize: 12, width: "100%" }}>
                    <thead>
                      <tr style={{ background: "#fff3cd" }}>
                        <th style={{ padding: "4px 10px", textAlign: "left", borderBottom: "1px solid #ffe58f" }}>Рядок</th>
                        <th style={{ padding: "4px 10px", textAlign: "center", borderBottom: "1px solid #ffe58f" }}>b</th>
                        <th style={{ padding: "4px 10px", textAlign: "center", borderBottom: "1px solid #ffe58f" }}>
                          a<sub>{col_names[pivot_col]}</sub>
                        </th>
                        <th style={{ padding: "4px 10px", textAlign: "center", borderBottom: "1px solid #ffe58f" }}>b / a</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ratios.map(({ rowName, aij, b, ratio }, i) => {
                        const isChosen = i === pivot_row;
                        const invalid = ratio === null;
                        return (
                          <tr key={i} style={{
                            background: isChosen ? "#fffbe6" : "transparent",
                            fontWeight: isChosen ? 700 : 400,
                          }}>
                            <td style={{ padding: "3px 10px" }}>
                              {rowName}
                              {isChosen && (
                                <Tag color="gold" style={{ marginLeft: 6, fontSize: 10 }}>← мінімум</Tag>
                              )}
                            </td>
                            <td style={{ padding: "3px 10px", textAlign: "center" }}>{fmtN(b)}</td>
                            <td style={{ padding: "3px 10px", textAlign: "center", color: invalid ? "#bbb" : "#000" }}>
                              {fmtN(aij)}
                            </td>
                            <td style={{ padding: "3px 10px", textAlign: "center", color: invalid ? "#bbb" : isChosen ? "#d4380d" : "#000" }}>
                              {invalid ? "— (a≤0)" : fmtN(ratio!)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    🔄 Ведучий рядок:{" "}
                    <Tag color="orange" style={{ fontFamily: "monospace" }}>{row_names[pivot_row]}</Tag>
                    Елемент зведення:{" "}
                    <strong style={{ fontFamily: "monospace" }}>
                      a = {fmtN(tableau[pivot_row][pivot_col])}
                    </strong>
                    <br />
                    <strong style={{ color: "#1677ff" }}>«{col_names[pivot_col]}»</strong>{" "}
                    входить до базису замість{" "}
                    <strong style={{ color: "#d4380d" }}>«{row_names[pivot_row]}»</strong>.
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── OPTIMAL STEP ── */}
      {isOptimal && (
        <div style={blockStyle("#95de64", "#f6ffed")}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>✅ Умова оптимальності виконана</div>
          <div>
            Всі коефіцієнти рядка ЦФ ≥ 0 — жодна небазисна змінна не може зменшити значення z.
          </div>
          <div style={{ marginTop: 6 }}>
            <strong>Оптимальний базис:</strong>{" "}
            <span style={{ fontFamily: "monospace" }}>{"{ " + currentBasis.join(", ") + " }"}</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 14 }}>
            <strong>Оптимальне значення ЦФ: z = {fmtN(Math.abs(zValue))}</strong>
          </div>
        </div>
      )}

      {/* Simplex table (no built-in explanation — we show our own above) */}
      <SimplexTable step={step} stepIndex={stepIndex} hideExplanation />

      {/* Navigation */}
      <div style={{
        display: "flex", gap: 10, marginTop: 18,
        justifyContent: "center", alignItems: "center",
      }}>
        <Button icon={<LeftOutlined />} onClick={onPrev} disabled={stepIndex === 0}>
          Попередній
        </Button>
        <Text type="secondary" style={{ minWidth: 70, textAlign: "center", fontSize: 13 }}>
          {stepIndex + 1} / {totalSteps}
        </Text>
        {stepIndex < totalSteps - 1 ? (
          <Button type="primary" icon={<RightOutlined />} iconPosition="end" onClick={onNext}>
            Наступний крок
          </Button>
        ) : (
          <Button
            style={{ background: "#52c41a", borderColor: "#52c41a", color: "#fff" }}
            disabled
          >
            ✓ Завершено
          </Button>
        )}
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const SimplexSolver: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimplexResult | null>(null);
  const [stepByStep, setStepByStep] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isMaximize, setIsMaximize] = useState(false);
  const formRef = useRef<ProblemInputFormHandle | null>(null);

  useEffect(() => {
    setCurrentStep(0);
  }, [result]);

  const handleSolve = async (problem: LPProblem) => {
    setIsMaximize(problem.maximize);
    setLoading(true);
    setResult(null);
    try {
      const res = await solveSimplex(problem);
      setResult(res);
    } catch (e: any) {
      setResult({ status: "error", error: e?.response?.data?.error ?? e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadTask = (problem: object) => {
    formRef.current?.loadProblem(problem as LPProblem);
  };

  const steps = result?.steps ?? [];
  const totalSteps = steps.length;

  return (
    <div>
      <Title level={4} style={{ margin: "0 0 2px" }}>Симплекс-метод</Title>
      <Text type="secondary" style={{ display: "block", fontSize: 13, marginBottom: 14 }}>
        Розв'язує задачу лінійного програмування покроково із відображенням симплекс-таблиці на кожній ітерації.
      </Text>

      <TheoryPanel>
        <p style={{ marginBottom: 6 }}><strong>Математична модель (стандартна форма):</strong></p>
        <p style={{ fontFamily: "monospace", background: "#f5f5f5", padding: "6px 10px", borderRadius: 4, marginBottom: 10 }}>
          z = c<sub>1</sub>x<sub>1</sub> + c<sub>2</sub>x<sub>2</sub> + … + c<sub>n</sub>x<sub>n</sub> → min (або max)<br />
          a<sub>i1</sub>x<sub>1</sub> + … + a<sub>in</sub>x<sub>n</sub> ≤ b<sub>i</sub>,{"  "}i = 1..m<br />
          x<sub>j</sub> ≥ 0,{"  "}j = 1..n
        </p>
        <p style={{ marginBottom: 6 }}><strong>Алгоритм:</strong></p>
        <ol style={{ paddingLeft: 18, marginBottom: 10 }}>
          <li>Ввести змінні відхилення s<sub>i</sub> ≥ 0 → стандартна форма Ax = b</li>
          <li>Побудувати початкову симплекс-таблицю з базисом {"{s₁…sₘ}"}</li>
          <li>Вибрати <strong>ведучий стовпець</strong> j* — найменший коефіцієнт цільової функції</li>
          <li>Вибрати <strong>ведучий рядок</strong> i* = argmin{"{"} b<sub>i</sub> / a<sub>ij</sub> : a<sub>ij</sub> &gt; 0 {"}"}</li>
          <li>Виконати крок жорданового виключення (pivot) навколо a<sub>i*j*</sub></li>
          <li>Повторити з кроку 3</li>
        </ol>
        <p>
          <strong>Умова оптимальності:</strong> всі коефіцієнти рядка цільової функції ≥ 0 (min) або ≤ 0 (max).
        </p>
      </TheoryPanel>

      <TaskSelector taskType="simplex" onLoad={handleLoadTask} />

      <Card size="small" style={{ marginTop: 0 }}>
        <ProblemInputForm ref={formRef} onSolve={handleSolve} loading={loading} />
      </Card>

      {loading && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Spin size="large" tip="Розв'язую..." />
        </div>
      )}

      {result && !loading && (
        <div style={{ marginTop: 14 }}>
          {result.error ? (
            <Alert type="error" message="Помилка" description={result.error} showIcon />
          ) : (
            <>
              <Card>
                <Row gutter={32}>
                  <Col>
                    <Statistic
                      title="Оптимальне значення"
                      value={result.optimal_value?.toFixed(4)}
                      valueStyle={{ color: "#1677ff", fontSize: 28 }}
                    />
                  </Col>
                  <Col>
                    <Statistic title="Ітерацій" value={result.num_iterations} />
                  </Col>
                  <Col>
                    <div>
                      <Text type="secondary">Розв'язок</Text>
                      <div style={{ marginTop: 4 }}>
                        {result.solution?.map((v, i) => (
                          <Text key={i} style={{ marginRight: 12 }}>
                            x<sub>{i + 1}</sub> = <strong>{Math.round(v * 10000) / 10000}</strong>
                          </Text>
                        ))}
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card>

              {/* Mode toggle */}
              <Row align="middle" style={{ marginTop: 16, marginBottom: 10 }} gutter={12}>
                <Col>
                  <Title level={5} style={{ margin: 0 }}>Покрокове розв'язання</Title>
                </Col>
                <Col>
                  <Space size={8}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Режим навчання:</Text>
                    <Switch
                      size="small"
                      checked={stepByStep}
                      onChange={(v) => { setStepByStep(v); setCurrentStep(0); }}
                      checkedChildren="крок за кроком"
                      unCheckedChildren="всі кроки"
                    />
                  </Space>
                </Col>
              </Row>

              {/* Step-by-step mode */}
              {stepByStep ? (
                <Card style={{ marginTop: 0 }}>
                  <ProminentStep
                    key={currentStep}
                    step={steps[currentStep]}
                    stepIndex={currentStep}
                    totalSteps={totalSteps}
                    maximize={isMaximize}
                    onPrev={() => setCurrentStep((c) => Math.max(c - 1, 0))}
                    onNext={() => setCurrentStep((c) => Math.min(c + 1, totalSteps - 1))}
                  />
                </Card>
              ) : (
                /* Normal mode — all steps in Collapse */
                <Collapse
                  defaultActiveKey={["0"]}
                  items={steps.map((step, idx) => ({
                    key: String(idx),
                    label: (
                      <Space>
                        <Tag color={
                          step.description.includes("Оптимальн") ? "success" :
                          step.description.includes("Початков") ? "default" : "processing"
                        }>
                          Крок {idx + 1}
                        </Tag>
                        {step.description}
                      </Space>
                    ),
                    children: <SimplexTable step={step} stepIndex={idx} />,
                  }))}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SimplexSolver;
