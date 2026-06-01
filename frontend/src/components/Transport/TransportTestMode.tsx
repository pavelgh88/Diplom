import React, { useMemo, useRef, useState } from "react";
import {
  Alert, Button, Card, Col, InputNumber, Radio, Row, Space, Statistic, Tag, Typography, Spin,
} from "antd";
import { CheckOutlined, ReloadOutlined, BulbOutlined, ArrowLeftOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { solveTransport, generateTask } from "../../api/client";
import type { TransportProblem, TransportResult, TransportStep } from "../../types";

const { Title, Text } = Typography;

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const r = Math.round(v * 10000) / 10000;
  return Number.isInteger(r) ? String(r) : r.toFixed(4).replace(/\.?0+$/, "");
};
const eq = (a: number | null | undefined, b: number, tol = 1e-3) =>
  a !== null && a !== undefined && !Number.isNaN(a) && Math.abs(a - b) < tol;

type TestKind = "training" | "control";

interface QDef {
  key: "potentials" | "delta" | "optimality" | "entering" | "cycle" | "theta";
  title: string;
  formula: string;
}
const QUESTIONS: QDef[] = [
  { key: "potentials", title: "Потенціали uᵢ, vⱼ", formula: "Для базисних клітинок: uᵢ + vⱼ = cᵢⱼ. Зафіксуй u₁ = 0 і знайди решту послідовно з рівнянь." },
  { key: "delta", title: "Оцінки Δᵢⱼ небазисних клітин", formula: "Δᵢⱼ = cᵢⱼ − uᵢ − vⱼ для кожної небазисної клітинки." },
  { key: "optimality", title: "Чи план оптимальний?", formula: "План оптимальний ⟺ всі Δᵢⱼ ≥ 0. Перевір також, чи план невироджений: кількість базисних клітинок має дорівнювати m + n − 1." },
  { key: "entering", title: "Вхідна клітина", formula: "Обери небазисну клітинку з найменшим (найбільш від'ємним) Δᵢⱼ." },
  { key: "cycle", title: "Клітини циклу перерозподілу", formula: "Замкнутий цикл через базисні клітини, що починається і закінчується у вхідній клітинці. Натисни всі клітинки циклу (включно з вхідною)." },
  { key: "theta", title: "Значення θ", formula: "θ = min(xᵢⱼ) серед клітинок циклу зі знаком «−» (друга, четверта, … у послідовності)." },
];

interface Answers {
  potentials?: { u: (number | null)[]; v: (number | null)[] };
  delta?: Record<string, number | null>;
  optimality?: { yes: boolean | null; reason: string | null };
  entering?: { i: number; j: number } | null;
  cycle?: { i: number; j: number }[];
  theta?: number | null;
}

const TransportTestMode: React.FC = () => {
  // ── State ───────────────────────────────────────────────────────────────
  const [kind, setKind] = useState<TestKind>("training");
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<TransportProblem | null>(null);
  const [iterStep, setIterStep] = useState<TransportStep | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [correctness, setCorrectness] = useState<Record<number, boolean>>({});
  const [showHint, setShowHint] = useState<Record<number, boolean>>({});
  const startedAtRef = useRef<number>(0);
  const [durationSec, setDurationSec] = useState<number>(0);

  // ── Derived ─────────────────────────────────────────────────────────────
  const m = problem?.supply.length ?? 0;
  const n = problem?.demand.length ?? 0;
  const basicSet = useMemo(() => {
    const s = new Set<string>();
    iterStep?.basic_cells.forEach(([r, c]) => s.add(`${r}_${c}`));
    return s;
  }, [iterStep]);
  const correctTheta = useMemo(() => {
    if (!iterStep?.loop) return null;
    const minus = iterStep.loop.filter((_, k) => k % 2 === 1).map(([r, c]) => iterStep.allocation[r][c]);
    return minus.length ? Math.min(...minus) : null;
  }, [iterStep]);
  const isOptimal = iterStep ? iterStep.entering_cell === null : false;

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleStart = async () => {
    setLoading(true);
    try {
      let prob: TransportProblem | null = null;
      let res: TransportResult | null = null;
      // Generate up to 6 problems until we find one with at least 1 iteration (steps>=2).
      for (let attempt = 0; attempt < 6; attempt++) {
        const gen = await generateTask("transport", 3, 3);
        prob = gen.problem as TransportProblem;
        res = await solveTransport(prob);
        if (res.status === "optimal" && res.steps && res.steps.length >= 2) break;
      }
      if (!prob || !res || !res.steps || res.steps.length < 2) {
        // Fallback — still set up with whatever we have; if no iteration, the optimality question still makes sense
        if (prob && res && res.steps && res.steps.length >= 1) {
          setProblem(prob);
          setIterStep(res.steps[0]);
        }
      } else {
        setProblem(prob);
        // steps[1] is the first iteration — has the same allocation as steps[0] (pre-pivot)
        // plus computed u, v, delta, entering_cell, loop.
        setIterStep(res.steps[1]);
      }
      setAnswers({});
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

  const checkCurrent = (): boolean => {
    if (!iterStep) return false;
    const q = QUESTIONS[idx];
    if (q.key === "potentials") {
      const a = answers.potentials;
      if (!a) return false;
      for (let i = 0; i < m; i++) {
        const exp = iterStep.u[i];
        if (exp === null || exp === undefined) continue;
        if (!eq(a.u[i], exp)) return false;
      }
      for (let j = 0; j < n; j++) {
        const exp = iterStep.v[j];
        if (exp === null || exp === undefined) continue;
        if (!eq(a.v[j], exp)) return false;
      }
      return true;
    }
    if (q.key === "delta") {
      const a = answers.delta ?? {};
      if (!iterStep.delta) return false;
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
          if (basicSet.has(`${i}_${j}`)) continue;
          const exp = iterStep.delta[i][j];
          if (exp === null) continue;
          if (!eq(a[`${i}_${j}`], exp)) return false;
        }
      }
      return true;
    }
    if (q.key === "optimality") {
      const a = answers.optimality;
      if (!a || a.yes === null) return false;
      if (a.yes !== isOptimal) return false;
      // Validate reason matches
      if (isOptimal) return a.reason === "all_nonneg";
      return a.reason === "has_negative";
    }
    if (q.key === "entering") {
      const a = answers.entering;
      if (!iterStep.entering_cell) return isOptimal; // No entering cell → only valid if optimal (then student should not have selected anything)
      if (!a) return false;
      return a.i === iterStep.entering_cell[0] && a.j === iterStep.entering_cell[1];
    }
    if (q.key === "cycle") {
      const a = answers.cycle ?? [];
      if (!iterStep.loop) return false;
      if (a.length !== iterStep.loop.length) return false;
      const expSet = new Set(iterStep.loop.map(([r, c]) => `${r}_${c}`));
      return a.every(({ i, j }) => expSet.has(`${i}_${j}`));
    }
    if (q.key === "theta") {
      return correctTheta !== null && eq(answers.theta, correctTheta);
    }
    return false;
  };

  const handleSubmit = () => {
    const ok = checkCurrent();
    setSubmitted((s) => ({ ...s, [idx]: true }));
    setCorrectness((c) => ({ ...c, [idx]: ok }));
  };
  const handleNext = () => {
    if (idx + 1 < QUESTIONS.length) setIdx(idx + 1);
    else {
      setDurationSec(Math.round((Date.now() - startedAtRef.current) / 1000));
      setFinished(true);
    }
  };
  const handlePrev = () => { if (idx > 0) setIdx(idx - 1); };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const setPotential = (which: "u" | "v", i: number, val: number | null) => {
    setAnswers((a) => {
      const u = [...(a.potentials?.u ?? Array(m).fill(null))];
      const v = [...(a.potentials?.v ?? Array(n).fill(null))];
      if (which === "u") u[i] = val;
      else v[i] = val;
      u[0] = 0; // always fixed
      return { ...a, potentials: { u, v } };
    });
  };
  const setDeltaAnswer = (i: number, j: number, val: number | null) => {
    setAnswers((a) => ({ ...a, delta: { ...(a.delta ?? {}), [`${i}_${j}`]: val } }));
  };

  // ── Rendering: setup screen ─────────────────────────────────────────────
  if (!started) {
    return (
      <Card>
        <Title level={5} style={{ marginTop: 0 }}>🧪 Тестовий режим — транспортна задача</Title>
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          6 запитань на одну згенеровану задачу. Натисни <strong>Розпочати тест</strong> — отримаєш
          випадкову задачу і відповідатимеш сам.
        </Text>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div>
            <Text strong style={{ display: "block", marginBottom: 4 }}>Режим перевірки:</Text>
            <Radio.Group value={kind} onChange={(e) => setKind(e.target.value)}>
              <Radio value="training">
                <strong>Тренувальний</strong> — миттєвий фідбек після кожної відповіді
              </Radio>
              <Radio value="control">
                <strong>Контрольний</strong> — без фідбеку по ходу, бал у кінці
              </Radio>
            </Radio.Group>
          </div>
          <div>
            <Text strong style={{ display: "block", marginBottom: 4 }}>Питання у тесті:</Text>
            <ol style={{ paddingLeft: 22, marginBottom: 0, fontSize: 13 }}>
              {QUESTIONS.map((q) => <li key={q.key}>{q.title}</li>)}
            </ol>
          </div>
          <Button type="primary" icon={<CheckOutlined />} onClick={handleStart} loading={loading} size="large">
            Розпочати тест
          </Button>
        </Space>
      </Card>
    );
  }

  if (loading || !problem || !iterStep) {
    return <Card><Spin tip="Завантаження..." /></Card>;
  }

  // ── Rendering: summary screen ───────────────────────────────────────────
  if (finished) {
    const correctCount = Object.values(correctness).filter(Boolean).length;
    const total = QUESTIONS.length;
    const percent = Math.round((correctCount / total) * 100);
    return (
      <Card>
        <Title level={4} style={{ marginTop: 0 }}>📊 Результати тесту</Title>
        <Row gutter={32} style={{ marginBottom: 16 }}>
          <Col>
            <Statistic
              title="Правильних відповідей"
              value={`${correctCount} / ${total}`}
              valueStyle={{ color: percent >= 70 ? "#52c41a" : percent >= 40 ? "#fa8c16" : "#cf1322", fontSize: 28 }}
            />
          </Col>
          <Col>
            <Statistic title="Бал" value={`${percent}%`} valueStyle={{ fontSize: 28 }} />
          </Col>
          <Col>
            <Statistic title="Час" value={`${Math.floor(durationSec/60)}:${String(durationSec%60).padStart(2,"0")}`} valueStyle={{ fontSize: 28 }} />
          </Col>
          <Col>
            <Statistic title="Режим" value={kind === "training" ? "Тренувальний" : "Контрольний"} valueStyle={{ fontSize: 18 }} />
          </Col>
        </Row>

        <Text strong style={{ display: "block", marginBottom: 8 }}>Деталі:</Text>
        <Space direction="vertical" size={6} style={{ width: "100%", marginBottom: 16 }}>
          {QUESTIONS.map((q, k) => (
            <div key={k} style={{
              padding: "8px 12px",
              border: `1px solid ${correctness[k] ? "#b7eb8f" : "#ffccc7"}`,
              background: correctness[k] ? "#f6ffed" : "#fff1f0",
              borderRadius: 6,
              fontSize: 13,
            }}>
              {correctness[k] ? "✅" : "❌"} <strong>{k + 1}. {q.title}</strong>
              {!correctness[k] && (
                <div style={{ marginTop: 4, color: "#595959", fontSize: 12 }}>
                  <BulbOutlined /> {q.formula}
                </div>
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

  // ── Rendering: question screen ──────────────────────────────────────────
  const q = QUESTIONS[idx];
  const isSubmitted = !!submitted[idx];
  const isCorrect = correctness[idx];

  return (
    <Card>
      {/* Header: progress + mode badge */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 14 }}>
        <Col>
          <Title level={5} style={{ margin: 0 }}>Питання {idx + 1} з {QUESTIONS.length}: {q.title}</Title>
          <div style={{ height: 6, background: "#f0f0f0", borderRadius: 3, marginTop: 6, width: 360 }}>
            <div style={{ height: "100%", width: `${((idx+1)/QUESTIONS.length)*100}%`, background: "#1677ff", borderRadius: 3 }} />
          </div>
        </Col>
        <Col>
          <Space>
            <Tag color={kind === "training" ? "blue" : "purple"}>
              {kind === "training" ? "Тренувальний" : "Контрольний"}
            </Tag>
            <Button size="small" icon={<BulbOutlined />} onClick={() => setShowHint((h) => ({ ...h, [idx]: !h[idx] }))}>
              {showHint[idx] ? "Сховати формулу" : "Показати формулу"}
            </Button>
          </Space>
        </Col>
      </Row>

      {showHint[idx] && (
        <Alert type="info" showIcon style={{ marginBottom: 10 }} message={<><strong>Підказка:</strong> {q.formula}</>} />
      )}

      {/* Problem reminder — always visible */}
      <ProblemRecap problem={problem} iterStep={iterStep} basicSet={basicSet} />

      {/* Question body */}
      <div style={{ marginTop: 14 }}>
        {q.key === "potentials" && (
          <PotentialsInput m={m} n={n} answers={answers} setPotential={setPotential} disabled={isSubmitted && kind === "training"} />
        )}
        {q.key === "delta" && (
          <DeltaInput m={m} n={n} basicSet={basicSet} answers={answers} setDeltaAnswer={setDeltaAnswer} disabled={isSubmitted && kind === "training"} />
        )}
        {q.key === "optimality" && (
          <OptimalityInput answers={answers} setAnswers={setAnswers} disabled={isSubmitted && kind === "training"} />
        )}
        {q.key === "entering" && (
          <EnteringCellInput m={m} n={n} basicSet={basicSet} iterStep={iterStep} answers={answers} setAnswers={setAnswers} disabled={isSubmitted && kind === "training"} />
        )}
        {q.key === "cycle" && (
          <CycleInput m={m} n={n} basicSet={basicSet} iterStep={iterStep} answers={answers} setAnswers={setAnswers} disabled={isSubmitted && kind === "training"} />
        )}
        {q.key === "theta" && (
          <ThetaInput answers={answers} setAnswers={setAnswers} disabled={isSubmitted && kind === "training"} />
        )}
      </div>

      {/* Feedback (training only) */}
      {kind === "training" && isSubmitted && (
        <Alert
          type={isCorrect ? "success" : "error"}
          showIcon
          style={{ marginTop: 12 }}
          message={isCorrect ? "Правильно ✓" : "Неправильно ✗"}
          description={
            !isCorrect ? (
              <CorrectAnswerReveal q={q} m={m} n={n} basicSet={basicSet} iterStep={iterStep} correctTheta={correctTheta} isOptimal={isOptimal} />
            ) : undefined
          }
        />
      )}

      {/* Nav */}
      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
        <Button icon={<ArrowLeftOutlined />} onClick={handlePrev} disabled={idx === 0}>
          Назад
        </Button>
        <Space>
          {!isSubmitted ? (
            <Button type="primary" icon={<CheckOutlined />} onClick={handleSubmit}>
              {kind === "training" ? "Перевірити" : "Записати відповідь"}
            </Button>
          ) : (
            <Button type="primary" icon={<ArrowRightOutlined />} iconPosition="end" onClick={handleNext}>
              {idx + 1 < QUESTIONS.length ? "Наступне питання" : "Завершити тест"}
            </Button>
          )}
        </Space>
      </div>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

const ProblemRecap: React.FC<{ problem: TransportProblem; iterStep: TransportStep; basicSet: Set<string> }> = ({ problem, iterStep, basicSet }) => {
  const m = problem.supply.length, n = problem.demand.length;
  return (
    <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 6, padding: "10px 14px", fontSize: 12 }}>
      <Text strong style={{ fontSize: 12 }}>Задача (запам'ятай — це підстава для всіх 6 питань):</Text>
      <div style={{ overflowX: "auto", marginTop: 6 }}>
        <table style={{ borderCollapse: "collapse", fontFamily: "monospace", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "#8c8c8c" }}>
              <th style={tdS}></th>
              {Array.from({ length: n }, (_, j) => <th key={j} style={tdS}>B{j+1} (потр.={problem.demand[j]})</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: m }, (_, i) => (
              <tr key={i}>
                <th style={{ ...tdS, color: "#8c8c8c" }}>A{i+1} (зап.={problem.supply[i]})</th>
                {Array.from({ length: n }, (_, j) => {
                  const isB = basicSet.has(`${i}_${j}`);
                  const x = iterStep.allocation[i][j];
                  return (
                    <td key={j} style={{
                      ...tdS,
                      background: isB ? "#e6f4ff" : "transparent",
                      border: isB ? "1.5px solid #1677ff" : "1px solid #e8e8e8",
                    }}>
                      <div style={{ color: "#8c8c8c", fontSize: 10 }}>c={problem.costs[i][j]}</div>
                      <div style={{ fontWeight: isB ? 700 : 400, color: isB ? "#1677ff" : "#bbb" }}>
                        {isB ? (x > 0 ? fmt(x) : "0") : "·"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: "#666" }}>
        Сині клітини — <strong>базисні</strong> (поточний план перевезень).
        Кількість: <strong>{iterStep.basic_cells.length}</strong> (для невиродженого плану = m + n − 1 = {m + n - 1}).
      </div>
    </div>
  );
};

const tdS: React.CSSProperties = { padding: "4px 10px", border: "1px solid #e8e8e8", textAlign: "center", verticalAlign: "middle" };

const PotentialsInput: React.FC<{ m: number; n: number; answers: Answers; setPotential: (w: "u"|"v", i: number, v: number|null) => void; disabled: boolean }> = ({ m, n, answers, setPotential, disabled }) => (
  <div>
    <Text style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
      Введи потенціали так, щоб для кожної базисної клітинки виконувалось <strong>uᵢ + vⱼ = cᵢⱼ</strong>.
    </Text>
    <Space size={24} wrap>
      <div>
        <Text style={{ fontSize: 12, color: "#666" }}>uᵢ (постачальники):</Text>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          {Array.from({ length: m }, (_, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#888" }}>u{i+1}</div>
              <InputNumber
                size="small" style={{ width: 70 }}
                value={i === 0 ? 0 : (answers.potentials?.u[i] ?? null)}
                disabled={i === 0 || disabled}
                onChange={(v) => setPotential("u", i, v)}
                placeholder="?"
                controls={false}
              />
            </div>
          ))}
        </div>
      </div>
      <div>
        <Text style={{ fontSize: 12, color: "#666" }}>vⱼ (споживачі):</Text>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          {Array.from({ length: n }, (_, j) => (
            <div key={j} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#888" }}>v{j+1}</div>
              <InputNumber
                size="small" style={{ width: 70 }}
                value={answers.potentials?.v[j] ?? null}
                disabled={disabled}
                onChange={(v) => setPotential("v", j, v)}
                placeholder="?"
                controls={false}
              />
            </div>
          ))}
        </div>
      </div>
    </Space>
  </div>
);

const DeltaInput: React.FC<{ m: number; n: number; basicSet: Set<string>; answers: Answers; setDeltaAnswer: (i: number, j: number, v: number|null) => void; disabled: boolean }> = ({ m, n, basicSet, answers, setDeltaAnswer, disabled }) => (
  <div>
    <Text style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
      Обчисли <strong>Δᵢⱼ = cᵢⱼ − uᵢ − vⱼ</strong> для кожної небазисної клітинки (порожні поля у таблиці).
      Для базисних клітинок Δ = 0 — заповнювати не потрібно.
    </Text>
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontFamily: "monospace", fontSize: 12 }}>
        <thead>
          <tr style={{ color: "#8c8c8c" }}>
            <th style={tdS}></th>
            {Array.from({ length: n }, (_, j) => <th key={j} style={tdS}>B{j+1}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: m }, (_, i) => (
            <tr key={i}>
              <th style={{ ...tdS, color: "#8c8c8c" }}>A{i+1}</th>
              {Array.from({ length: n }, (_, j) => {
                const isB = basicSet.has(`${i}_${j}`);
                return (
                  <td key={j} style={{ ...tdS, background: isB ? "#fafafa" : "transparent" }}>
                    {isB ? (
                      <span style={{ color: "#bbb" }}>—</span>
                    ) : (
                      <InputNumber
                        size="small" style={{ width: 70 }}
                        value={answers.delta?.[`${i}_${j}`] ?? null}
                        disabled={disabled}
                        onChange={(v) => setDeltaAnswer(i, j, v)}
                        placeholder="Δ=?"
                        controls={false}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const OptimalityInput: React.FC<{ answers: Answers; setAnswers: React.Dispatch<React.SetStateAction<Answers>>; disabled: boolean }> = ({ answers, setAnswers, disabled }) => {
  const opt = answers.optimality;
  const set = (yes: boolean | null, reason: string | null) =>
    setAnswers((a) => ({ ...a, optimality: { yes: yes ?? a.optimality?.yes ?? null, reason: reason ?? a.optimality?.reason ?? null } }));
  return (
    <div>
      <Text style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
        Чи поточний план оптимальний? Якщо ні — вкажи причину.
      </Text>
      <Space direction="vertical">
        <Radio.Group value={opt?.yes} onChange={(e) => set(e.target.value, null)} disabled={disabled}>
          <Radio value={true}>Так, оптимальний</Radio>
          <Radio value={false}>Ні, не оптимальний</Radio>
        </Radio.Group>
        <Text style={{ fontSize: 12, color: "#666", marginTop: 8 }}>Обґрунтування:</Text>
        <Radio.Group value={opt?.reason} onChange={(e) => set(null, e.target.value)} disabled={disabled}>
          <Space direction="vertical">
            <Radio value="all_nonneg">Усі Δᵢⱼ ≥ 0 — план оптимальний</Radio>
            <Radio value="has_negative">Є від'ємні Δᵢⱼ — можна покращити</Radio>
            <Radio value="degenerate">План виродженний (базисних клітин ≠ m + n − 1)</Radio>
          </Space>
        </Radio.Group>
      </Space>
    </div>
  );
};

const EnteringCellInput: React.FC<{ m: number; n: number; basicSet: Set<string>; iterStep: TransportStep; answers: Answers; setAnswers: React.Dispatch<React.SetStateAction<Answers>>; disabled: boolean }> = ({ m, n, basicSet, iterStep, answers, setAnswers, disabled }) => {
  const choose = (i: number, j: number) => {
    if (disabled) return;
    setAnswers((a) => ({ ...a, entering: { i, j } }));
  };
  const sel = answers.entering;
  return (
    <div>
      <Text style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
        Натисни на небазисну клітинку, яку слід ввести в базис.
      </Text>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontFamily: "monospace", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "#8c8c8c" }}>
              <th style={tdS}></th>
              {Array.from({ length: n }, (_, j) => <th key={j} style={tdS}>B{j+1}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: m }, (_, i) => (
              <tr key={i}>
                <th style={{ ...tdS, color: "#8c8c8c" }}>A{i+1}</th>
                {Array.from({ length: n }, (_, j) => {
                  const isB = basicSet.has(`${i}_${j}`);
                  const isSel = sel?.i === i && sel?.j === j;
                  return (
                    <td key={j} style={{
                      ...tdS,
                      background: isB ? "#fafafa" : isSel ? "#bae0ff" : "transparent",
                      cursor: isB || disabled ? "default" : "pointer",
                      border: isSel ? "2px solid #1677ff" : "1px solid #e8e8e8",
                    }} onClick={() => !isB && choose(i, j)}>
                      {isB ? <span style={{ color: "#bbb" }}>баз.</span>
                           : <span>{iterStep.delta?.[i]?.[j] !== null && iterStep.delta?.[i]?.[j] !== undefined ? `Δ=${fmt(iterStep.delta[i][j])}` : "?"}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CycleInput: React.FC<{ m: number; n: number; basicSet: Set<string>; iterStep: TransportStep; answers: Answers; setAnswers: React.Dispatch<React.SetStateAction<Answers>>; disabled: boolean }> = ({ m, n, basicSet, iterStep, answers, setAnswers, disabled }) => {
  const cycle = answers.cycle ?? [];
  const toggle = (i: number, j: number) => {
    if (disabled) return;
    const exists = cycle.findIndex((c) => c.i === i && c.j === j);
    if (exists >= 0) setAnswers((a) => ({ ...a, cycle: cycle.filter((_, k) => k !== exists) }));
    else setAnswers((a) => ({ ...a, cycle: [...cycle, { i, j }] }));
  };
  return (
    <div>
      <Text style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
        Натисни клітинки, які входять у цикл перерозподілу (включно з вхідною). Послідовність не важлива.
      </Text>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontFamily: "monospace", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "#8c8c8c" }}>
              <th style={tdS}></th>
              {Array.from({ length: n }, (_, j) => <th key={j} style={tdS}>B{j+1}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: m }, (_, i) => (
              <tr key={i}>
                <th style={{ ...tdS, color: "#8c8c8c" }}>A{i+1}</th>
                {Array.from({ length: n }, (_, j) => {
                  const isB = basicSet.has(`${i}_${j}`);
                  const sel = cycle.some((c) => c.i === i && c.j === j);
                  return (
                    <td key={j} style={{
                      ...tdS,
                      background: sel ? "#d9f7be" : isB ? "#f0f5ff" : "transparent",
                      cursor: disabled ? "default" : "pointer",
                      border: sel ? "2px solid #52c41a" : "1px solid #e8e8e8",
                    }} onClick={() => toggle(i, j)}>
                      <div style={{ fontWeight: isB ? 700 : 400, color: isB ? "#1677ff" : "#999" }}>
                        {isB ? fmt(iterStep.allocation[i][j]) : "·"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: "#666" }}>
        Обрано клітин: <strong>{cycle.length}</strong> (типовий цикл — 4 клітини, може бути 6 чи більше).
      </div>
    </div>
  );
};

const ThetaInput: React.FC<{ answers: Answers; setAnswers: React.Dispatch<React.SetStateAction<Answers>>; disabled: boolean }> = ({ answers, setAnswers, disabled }) => (
  <div>
    <Text style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
      Введи значення <strong>θ</strong> — мінімальний вантаж серед клітин циклу зі знаком «−».
    </Text>
    <InputNumber
      size="middle" style={{ width: 120 }}
      value={answers.theta ?? null}
      disabled={disabled}
      onChange={(v) => setAnswers((a) => ({ ...a, theta: v }))}
      placeholder="θ"
      controls={false}
    />
  </div>
);

const CorrectAnswerReveal: React.FC<{ q: QDef; m: number; n: number; basicSet: Set<string>; iterStep: TransportStep; correctTheta: number | null; isOptimal: boolean }> = ({ q, m, n, basicSet, iterStep, correctTheta, isOptimal }) => {
  if (q.key === "potentials") {
    return (
      <div style={{ fontFamily: "monospace", fontSize: 12 }}>
        Правильні потенціали: {iterStep.u.map((u, i) => u !== null ? <Tag key={`u${i}`}>u{i+1}={fmt(u)}</Tag> : null)}
        {iterStep.v.map((v, j) => v !== null ? <Tag key={`v${j}`}>v{j+1}={fmt(v)}</Tag> : null)}
      </div>
    );
  }
  if (q.key === "delta") {
    const cells: React.ReactNode[] = [];
    if (iterStep.delta) {
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
        if (basicSet.has(`${i}_${j}`)) continue;
        const d = iterStep.delta[i][j];
        if (d === null) continue;
        cells.push(<Tag key={`${i}_${j}`} color={d < 0 ? "orange" : "default"} style={{ fontFamily: "monospace" }}>Δ({i+1},{j+1})={fmt(d)}</Tag>);
      }
    }
    return <div>{cells}</div>;
  }
  if (q.key === "optimality") {
    return <div>{isOptimal ? "План оптимальний (усі Δᵢⱼ ≥ 0)." : "План не оптимальний — є від'ємні Δᵢⱼ, можна покращити."}</div>;
  }
  if (q.key === "entering") {
    if (!iterStep.entering_cell) return <div>План уже оптимальний — вхідної клітини немає.</div>;
    return <div style={{ fontFamily: "monospace" }}>Правильна вхідна клітина: <strong>A{iterStep.entering_cell[0]+1}→B{iterStep.entering_cell[1]+1}</strong> (Δ={fmt(iterStep.delta?.[iterStep.entering_cell[0]]?.[iterStep.entering_cell[1]])})</div>;
  }
  if (q.key === "cycle") {
    if (!iterStep.loop) return <div>—</div>;
    return (
      <div>
        {iterStep.loop.map(([r, c], k) => (
          <Tag key={k} color={k % 2 === 0 ? "blue" : "red"} style={{ fontFamily: "monospace" }}>
            ({r+1},{c+1}) {k % 2 === 0 ? "+θ" : "−θ"}
          </Tag>
        ))}
      </div>
    );
  }
  if (q.key === "theta") {
    return <div style={{ fontFamily: "monospace" }}>Правильне θ = <strong>{fmt(correctTheta)}</strong></div>;
  }
  return null;
};

export default TransportTestMode;
