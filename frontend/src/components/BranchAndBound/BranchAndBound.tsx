import React, { useEffect, useRef, useState } from "react";
import { Alert, Badge, Card, Col, Row, Space, Spin, Statistic, Switch, Table, Tag, Typography } from "antd";
import ProblemInputForm from "../ProblemInputForm";
import type { ProblemInputFormHandle } from "../ProblemInputForm";
import BnBTree from "./BnBTree";
import ProminentBnBStep from "./ProminentBnBStep";
import TaskSelector from "../TaskSelector";
import TheoryPanel from "../TheoryPanel";
import { solveBranchAndBound } from "../../api/client";
import type { BnBNode, BnBResult, LPProblem } from "../../types";

const { Title, Text } = Typography;

const STATUS_BADGE: Record<string, "processing" | "success" | "error" | "default"> = {
  branched: "processing",
  integer: "success",
  pruned: "error",
  infeasible: "default",
};

const STATUS_LABEL: Record<string, string> = {
  branched: "Розгалуження",
  integer: "Цілочисельний",
  pruned: "Відсічено",
  infeasible: "Недопустимий",
};

const fmtV = (n: number) => {
  const r = Math.round(n * 10000) / 10000;
  return Number.isInteger(r) ? String(r) : r.toFixed(4).replace(/\.?0+$/, "");
};

function NodeExplanation({ node }: { node: BnBNode }) {
  switch (node.status) {
    case "branched": {
      const j = (node.branch_var ?? 0) + 1;
      const val = node.branch_value ?? 0;
      const fl = Math.floor(val);
      const ce = Math.ceil(val);
      return (
        <span>
          x<sub>{j}</sub> = <strong>{fmtV(val)}</strong> — дробове значення
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            Ліва гілка: x<sub>{j}</sub> ≤ {fl} &nbsp;|&nbsp; Права гілка: x<sub>{j}</sub> ≥ {ce}
          </Text>
        </span>
      );
    }
    case "pruned":
      return (
        <span style={{ color: "#cf1322" }}>
          LP = {fmtV(node.lp_value!)} ≥ рекорд
          <br />
          <Text style={{ fontSize: 11, color: "#cf1322" }}>
            Гілка не може дати кращий результат
          </Text>
        </span>
      );
    case "infeasible":
      return (
        <Text type="secondary" style={{ fontSize: 12 }}>
          LP-релаксація недопустима — область порожня
        </Text>
      );
    case "integer":
      return (
        <span style={{ color: "#389e0d" }}>
          <strong>Цілочисловий розв'язок!</strong>
          <br />
          <Text style={{ fontSize: 11, color: "#389e0d" }}>
            Оновлено рекорд = {fmtV(node.lp_value!)}
          </Text>
        </span>
      );
    default:
      return null;
  }
}

const BranchAndBound: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BnBResult | null>(null);
  const [stepByStep, setStepByStep] = useState(false);
  const [currentNode, setCurrentNode] = useState(0);
  const formRef = useRef<ProblemInputFormHandle | null>(null);

  useEffect(() => { setCurrentNode(0); }, [result]);

  const handleLoadTask = (problem: object) => {
    formRef.current?.loadProblem(problem as LPProblem);
  };

  const handleSolve = async (problem: LPProblem) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await solveBranchAndBound(problem);
      setResult(res);
    } catch (e: any) {
      setResult({ status: "error", error: e?.response?.data?.error ?? e.message });
    } finally {
      setLoading(false);
    }
  };

  const tableColumns = [
    {
      title: "№",
      dataIndex: "id",
      key: "id",
      width: 40,
      render: (v: number) => <Text type="secondary">{v}</Text>,
    },
    {
      title: "Обмеження",
      dataIndex: "label",
      key: "label",
      width: 140,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (s: string) => (
        <Badge status={STATUS_BADGE[s]} text={STATUS_LABEL[s]} />
      ),
    },
    {
      title: "LP значення",
      dataIndex: "lp_value",
      key: "lp_value",
      width: 110,
      render: (v: number | null) =>
        v !== null ? (
          <Text strong style={{ fontFamily: "monospace" }}>{fmtV(v)}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Розв'язок LP",
      dataIndex: "solution",
      key: "solution",
      width: 160,
      render: (sol: number[] | null) =>
        sol ? (
          <Text style={{ fontFamily: "monospace", fontSize: 12 }}>
            [{sol.map((v) => fmtV(v)).join(", ")}]
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Пояснення",
      key: "explanation",
      render: (_: any, node: BnBNode) => (
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          <NodeExplanation node={node} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ margin: "0 0 2px" }}>Метод гілок і меж</Title>
      <Text type="secondary" style={{ display: "block", fontSize: 13, marginBottom: 14 }}>
        Розв'язує цілочисельну задачу лінійного програмування методом гілок і меж з візуалізацією дерева перебору.
      </Text>

      <TheoryPanel>
        <p style={{ marginBottom: 6 }}><strong>Ідея методу:</strong></p>
        <p style={{ marginBottom: 10 }}>
          Цілочислова задача ЗЛП важча за неперервну. Метод гілок і меж розв'язує
          <strong> LP-релаксацію</strong> (відкидаємо вимогу цілочисловості). Якщо розв'язок
          не цілий — задача <strong>розгалужується</strong> на дві підзадачі з додатковими обмеженнями.
        </p>
        <p style={{ marginBottom: 6 }}><strong>Алгоритм:</strong></p>
        <ol style={{ paddingLeft: 18, marginBottom: 10 }}>
          <li>Розв'язати LP-релаксацію поточного вузла</li>
          <li>Якщо задача <strong>недопустима</strong> або значення не краще рекорду — <strong>відсікти гілку</strong></li>
          <li>Якщо розв'язок <strong>цілочисловий</strong> — оновити рекорд (upper bound)</li>
          <li>Інакше: вибрати нецілу змінну x<sub>j</sub> = f</li>
          <li>Розгалужуємо: ліва гілка x<sub>j</sub> ≤ ⌊f⌋, права — x<sub>j</sub> ≥ ⌈f⌉</li>
          <li>Повторити для кожного активного вузла (обхід дерева)</li>
        </ol>
        <p style={{ marginBottom: 6 }}><strong>Критерії відсічення (pruning):</strong></p>
        <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
          <li><strong>За недопустимістю</strong> — LP-релаксація не має розв'язку</li>
          <li><strong>За обмеженням</strong> — LP-значення вузла ≥ поточного рекорду (для min)</li>
          <li><strong>За цілочисловістю</strong> — розв'язок вже цілий, рекорд оновлено</li>
        </ul>
      </TheoryPanel>

      <TaskSelector taskType="branch_and_bound" onLoad={handleLoadTask} />

      <Card size="small" style={{ marginTop: 0 }}>
        <ProblemInputForm ref={formRef} onSolve={handleSolve} loading={loading} showBounds />
      </Card>

      {loading && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Spin size="large" tip="Будую дерево..." />
        </div>
      )}

      {result && !loading && (
        <div style={{ marginTop: 14 }}>
          {result.error ? (
            <Alert type="error" message="Помилка" description={result.error} showIcon />
          ) : result.status === "infeasible" ? (
            <Alert type="warning" message="Задача недопустима" showIcon />
          ) : (
            <>
              <Card>
                <Row gutter={32}>
                  <Col>
                    <Statistic
                      title="Оптимальне ціле значення"
                      value={result.optimal_value?.toFixed(4)}
                      valueStyle={{ color: "#52c41a", fontSize: 28 }}
                    />
                  </Col>
                  <Col>
                    <Statistic title="Вузлів у дереві" value={result.total_nodes} />
                  </Col>
                  <Col>
                    <div>
                      <Text type="secondary">Цілочисельний розв'язок</Text>
                      <div style={{ marginTop: 4 }}>
                        {result.solution?.map((v, i) => (
                          <Text key={i} style={{ marginRight: 12 }}>
                            x<sub>{i + 1}</sub> = <strong>{Math.round(v)}</strong>
                          </Text>
                        ))}
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card>

              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                {(["branched", "integer", "pruned", "infeasible"] as const).map((s) => (
                  <Space key={s} size={6}>
                    <span style={{
                      display: "inline-block", width: 12, height: 12, borderRadius: 3,
                      background: { branched: "#1677ff", integer: "#52c41a", pruned: "#ff7875", infeasible: "#bfbfbf" }[s],
                    }} />
                    <Text style={{ fontSize: 12 }}>{STATUS_LABEL[s]}</Text>
                  </Space>
                ))}
              </div>

              {/* Mode toggle */}
              <Row align="middle" style={{ marginTop: 16, marginBottom: 10 }} gutter={12}>
                <Col>
                  <Title level={5} style={{ margin: 0 }}>Обхід дерева</Title>
                </Col>
                <Col>
                  <Space size={8}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Режим навчання:</Text>
                    <Switch
                      size="small"
                      checked={stepByStep}
                      onChange={(v) => { setStepByStep(v); setCurrentNode(0); }}
                      checkedChildren="вузол за вузлом"
                      unCheckedChildren="дерево"
                    />
                  </Space>
                </Col>
              </Row>

              {stepByStep && result.nodes ? (
                <Card style={{ marginBottom: 16 }}>
                  <ProminentBnBStep
                    key={currentNode}
                    node={result.nodes[currentNode]}
                    nodeIndex={currentNode}
                    totalNodes={result.nodes.length}
                    optimalValue={result.optimal_value ?? 0}
                    onPrev={() => setCurrentNode((c) => Math.max(c - 1, 0))}
                    onNext={() => setCurrentNode((c) => Math.min(c + 1, (result.nodes?.length ?? 1) - 1))}
                  />
                </Card>
              ) : (
                <>
                  <Title level={5} style={{ marginTop: 0 }}>Дерево гілок і меж</Title>
                  {result.nodes && <BnBTree nodes={result.nodes} />}
                </>
              )}

              <Title level={5} style={{ marginTop: 16 }}>
                Таблиця вузлів
              </Title>
              <Table
                columns={tableColumns}
                dataSource={result.nodes?.map((n) => ({ ...n, key: n.id }))}
                pagination={{ pageSize: 20 }}
                size="small"
                bordered
                scroll={{ x: "max-content" }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default BranchAndBound;
