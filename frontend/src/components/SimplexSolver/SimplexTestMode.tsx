import React, { useMemo, useRef, useState } from "react";
import {
  Alert, Button, Card, Col, InputNumber, Radio, Row, Space, Statistic, Tag, Typography, Spin,
} from "antd";
import { CheckOutlined, ReloadOutlined, BulbOutlined, ArrowLeftOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { solveSimplex, generateTask } from "../../api/client";
import type { LPProblem, SimplexStep, SimplexResult } from "../../types";

const { Title, Text } = Typography;

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const r = Math.round(v * 10000) / 10000;
  return Number.isInteger(r) ? String(r) : r.toFixed(4).replace(/\.?0+$/, "");
};
const eq = (a: number | null | undefined, b: number, tol = 1e-3) =>
  a !== null && a !== undefined && !Number.isNaN(a) && Math.abs(a - b) < tol;

type TestKind = "training" | "control";
type QType = "optimality_iter" | "entering" | "leaving" | "optimality_final" | "objective" | "solution";

interface QPlan {
  type: QType;
  stepIdx: number;       // index into result.steps (or -1 for final-only)
}

type LoadedResult = SimplexResult & { steps: SimplexStep[]; solution: number[]; optimal_value: number };

interface Answers {
  optimality_iter?: boolean | null;
  entering?: number | null;
  leaving?: number | null;
  optimality_final?: boolean | null;
  objective?: number | null;
  solution?: (number | null)[];
}

const Q_TITLES: Record<QType, string> = {
  optimality_iter:  "Чи поточний план оптимальний?",
  entering:         "Який ведучий стовпець (змінна входить у базис)?",
  leaving:          "Симплексні відношення θ і ведучий рядок",
  optimality_final: "Чи остання таблиця оптимальна?",
  objective:        "Оптимальне значення цільової функції F*",
  solution:         "Оптимальний розв'язок (значення змінних)",
};

const Q_HINTS = (maximize: boolean): Record<QType, string> => ({
  optimality_iter:  `План оптимальний ⟺ у рядку оцінок немає ${maximize ? "додатних" : "від'ємних"} коефіцієнтів.`,
  entering:         `Ведучий стовпець — змінна з ${maximize ? "найбільшим додатним" : "найменшим (найбільш від'ємним)"} коефіцієнтом у рядку цільової функції.`,
  leaving:          "θᵢ = RHSᵢ / aᵢⱼ лише для aᵢⱼ > 0. Ведучий рядок — з найменшим θ. Рядки з aᵢⱼ ≤ 0 не беруть участі.",
  optimality_final: `Остання таблиця оптимальна, якщо у рядку оцінок немає ${maximize ? "додатних" : "від'ємних"} коефіцієнтів.`,
  objective:        "F* зчитується з кінцевої таблиці (значення в куті рядка z) або обчислюється підстановкою оптимального розв'язку.",
  solution:         "Значення базисних змінних — у стовпці RHS відповідних рядків; небазисні змінні дорівнюють 0.",
});

const SimplexTestMode: React.FC = () => {
  const [kind, setKind] = useState<TestKind>("training");
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<LPProblem | null>(null);
  const [res, setRes] = useState<LoadedResult | null>(null);
  const [plan, setPlan] = useState<QPlan[]>([]);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers[]>([]);
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [correctness, setCorrectness] = useState<Record<number, boolean>>({});
  const [showHint, setShowHint] = useState<Record<number, boolean>>({});
  const startedAtRef = useRef<number>(0);
  const [durationSec, setDurationSec] = useState<number>(0);

  const maximize = problem?.maximize ?? false;
  const currentQ = plan[idx];
  const currentStep = useMemo(() => {
    if (!res || !currentQ || currentQ.stepIdx < 0) return null;
    return res.steps[currentQ.stepIdx] ?? null;
  }, [res, currentQ]);

  const buildPlan = (r: LoadedResult): QPlan[] => {
    const pl: QPlan[] = [];
    // Iteration steps = those with a pivot. Limit to first 2 to keep the test ~6-8 questions.
    const iterIdx: number[] = [];
    r.steps.forEach((s, i) => { if (s.pivot_col !== null && s.pivot_row !== null) iterIdx.push(i); });
    const useIters = iterIdx.slice(0, 2);
    useIters.forEach((si, k) => {
      if (k === 0) pl.push({ type: "optimality_iter", stepIdx: si });
      pl.push({ type: "entering", stepIdx: si });
      pl.push({ type: "leaving", stepIdx: si });
    });
    // Final optimal step (pivot_col === null), usually the last one.
    const optIdx = r.steps.findIndex((s) => s.pivot_col === null && s.description.toLowerCase().includes("оптим"));
    const finalStepIdx = optIdx >= 0 ? optIdx : r.steps.length - 1;
    pl.push({ type: "optimality_final", stepIdx: finalStepIdx });
    pl.push({ type: "solution", stepIdx: finalStepIdx });
    pl.push({ type: "objective", stepIdx: finalStepIdx });
    return pl;
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      let prob: LPProblem | null = null;
      let loaded: LoadedResult | null = null;
      // Generate up to 8 problems; want at least 1 iteration (non-trivial pivot) for interesting questions.
      for (let attempt = 0; attempt < 8; attempt++) {
        const gen = await generateTask("simplex", 2, 3);
        prob = gen.problem as LPProblem;
        const r = await solveSimplex(prob);
        if (r.status !== "optimal" || !r.steps || r.solution === undefined || r.optimal_value === undefined) continue;
        const lr = r as LoadedResult;
        const iterCount = lr.steps.filter((s) => s.pivot_col !== null).length;
        loaded = lr;
        if (iterCount >= 1) break;
      }
      if (!prob || !loaded) return;
      const newPlan = buildPlan(loaded);
      setProblem(prob);
      setRes(loaded);
      setPlan(newPlan);
      setAnswers(newPlan.map(() => ({})));
      setSubmitted({});
      setCorrectness({});
      setShowHint({});
      setIdx(0);
      setFinished(false);
      setStarted(true);
      startedAtRef.current = Date.now();
    } finally {
      setLoading(false);
    }
  };

  const setAns = (patch: Partial<Answers>) => {
    setAnswers((prev) => prev.map((a, k) => (k === idx ? { ...a, ...patch } : a)));
  };

  // Compute θ ratios for a step's pivot column
  const ratiosFor = (step: SimplexStep): { row: number; aij: number; rhs: number; theta: number | null }[] => {
    if (step.pivot_col === null) return [];
    const m = step.tableau.length - 1;
    const lastCol = step.col_names.length - 1;
    return Array.from({ length: m }, (_, i) => {
      const aij = step.tableau[i][step.pivot_col!];
      const rhs = step.tableau[i][lastCol];
      return { row: i, aij, rhs, theta: aij > 1e-9 ? rhs / aij : null };
    });
  };

  const checkCurrent = (): boolean => {
    if (!res || !currentQ) return false;
    const a = answers[idx];
    const step = currentStep;

    if (currentQ.type === "optimality_iter") {
      // This is an iteration step → NOT optimal.
      return a.optimality_iter === false;
    }
    if (currentQ.type === "optimality_final") {
      // Final optimal step.
      return a.optimality_final === true;
    }
    if (currentQ.type === "entering") {
      if (!step || step.pivot_col === null) return false;
      return a.entering === step.pivot_col;
    }
    if (currentQ.type === "leaving") {
      if (!step || step.pivot_row === null) return false;
      return a.leaving === step.pivot_row;
    }
    if (currentQ.type === "objective") {
      return eq(a.objective, res.optimal_value);
    }
    if (currentQ.type === "solution") {
      const sol = res.solution;
      if (!a.solution || a.solution.length !== sol.length) return false;
      return sol.every((v, i) => eq(a.solution![i], v));
    }
    return false;
  };

  const handleSubmit = () => {
    const ok = checkCurrent();
    setSubmitted((s) => ({ ...s, [idx]: true }));
    setCorrectness((c) => ({ ...c, [idx]: ok }));
  };
  const handleNext = () => {
    if (idx + 1 < plan.length) setIdx(idx + 1);
    else { setDurationSec(Math.round((Date.now() - startedAtRef.current) / 1000)); setFinished(true); }
  };
  const handlePrev = () => { if (idx > 0) setIdx(idx - 1); };

  // ── Setup screen ─────────────────────────────────────────────────────────
  if (!started) {
    return (
      <Card>
        <Title level={5} style={{ marginTop: 0 }}>🧪 Тестовий режим — симплекс-метод</Title>
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          Випадкова задача ЛП розгортається в серію питань уздовж ітерацій:
          оптимальність → ведучий стовпець → θ і ведучий рядок → … → розв'язок і F*.
        </Text>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div>
            <Text strong style={{ display: "block", marginBottom: 4 }}>Режим перевірки:</Text>
            <Radio.Group value={kind} onChange={(e) => setKind(e.target.value)}>
              <Radio value="training"><strong>Тренувальний</strong> — миттєвий фідбек</Radio>
              <Radio value="control"><strong>Контрольний</strong> — бал у кінці</Radio>
            </Radio.Group>
          </div>
          <Button type="primary" icon={<CheckOutlined />} onClick={handleStart} loading={loading} size="large">
            Розпочати тест
          </Button>
        </Space>
      </Card>
    );
  }

  if (loading || !res || !problem) {
    return <Card><Spin tip="Генерую задачу..." /></Card>;
  }

  // ── Summary screen ───────────────────────────────────────────────────────
  if (finished) {
    const correctCount = Object.values(correctness).filter(Boolean).length;
    const total = plan.length;
    const percent = Math.round((correctCount / total) * 100);
    const hints = Q_HINTS(maximize);
    return (
      <Card>
        <Title level={4} style={{ marginTop: 0 }}>📊 Результати тесту</Title>
        <Row gutter={32} style={{ marginBottom: 16 }}>
          <Col>
            <Statistic title="Правильних відповідей" value={`${correctCount} / ${total}`}
              valueStyle={{ color: percent >= 70 ? "#52c41a" : percent >= 40 ? "#fa8c16" : "#cf1322", fontSize: 28 }} />
          </Col>
          <Col><Statistic title="Бал" value={`${percent}%`} valueStyle={{ fontSize: 28 }} /></Col>
          <Col><Statistic title="Час" value={`${Math.floor(durationSec/60)}:${String(durationSec%60).padStart(2,"0")}`} valueStyle={{ fontSize: 28 }} /></Col>
          <Col><Statistic title="Режим" value={kind === "training" ? "Тренувальний" : "Контрольний"} valueStyle={{ fontSize: 18 }} /></Col>
        </Row>
        <Text strong style={{ display: "block", marginBottom: 8 }}>Деталі:</Text>
        <Space direction="vertical" size={6} style={{ width: "100%", marginBottom: 16 }}>
          {plan.map((q, k) => (
            <div key={k} style={{
              padding: "8px 12px",
              border: `1px solid ${correctness[k] ? "#b7eb8f" : "#ffccc7"}`,
              background: correctness[k] ? "#f6ffed" : "#fff1f0",
              borderRadius: 6, fontSize: 13,
            }}>
              {correctness[k] ? "✅" : "❌"} <strong>{k + 1}. {Q_TITLES[q.type]}</strong>
              {!correctness[k] && (
                <div style={{ marginTop: 4, color: "#595959", fontSize: 12 }}><BulbOutlined /> {hints[q.type]}</div>
              )}
            </div>
          ))}
        </Space>
        <Space>
          <Button type="primary" icon={<ReloadOutlined />} onClick={handleStart} loading={loading}>
            Нова спроба (інша задача)
          </Button>
          <Button onClick={() => { setStarted(false); setFinished(false); }}>До налаштувань</Button>
        </Space>
      </Card>
    );
  }

  // ── Question screen ──────────────────────────────────────────────────────
  const q = currentQ;
  if (!q) return null;
  const isSubmitted = !!submitted[idx];
  const isCorrect = correctness[idx];
  const a = answers[idx] ?? {};
  const hints = Q_HINTS(maximize);
  const disabled = isSubmitted && kind === "training";

  return (
    <Card>
      <Row align="middle" justify="space-between" style={{ marginBottom: 14 }}>
        <Col>
          <Title level={5} style={{ margin: 0 }}>Питання {idx + 1} з {plan.length}: {Q_TITLES[q.type]}</Title>
          <div style={{ height: 6, background: "#f0f0f0", borderRadius: 3, marginTop: 6, width: 360 }}>
            <div style={{ height: "100%", width: `${((idx+1)/plan.length)*100}%`, background: "#1677ff", borderRadius: 3 }} />
          </div>
        </Col>
        <Col>
          <Space>
            <Tag color={kind === "training" ? "blue" : "purple"}>{kind === "training" ? "Тренувальний" : "Контрольний"}</Tag>
            <Tag color={maximize ? "orange" : "geekblue"}>{maximize ? "max" : "min"}</Tag>
            <Button size="small" icon={<BulbOutlined />} onClick={() => setShowHint((h) => ({ ...h, [idx]: !h[idx] }))}>
              {showHint[idx] ? "Сховати формулу" : "Показати формулу"}
            </Button>
          </Space>
        </Col>
      </Row>

      {showHint[idx] && (
        <Alert type="info" showIcon style={{ marginBottom: 10 }} message={<><strong>Підказка:</strong> {hints[q.type]}</>} />
      )}

      <ProblemRecap problem={problem} />

      {/* Current tableau (the table the student reasons over) */}
      {currentStep && (
        <TableauView step={currentStep} highlightCol={q.type === "leaving" ? currentStep.pivot_col : null} />
      )}

      <div style={{ marginTop: 14 }}>
        {q.type === "optimality_iter" && (
          <OptimalityInput value={a.optimality_iter ?? null} onChange={(v) => setAns({ optimality_iter: v })} disabled={disabled} maximize={maximize} />
        )}
        {q.type === "optimality_final" && (
          <OptimalityInput value={a.optimality_final ?? null} onChange={(v) => setAns({ optimality_final: v })} disabled={disabled} maximize={maximize} />
        )}
        {q.type === "entering" && currentStep && (
          <EnteringInput step={currentStep} value={a.entering ?? null} onChange={(v) => setAns({ entering: v })} disabled={disabled} />
        )}
        {q.type === "leaving" && currentStep && (
          <LeavingInput step={currentStep} ratios={ratiosFor(currentStep)} value={a.leaving ?? null} onChange={(v) => setAns({ leaving: v })} disabled={disabled} />
        )}
        {q.type === "objective" && (
          <ObjectiveInput value={a.objective ?? null} onChange={(v) => setAns({ objective: v })} disabled={disabled} />
        )}
        {q.type === "solution" && (
          <SolutionInput numVars={res.solution.length} value={a.solution ?? Array(res.solution.length).fill(null)} onChange={(v) => setAns({ solution: v })} disabled={disabled} />
        )}
      </div>

      {kind === "training" && isSubmitted && (
        <Alert
          type={isCorrect ? "success" : "error"}
          showIcon
          style={{ marginTop: 12 }}
          message={isCorrect ? "Правильно ✓" : "Неправильно ✗"}
          description={!isCorrect ? <CorrectReveal q={q} step={currentStep} res={res} ratios={currentStep ? ratiosFor(currentStep) : []} /> : undefined}
        />
      )}

      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
        <Button icon={<ArrowLeftOutlined />} onClick={handlePrev} disabled={idx === 0}>Назад</Button>
        <Space>
          {!isSubmitted ? (
            <Button type="primary" icon={<CheckOutlined />} onClick={handleSubmit}>
              {kind === "training" ? "Перевірити" : "Записати відповідь"}
            </Button>
          ) : (
            <Button type="primary" icon={<ArrowRightOutlined />} iconPosition="end" onClick={handleNext}>
              {idx + 1 < plan.length ? "Наступне питання" : "Завершити тест"}
            </Button>
          )}
        </Space>
      </div>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────

const ProblemRecap: React.FC<{ problem: LPProblem }> = ({ problem }) => (
  <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 10 }}>
    <Text strong style={{ fontSize: 12 }}>Задача:</Text>{" "}
    <span style={{ fontFamily: "monospace" }}>
      {problem.maximize ? "max" : "min"}{" "}
      {problem.c.map((c, i) => `${c >= 0 && i > 0 ? "+" : ""}${c}·x${i+1}`).join(" ")}
      {" "}s.t.{" "}
      {problem.A.map((row, i) => (
        <span key={i}>
          {row.map((aa, j) => `${aa >= 0 && j > 0 ? "+" : ""}${aa}·x${j+1}`).join(" ")} ≤ {problem.b[i]}
          {i < problem.A.length - 1 ? "; " : ""}
        </span>
      ))}
      {", xⱼ ≥ 0"}
    </span>
  </div>
);

const tdS: React.CSSProperties = { padding: "3px 9px", border: "1px solid #e8e8e8", textAlign: "center", fontFamily: "monospace", fontSize: 12 };

const TableauView: React.FC<{ step: SimplexStep; highlightCol: number | null }> = ({ step, highlightCol }) => {
  const m = step.tableau.length - 1;
  return (
    <div style={{ overflowX: "auto", marginBottom: 4 }}>
      <table style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...tdS, background: "#fafafa", color: "#8c8c8c" }}>База</th>
            {step.col_names.map((name, j) => (
              <th key={j} style={{ ...tdS, background: highlightCol === j ? "#e6f4ff" : "#fafafa" }}>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {step.tableau.map((row, i) => (
            <tr key={i}>
              <td style={{ ...tdS, background: "#fafafa", fontWeight: 700, color: i === m ? "#1677ff" : undefined }}>
                {step.row_names[i]}
              </td>
              {row.map((val, j) => (
                <td key={j} style={{ ...tdS, background: highlightCol === j && i !== m ? "#e6f4ff" : "transparent" }}>
                  {fmt(val)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const OptimalityInput: React.FC<{ value: boolean | null; onChange: (v: boolean) => void; disabled: boolean; maximize: boolean }> = ({ value, onChange, disabled, maximize }) => (
  <div>
    <Text style={{ display: "block", marginBottom: 8 }}>
      Подивись на рядок оцінок (z). Чи план оптимальний?
    </Text>
    <Radio.Group value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <Radio value={true}>Так — немає {maximize ? "додатних" : "від'ємних"} оцінок</Radio>
      <Radio value={false}>Ні — є {maximize ? "додатні" : "від'ємні"} оцінки, можна покращити</Radio>
    </Radio.Group>
  </div>
);

const EnteringInput: React.FC<{ step: SimplexStep; value: number | null; onChange: (v: number) => void; disabled: boolean }> = ({ step, value, onChange, disabled }) => {
  const lastCol = step.col_names.length - 1; // RHS index — exclude it
  return (
    <div>
      <Text style={{ display: "block", marginBottom: 8 }}>Обери змінну, що входить у базис (ведучий стовпець):</Text>
      <Space wrap>
        {step.col_names.slice(0, lastCol).map((name, j) => (
          <Button key={j} size="small" type={value === j ? "primary" : "default"}
            style={{ fontFamily: "monospace", minWidth: 48 }} disabled={disabled} onClick={() => onChange(j)}>
            {name}
          </Button>
        ))}
      </Space>
    </div>
  );
};

const LeavingInput: React.FC<{ step: SimplexStep; ratios: { row: number; aij: number; rhs: number; theta: number | null }[]; value: number | null; onChange: (v: number) => void; disabled: boolean }> = ({ step, ratios, value, onChange, disabled }) => {
  const colName = step.pivot_col !== null ? step.col_names[step.pivot_col] : "?";
  return (
    <div>
      <Text style={{ display: "block", marginBottom: 8 }}>
        Ведучий стовпець — <strong style={{ fontFamily: "monospace" }}>{colName}</strong> (виділено).
        Обчисли θᵢ = RHSᵢ / aᵢⱼ та обери ведучий рядок (мінімальне θ серед рядків з aᵢⱼ &gt; 0):
      </Text>
      <table style={{ borderCollapse: "collapse", fontFamily: "monospace", fontSize: 12, marginBottom: 10 }}>
        <thead>
          <tr style={{ color: "#8c8c8c" }}>
            {["Рядок", "RHS", `a (${colName})`, "θ = RHS/a", "Вибір"].map((h) => (
              <th key={h} style={{ ...tdS, color: "#8c8c8c", fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ratios.map((r) => (
            <tr key={r.row}>
              <td style={tdS}>{step.row_names[r.row]}</td>
              <td style={tdS}>{fmt(r.rhs)}</td>
              <td style={{ ...tdS, color: r.theta === null ? "#bbb" : undefined }}>{fmt(r.aij)}</td>
              <td style={{ ...tdS, color: r.theta === null ? "#bbb" : "#1677ff" }}>
                {r.theta === null ? "— (a≤0)" : fmt(r.theta)}
              </td>
              <td style={tdS}>
                <Radio
                  checked={value === r.row}
                  disabled={disabled || r.theta === null}
                  onChange={() => onChange(r.row)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Text type="secondary" style={{ fontSize: 11 }}>
        Рядки з a ≤ 0 не можуть бути ведучими (правило мінімального відношення вимагає a &gt; 0).
      </Text>
    </div>
  );
};

const ObjectiveInput: React.FC<{ value: number | null; onChange: (v: number | null) => void; disabled: boolean }> = ({ value, onChange, disabled }) => (
  <div>
    <Text style={{ display: "block", marginBottom: 8 }}>Введи оптимальне значення цільової функції <strong>F*</strong>:</Text>
    <InputNumber size="middle" style={{ width: 140 }} value={value} disabled={disabled}
      onChange={(v) => onChange(v)} placeholder="F*" controls={false} />
  </div>
);

const SolutionInput: React.FC<{ numVars: number; value: (number | null)[]; onChange: (v: (number | null)[]) => void; disabled: boolean }> = ({ numVars, value, onChange, disabled }) => (
  <div>
    <Text style={{ display: "block", marginBottom: 8 }}>Введи оптимальні значення змінних рішення:</Text>
    <Space wrap>
      {Array.from({ length: numVars }, (_, i) => (
        <div key={i} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#888" }}>x{i+1}</div>
          <InputNumber size="small" style={{ width: 80 }} value={value[i] ?? null} disabled={disabled}
            onChange={(v) => { const a = [...value]; a[i] = v; onChange(a); }} placeholder="?" controls={false} />
        </div>
      ))}
    </Space>
  </div>
);

const CorrectReveal: React.FC<{ q: QPlan; step: SimplexStep | null; res: LoadedResult; ratios: { row: number; aij: number; rhs: number; theta: number | null }[] }> = ({ q, step, res, ratios }) => {
  if (q.type === "optimality_iter") return <div>Правильно: <strong>ні</strong> — у рядку оцінок ще є коефіцієнти, що покращують план.</div>;
  if (q.type === "optimality_final") return <div>Правильно: <strong>так</strong> — рядок оцінок не містить коефіцієнтів для покращення.</div>;
  if (q.type === "entering" && step && step.pivot_col !== null)
    return <div style={{ fontFamily: "monospace" }}>Ведучий стовпець: <strong>{step.col_names[step.pivot_col]}</strong></div>;
  if (q.type === "leaving" && step && step.pivot_row !== null) {
    const minR = ratios.find((r) => r.row === step.pivot_row);
    return <div style={{ fontFamily: "monospace" }}>Ведучий рядок: <strong>{step.row_names[step.pivot_row]}</strong> (θ = {fmt(minR?.theta)} — мінімальне)</div>;
  }
  if (q.type === "objective") return <div style={{ fontFamily: "monospace" }}>F* = <strong>{fmt(res.optimal_value)}</strong></div>;
  if (q.type === "solution") return <div style={{ fontFamily: "monospace" }}>Розв'язок: {res.solution.map((v, i) => `x${i+1}=${fmt(v)}`).join(", ")}</div>;
  return null;
};

export default SimplexTestMode;
