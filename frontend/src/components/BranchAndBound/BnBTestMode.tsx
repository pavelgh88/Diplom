import React, { useMemo, useRef, useState } from "react";
import {
  Alert, Button, Card, Col, InputNumber, Radio, Row, Space, Statistic, Tag, Typography, Spin,
} from "antd";
import { CheckOutlined, ReloadOutlined, BulbOutlined, ArrowLeftOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { solveBranchAndBound, generateTask } from "../../api/client";
import type { LPProblem, BnBNode, BnBResult } from "../../types";

const { Title, Text } = Typography;

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const r = Math.round(v * 10000) / 10000;
  return Number.isInteger(r) ? String(r) : r.toFixed(4).replace(/\.?0+$/, "");
};
const isInt = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;
const eq = (a: number | null | undefined, b: number, tol = 1e-3) =>
  a !== null && a !== undefined && !Number.isNaN(a) && Math.abs(a - b) < tol;

type TestKind = "training" | "control";
type QType = "integrality" | "branch_var" | "branch_bounds" | "update_record" | "prune_decision" | "final_optimum";
// Result with guaranteed-populated fields (after successful solve).
type LoadedTree = BnBResult & { nodes: BnBNode[]; optimal_value: number; solution: number[] };

interface QPlan {
  type: QType;
  nodeId: number;       // -1 for "final_optimum"
}

interface Answers {
  integrality?: boolean | null;
  branch_var?: number | null;
  branch_bounds?: { left: number | null; right: number | null };
  update_record?: string | null;   // "yes_better" | "no_worse" | "yes_no_check" | "no_not_global"
  prune_decision?: string | null;  // "yes_correct" | "yes_wrong_sign" | "no_continue" | "no_bound_only"
  final_optimum?: number | null;
}

const Q_TITLES: Record<QType, string> = {
  integrality:       "Чи розв'язок LP цілочисельний?",
  branch_var:        "Яку змінну обрати для розгалуження?",
  branch_bounds:     "Обмеження для лівої та правої гілок",
  update_record:     "Чи оновити рекорд?",
  prune_decision:    "Чи відсікти цю гілку?",
  final_optimum:     "Який оптимальний цілочислений розв'язок?",
};
const Q_HINTS: Record<QType, string> = {
  integrality:       "Перевір кожне xᵢ — якщо хоч одне дробове, розв'язок не цілий.",
  branch_var:        "Стратегія «найдробовіша змінна» — обери ту, що найближча до 0.5 за дробовою частиною.",
  branch_bounds:     "Для змінної xⱼ = v.f: ліва гілка xⱼ ≤ ⌊v.f⌋, права гілка xⱼ ≥ ⌈v.f⌉.",
  update_record:     "Для max: оновлюємо, якщо LP > поточний рекорд. Для min: якщо LP < рекорд. Якщо рекорду ще нема — оновлюємо завжди.",
  prune_decision:    "Для max: відсікаємо, якщо LP ≤ рекорду (краще не буде). Для min: якщо LP ≥ рекорду.",
  final_optimum:     "Серед усіх цілочислених розв'язків обираємо найкращий — найбільший для max, найменший для min.",
};

// Compute record (best integer value among nodes BEFORE the given index in tree order)
function recordBefore(nodes: BnBNode[], targetId: number, maximize: boolean): number | null {
  let best: number | null = null;
  for (const n of nodes) {
    if (n.id === targetId) return best;
    if (n.status === "integer" && n.lp_value !== null) {
      if (best === null || (maximize ? n.lp_value > best : n.lp_value < best)) best = n.lp_value;
    }
  }
  return best;
}

const BnBTestMode: React.FC = () => {
  // ── State ───────────────────────────────────────────────────────────────
  const [kind, setKind] = useState<TestKind>("training");
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<LPProblem | null>(null);
  const [tree, setTree] = useState<LoadedTree | null>(null);
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

  // ── Helpers ─────────────────────────────────────────────────────────────
  const maximize = problem?.maximize ?? false;
  const currentQ = plan[idx];
  const currentNode = useMemo(() => {
    if (!tree || !currentQ) return null;
    if (currentQ.nodeId === -1) return null;
    return tree.nodes.find((n) => n.id === currentQ.nodeId) ?? null;
  }, [tree, currentQ]);

  const buildPlan = (res: LoadedTree): QPlan[] => {
    const root = res.nodes.find((n) => n.depth === 0);
    const firstInteger = res.nodes.find((n) => n.status === "integer");
    const firstPruned = res.nodes.find((n) => n.status === "pruned");
    const pl: QPlan[] = [];
    if (root?.solution) pl.push({ type: "integrality", nodeId: root.id });
    if (root?.status === "branched") {
      pl.push({ type: "branch_var", nodeId: root.id });
      pl.push({ type: "branch_bounds", nodeId: root.id });
    }
    if (firstInteger) pl.push({ type: "update_record", nodeId: firstInteger.id });
    if (firstPruned) pl.push({ type: "prune_decision", nodeId: firstPruned.id });
    pl.push({ type: "final_optimum", nodeId: -1 });
    return pl;
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      let prob: LPProblem | null = null;
      let loaded: LoadedTree | null = null;
      // Generate up to 8 problems looking for an interesting tree:
      // - root must be branched (otherwise no Q2/Q3)
      // - at least one integer node (otherwise no Q4)
      // - at least one pruned node ideally (for Q5)
      for (let attempt = 0; attempt < 8; attempt++) {
        const gen = await generateTask("branch_and_bound", 2, 3);
        prob = gen.problem as LPProblem;
        const res = await solveBranchAndBound(prob);
        if (!res.nodes || typeof res.optimal_value !== "number" || !res.solution) continue;
        const lt = res as LoadedTree;
        const root = lt.nodes.find((n) => n.depth === 0);
        const hasInt = lt.nodes.some((n) => n.status === "integer");
        const hasPruned = lt.nodes.some((n) => n.status === "pruned");
        loaded = lt;
        if (root?.status === "branched" && hasInt && hasPruned) break;
      }
      if (!prob || !loaded) return;
      const newPlan = buildPlan(loaded);
      setProblem(prob);
      setTree(loaded);
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

  // ── Validation ──────────────────────────────────────────────────────────
  const checkCurrent = (): boolean => {
    if (!tree || !currentQ) return false;
    const a = answers[idx];
    const node = currentNode;

    if (currentQ.type === "integrality") {
      if (!node?.solution) return false;
      const allInt = node.solution.every(isInt);
      return a.integrality === allInt;
    }
    if (currentQ.type === "branch_var") {
      if (node?.branch_var === undefined || node.branch_var === null) return false;
      return a.branch_var === node.branch_var;
    }
    if (currentQ.type === "branch_bounds") {
      if (node?.branch_value === undefined || node.branch_value === null) return false;
      const v = node.branch_value;
      return eq(a.branch_bounds?.left, Math.floor(v)) && eq(a.branch_bounds?.right, Math.ceil(v));
    }
    if (currentQ.type === "update_record") {
      if (!node || node.lp_value === null) return false;
      const recPrev = recordBefore(tree.nodes, node.id, maximize);
      const better = recPrev === null
        ? true
        : (maximize ? node.lp_value > recPrev : node.lp_value < recPrev);
      return a.update_record === (better ? "yes_better" : "no_worse");
    }
    if (currentQ.type === "prune_decision") {
      // Node IS pruned by construction (we picked one with status="pruned").
      // Correct answer: yes_correct (with right reasoning).
      return a.prune_decision === "yes_correct";
    }
    if (currentQ.type === "final_optimum") {
      return eq(a.final_optimum, tree.optimal_value);
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
    else {
      setDurationSec(Math.round((Date.now() - startedAtRef.current) / 1000));
      setFinished(true);
    }
  };
  const handlePrev = () => { if (idx > 0) setIdx(idx - 1); };

  // ── Setup screen ───────────────────────────────────────────────────────
  if (!started) {
    return (
      <Card>
        <Title level={5} style={{ marginTop: 0 }}>🧪 Тестовий режим — метод гілок і меж</Title>
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          Випадкова цілочислова задача → ти приймаєш рішення на ключових вузлах дерева:
          інтегральність, вибір змінної, межі гілок, оновлення рекорду, відсікання, фінальний оптимум.
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

  if (loading || !tree || !problem) {
    return <Card><Spin tip="Генерую цікаву задачу..." /></Card>;
  }

  // ── Summary screen ─────────────────────────────────────────────────────
  if (finished) {
    const correctCount = Object.values(correctness).filter(Boolean).length;
    const total = plan.length;
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
                <div style={{ marginTop: 4, color: "#595959", fontSize: 12 }}>
                  <BulbOutlined /> {Q_HINTS[q.type]}
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

  // ── Question screen ────────────────────────────────────────────────────
  const q = currentQ;
  if (!q) return null;
  const isSubmitted = !!submitted[idx];
  const isCorrect = correctness[idx];
  const a = answers[idx] ?? {};

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
            <Tag color={kind === "training" ? "blue" : "purple"}>
              {kind === "training" ? "Тренувальний" : "Контрольний"}
            </Tag>
            <Tag color={maximize ? "orange" : "geekblue"}>{maximize ? "max" : "min"}</Tag>
            <Button size="small" icon={<BulbOutlined />} onClick={() => setShowHint((h) => ({ ...h, [idx]: !h[idx] }))}>
              {showHint[idx] ? "Сховати формулу" : "Показати формулу"}
            </Button>
          </Space>
        </Col>
      </Row>

      {showHint[idx] && (
        <Alert type="info" showIcon style={{ marginBottom: 10 }} message={<><strong>Підказка:</strong> {Q_HINTS[q.type]}</>} />
      )}

      <ProblemRecap problem={problem} />

      {/* Per-question context + input */}
      <div style={{ marginTop: 14 }}>
        {q.type === "integrality" && currentNode && (
          <IntegralityQ node={currentNode} value={a.integrality ?? null} onChange={(v) => setAns({ integrality: v })} disabled={isSubmitted && kind === "training"} />
        )}
        {q.type === "branch_var" && currentNode && problem && (
          <BranchVarQ node={currentNode} numVars={problem.c.length} value={a.branch_var ?? null} onChange={(v) => setAns({ branch_var: v })} disabled={isSubmitted && kind === "training"} />
        )}
        {q.type === "branch_bounds" && currentNode && (
          <BranchBoundsQ node={currentNode} value={a.branch_bounds ?? { left: null, right: null }} onChange={(v) => setAns({ branch_bounds: v })} disabled={isSubmitted && kind === "training"} />
        )}
        {q.type === "update_record" && currentNode && tree && (
          <RecordQ node={currentNode} recordBeforeVal={recordBefore(tree.nodes, currentNode.id, maximize)} maximize={maximize} value={a.update_record ?? null} onChange={(v) => setAns({ update_record: v })} disabled={isSubmitted && kind === "training"} />
        )}
        {q.type === "prune_decision" && currentNode && tree && (
          <PruneQ node={currentNode} recordBeforeVal={recordBefore(tree.nodes, currentNode.id, maximize)} maximize={maximize} value={a.prune_decision ?? null} onChange={(v) => setAns({ prune_decision: v })} disabled={isSubmitted && kind === "training"} />
        )}
        {q.type === "final_optimum" && tree && (
          <FinalOptimumQ tree={tree} maximize={maximize} value={a.final_optimum ?? null} onChange={(v) => setAns({ final_optimum: v })} disabled={isSubmitted && kind === "training"} />
        )}
      </div>

      {kind === "training" && isSubmitted && (
        <Alert
          type={isCorrect ? "success" : "error"}
          showIcon
          style={{ marginTop: 12 }}
          message={isCorrect ? "Правильно ✓" : "Неправильно ✗"}
          description={!isCorrect ? <CorrectReveal q={q} node={currentNode} tree={tree} maximize={maximize} /> : undefined}
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
  <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 6, padding: "8px 12px", fontSize: 12 }}>
    <Text strong style={{ fontSize: 12 }}>Задача:</Text>{" "}
    <span style={{ fontFamily: "monospace" }}>
      {problem.maximize ? "max" : "min"}{" "}
      {problem.c.map((c, i) => `${c >= 0 && i > 0 ? "+" : ""}${c}·x${i+1}`).join(" ")}
      {" "}s.t.{" "}
      {problem.A.map((row, i) => (
        <span key={i}>
          {row.map((a, j) => `${a >= 0 && j > 0 ? "+" : ""}${a}·x${j+1}`).join(" ")} ≤ {problem.b[i]}
          {i < problem.A.length - 1 ? "; " : ""}
        </span>
      ))}
      {", xⱼ ∈ ℤ⁺"}
    </span>
  </div>
);

const NodeContext: React.FC<{ node: BnBNode }> = ({ node }) => (
  <Card size="small" style={{ marginBottom: 12, background: "#f0f7ff", border: "1px solid #91caff" }}>
    <Space direction="vertical" size={2} style={{ width: "100%" }}>
      <div>
        <Text strong>Вузол #{node.id}</Text>
        {" "}<Tag color="blue">Глибина {node.depth}</Tag>
        {node.label !== "LP-релаксація" && (
          <Tag color="cyan" style={{ fontFamily: "monospace" }}>{node.label}</Tag>
        )}
      </div>
      {node.lp_value !== null && (
        <div>
          LP-значення: <strong style={{ fontFamily: "monospace", color: "#1677ff" }}>{fmt(node.lp_value)}</strong>
          {node.solution && (
            <span style={{ marginLeft: 14 }}>
              Розв'язок:{" "}
              {node.solution.map((v, i) => (
                <span key={i} style={{ marginRight: 10, fontFamily: "monospace" }}>
                  x{i+1}=<strong style={{ color: isInt(v) ? "#389e0d" : "#fa8c16" }}>{fmt(v)}</strong>
                  {!isInt(v) && <Tag color="orange" style={{ marginLeft: 3, fontSize: 10 }}>дробове</Tag>}
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </Space>
  </Card>
);

const IntegralityQ: React.FC<{ node: BnBNode; value: boolean | null; onChange: (v: boolean) => void; disabled: boolean }> = ({ node, value, onChange, disabled }) => (
  <div>
    <NodeContext node={node} />
    <Text style={{ display: "block", marginBottom: 8 }}>Чи цей LP-розв'язок є <strong>цілочисловим</strong>?</Text>
    <Radio.Group value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <Radio value={true}>Так, усі xⱼ цілі</Radio>
      <Radio value={false}>Ні, є дробові значення</Radio>
    </Radio.Group>
  </div>
);

const BranchVarQ: React.FC<{ node: BnBNode; numVars: number; value: number | null; onChange: (v: number) => void; disabled: boolean }> = ({ node, numVars, value, onChange, disabled }) => (
  <div>
    <NodeContext node={node} />
    <Text style={{ display: "block", marginBottom: 8 }}>
      За якою змінною слід розгалужуватись? Стратегія — <strong>найдробовіша</strong> (дробова частина найближча до 0.5).
    </Text>
    <Space wrap>
      {Array.from({ length: numVars }, (_, i) => (
        <Button
          key={i}
          size="small"
          type={value === i ? "primary" : "default"}
          style={{ fontFamily: "monospace", minWidth: 48 }}
          disabled={disabled}
          onClick={() => onChange(i)}
        >x{i+1}</Button>
      ))}
    </Space>
  </div>
);

const BranchBoundsQ: React.FC<{ node: BnBNode; value: { left: number | null; right: number | null }; onChange: (v: { left: number | null; right: number | null }) => void; disabled: boolean }> = ({ node, value, onChange, disabled }) => (
  <div>
    <NodeContext node={node} />
    <Text style={{ display: "block", marginBottom: 8 }}>
      Розгалуження по <strong style={{ fontFamily: "monospace" }}>x{(node.branch_var ?? 0)+1} = {fmt(node.branch_value)}</strong>.
      Запиши обмеження для двох гілок:
    </Text>
    <Space size={16}>
      <div>
        <Text style={{ fontSize: 12, color: "#666", display: "block" }}>Ліва гілка: x{(node.branch_var ?? 0)+1} ≤</Text>
        <InputNumber
          size="middle" style={{ width: 100 }}
          value={value.left}
          disabled={disabled}
          onChange={(v) => onChange({ ...value, left: v })}
          placeholder="?" controls={false}
        />
      </div>
      <div>
        <Text style={{ fontSize: 12, color: "#666", display: "block" }}>Права гілка: x{(node.branch_var ?? 0)+1} ≥</Text>
        <InputNumber
          size="middle" style={{ width: 100 }}
          value={value.right}
          disabled={disabled}
          onChange={(v) => onChange({ ...value, right: v })}
          placeholder="?" controls={false}
        />
      </div>
    </Space>
  </div>
);

const RecordQ: React.FC<{ node: BnBNode; recordBeforeVal: number | null; maximize: boolean; value: string | null; onChange: (v: string) => void; disabled: boolean }> = ({ node, recordBeforeVal, maximize, value, onChange, disabled }) => {
  const recStr = recordBeforeVal === null ? "ще немає" : fmt(recordBeforeVal);
  return (
    <div>
      <NodeContext node={node} />
      <Text style={{ display: "block", marginBottom: 8 }}>
        У цьому вузлі знайдено <strong>цілочисловий</strong> розв'язок з LP-значенням <strong style={{ fontFamily: "monospace" }}>{fmt(node.lp_value)}</strong>.
        Поточний рекорд: <strong style={{ fontFamily: "monospace" }}>{recStr}</strong>.
        Чи слід оновити рекорд?
      </Text>
      <Radio.Group value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <Space direction="vertical">
          <Radio value="yes_better">
            Так — LP {maximize ? "більше" : "менше"} за поточний рекорд (або рекорду ще нема)
          </Radio>
          <Radio value="no_worse">
            Ні — LP {maximize ? "не краще" : "не менше"} за поточний рекорд
          </Radio>
          <Radio value="yes_no_check">
            Так, у будь-якому випадку — це ж цілочисловий розв'язок
          </Radio>
          <Radio value="no_not_global">
            Ні — рекорд оновлюємо лише в самому кінці алгоритму
          </Radio>
        </Space>
      </Radio.Group>
    </div>
  );
};

const PruneQ: React.FC<{ node: BnBNode; recordBeforeVal: number | null; maximize: boolean; value: string | null; onChange: (v: string) => void; disabled: boolean }> = ({ node, recordBeforeVal, maximize, value, onChange, disabled }) => (
  <div>
    <NodeContext node={node} />
    <Text style={{ display: "block", marginBottom: 8 }}>
      Цей вузол має LP <strong style={{ fontFamily: "monospace" }}>{fmt(node.lp_value)}</strong>.
      Поточний рекорд: <strong style={{ fontFamily: "monospace" }}>{recordBeforeVal === null ? "—" : fmt(recordBeforeVal)}</strong>.
      Чи слід відсікти цю гілку?
    </Text>
    <Radio.Group value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <Space direction="vertical">
        <Radio value="yes_correct">
          Так — для {maximize ? "max" : "min"}: LP {maximize ? "≤" : "≥"} рекорду → нічого кращого тут не знайти
        </Radio>
        <Radio value="yes_wrong_sign">
          Так — для {maximize ? "max" : "min"}: LP {maximize ? "≥" : "≤"} рекорду
        </Radio>
        <Radio value="no_continue">
          Ні — треба продовжити розгалуження, LP — це лише оцінка
        </Radio>
        <Radio value="no_bound_only">
          Ні — відсікають лише при недопустимості (infeasible)
        </Radio>
      </Space>
    </Radio.Group>
  </div>
);

const FinalOptimumQ: React.FC<{ tree: LoadedTree; maximize: boolean; value: number | null; onChange: (v: number | null) => void; disabled: boolean }> = ({ tree, maximize, value, onChange, disabled }) => {
  // Build choices: actual optimum + distractors from non-optimal LP values in tree.
  const choices = useMemo(() => {
    const real = tree.optimal_value;
    const dists = new Set<number>([real]);
    // Pick interesting distractors: best LP value among non-optimal nodes, root LP, worst integer
    const allLp = tree.nodes.filter((n) => n.lp_value !== null).map((n) => n.lp_value!);
    const distinct = Array.from(new Set(allLp)).filter((v) => Math.abs(v - real) > 1e-6);
    distinct.sort((a, b) => maximize ? b - a : a - b);
    for (const v of distinct) {
      if (dists.size >= 4) break;
      dists.add(v);
    }
    return Array.from(dists).sort((a, b) => maximize ? b - a : a - b);
  }, [tree, maximize]);
  return (
    <div>
      <Text style={{ display: "block", marginBottom: 8 }}>
        Серед усіх досліджених цілочислових розв'язків — який є <strong>оптимальним</strong> для всієї задачі?
        {" "}({maximize ? "найбільший" : "найменший"})
      </Text>
      <Radio.Group value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <Space direction="vertical">
          {choices.map((v) => (
            <Radio key={v} value={v} style={{ fontFamily: "monospace" }}>
              z = {fmt(v)}
            </Radio>
          ))}
        </Space>
      </Radio.Group>
    </div>
  );
};

const CorrectReveal: React.FC<{ q: QPlan; node: BnBNode | null; tree: LoadedTree | null; maximize: boolean }> = ({ q, node, tree, maximize }) => {
  if (q.type === "integrality" && node?.solution) {
    const allInt = node.solution.every(isInt);
    return <div>Правильно: {allInt ? "так, усі цілі" : "ні, є дробове"}.</div>;
  }
  if (q.type === "branch_var" && node?.branch_var !== undefined) {
    return <div>Правильна змінна: <strong style={{ fontFamily: "monospace" }}>x{node.branch_var+1}</strong> (= {fmt(node.branch_value)}, найближче до 0.5)</div>;
  }
  if (q.type === "branch_bounds" && node?.branch_value !== undefined && node.branch_value !== null) {
    const v = node.branch_value;
    return <div style={{ fontFamily: "monospace" }}>Ліва: x{(node.branch_var ?? 0)+1} ≤ {Math.floor(v)}, права: x{(node.branch_var ?? 0)+1} ≥ {Math.ceil(v)}.</div>;
  }
  if (q.type === "update_record" && node && tree) {
    const rec = recordBefore(tree.nodes, node.id, maximize);
    const better = rec === null ? true : (maximize ? (node.lp_value ?? -Infinity) > rec : (node.lp_value ?? Infinity) < rec);
    return <div>{better ? "Так, оновити" : "Ні, не оновлювати"} — LP={fmt(node.lp_value)}, рекорд={rec === null ? "—" : fmt(rec)}.</div>;
  }
  if (q.type === "prune_decision" && node && tree) {
    const rec = recordBefore(tree.nodes, node.id, maximize);
    return <div>Так, відсікти — LP={fmt(node.lp_value)} {maximize ? "≤" : "≥"} рекорд={fmt(rec)} → кращого тут не знайти.</div>;
  }
  if (q.type === "final_optimum" && tree) {
    return <div style={{ fontFamily: "monospace" }}>Оптимум: z = <strong>{fmt(tree.optimal_value)}</strong>, x = [{tree.solution.map(fmt).join(", ")}]</div>;
  }
  return null;
};

export default BnBTestMode;
