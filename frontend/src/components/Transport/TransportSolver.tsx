import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Form,
  InputNumber,
  Row,
  Space,
  Spin,
  Statistic,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { MinusOutlined, PlusOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { solveTransport } from "../../api/client";
import TransportTable from "./TransportTable";
import ProminentTransportStep from "./ProminentTransportStep";
import PotentialsChecker from "./PotentialsChecker";
import TaskSelector from "../TaskSelector";
import TheoryPanel from "../TheoryPanel";
import { useAppContext } from "../../context/AppContext";
import type { TransportProblem, TransportResult } from "../../types";

const { Title, Text } = Typography;

const TransportSolver: React.FC = () => {
  const { recordAttempt } = useAppContext();
  const [numSources, setNumSources] = useState(3);
  const [numDests, setNumDests] = useState(3);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TransportResult | null>(null);
  const [stepByStep, setStepByStep] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [taskLabel, setTaskLabel] = useState("Власна задача");
  const [lastProblem, setLastProblem] = useState<{
    supply: number[];
    demand: number[];
    costs: number[][];
  } | null>(null);

  useEffect(() => { setCurrentStep(0); }, [result]);

  const handleLoadTask = (problem: object, label?: string) => {
    if (label) setTaskLabel(label);
    const p = problem as TransportProblem;
    if (!p.supply || !p.demand || !p.costs) return;
    const m = p.supply.length;
    const n = p.demand.length;
    setNumSources(m);
    setNumDests(n);
    const fields: Record<string, number> = {};
    p.supply.forEach((v, i) => { fields[`s_${i}`] = v; });
    p.demand.forEach((v, j) => { fields[`d_${j}`] = v; });
    p.costs.forEach((row, i) => row.forEach((v, j) => { fields[`c_${i}_${j}`] = v; }));
    form.setFieldsValue(fields);
  };

  const handleFinish = async (values: any) => {
    const supply: number[] = Array.from({ length: numSources }, (_, i) => values[`s_${i}`] ?? 0);
    const demand: number[] = Array.from({ length: numDests }, (_, j) => values[`d_${j}`] ?? 0);
    const costs: number[][] = Array.from({ length: numSources }, (_, i) =>
      Array.from({ length: numDests }, (_, j) => values[`c_${i}_${j}`] ?? 0)
    );

    setLastProblem({ supply, demand, costs });
    setLoading(true);
    setResult(null);
    setMistakes(0);
    try {
      const res = await solveTransport({ supply, demand, costs });
      setResult(res);
      if (res.status === "optimal") {
        recordAttempt({ type: "transport", label: taskLabel, mistakes, hints: 0, solved: true });
      }
    } catch (e: any) {
      setResult({ status: "error", error: e?.message ?? "Помилка мережі" });
    } finally {
      setLoading(false);
    }
  };

  const totalSupply = lastProblem ? lastProblem.supply.reduce((a, b) => a + b, 0) : 0;
  const totalDemand = lastProblem ? lastProblem.demand.reduce((a, b) => a + b, 0) : 0;

  return (
    <div>
      <Title level={4} style={{ margin: "0 0 2px" }}>Транспортна задача</Title>
      <Text type="secondary" style={{ display: "block", fontSize: 13, marginBottom: 14 }}>
        Розв'язує транспортну задачу методом потенціалів з покроковою перевіркою плану перевезень.
      </Text>

      <TheoryPanel>
        <p style={{ marginBottom: 6 }}><strong>Математична модель:</strong></p>
        <p style={{ fontFamily: "monospace", background: "#f5f5f5", padding: "6px 10px", borderRadius: 4, marginBottom: 10 }}>
          z = Σ<sub>i</sub> Σ<sub>j</sub> c<sub>ij</sub> · x<sub>ij</sub> → min<br />
          Σ<sub>j</sub> x<sub>ij</sub> = a<sub>i</sub>{"  "}(запаси постачальника i)<br />
          Σ<sub>i</sub> x<sub>ij</sub> = b<sub>j</sub>{"  "}(потреби споживача j)<br />
          x<sub>ij</sub> ≥ 0
        </p>
        <p style={{ marginBottom: 6 }}>
          <strong>Умова збалансованості:</strong> Σa<sub>i</sub> = Σb<sub>j</sub>.
          Якщо ні — додається фіктивний постачальник або споживач із нульовими витратами.
        </p>
        <p style={{ marginBottom: 6 }}><strong>Алгоритм методу потенціалів:</strong></p>
        <ol style={{ paddingLeft: 18, marginBottom: 10 }}>
          <li>Знайти початковий допустимий план — <strong>метод північно-західного кута</strong> (заповнення з лівого верхнього кута)</li>
          <li>Знайти потенціали u<sub>i</sub>, v<sub>j</sub> з умови: u<sub>i</sub> + v<sub>j</sub> = c<sub>ij</sub> для базисних клітин (x<sub>ij</sub> &gt; 0)</li>
          <li>Обчислити оцінки небазисних клітин: Δ<sub>ij</sub> = c<sub>ij</sub> − u<sub>i</sub> − v<sub>j</sub></li>
          <li>Якщо всі Δ<sub>ij</sub> ≥ 0 — <strong>план оптимальний</strong></li>
          <li>Інакше: ввести в базис клітину з мінімальним Δ<sub>ij</sub></li>
          <li>Виконати <strong>перерозподіл по циклу</strong>: чергування «+θ / −θ» по замкнутому контуру</li>
          <li>Повторити з кроку 2</li>
        </ol>
        <p>
          <strong>Кількість базисних клітин</strong> у невиродженому плані: m + n − 1
          (де m — постачальники, n — споживачі).
        </p>
      </TheoryPanel>

      <TaskSelector taskType="transport" onLoad={handleLoadTask} />

      <Card size="small" style={{ marginTop: 0 }}>
        <Form form={form} layout="vertical" onFinish={handleFinish} size="small">
          {/* Source / Destination count controls */}
          <Row gutter={16} style={{ marginBottom: 4 }}>
            <Col>
              <Form.Item
                label={
                  <Space size={4}>
                    Постачальники (m)
                    <Tooltip title="Кількість постачальників — рядки матриці витрат. Кожен має певний запас товару Aᵢ">
                      <QuestionCircleOutlined style={{ color: "#8c8c8c", cursor: "help" }} />
                    </Tooltip>
                  </Space>
                }
                style={{ marginBottom: 8 }}
              >
                <Space size={4}>
                  <Button icon={<MinusOutlined />} size="small" disabled={numSources <= 2}
                    onClick={() => setNumSources((v) => v - 1)} />
                  <Text strong style={{ width: 20, textAlign: "center", display: "inline-block" }}>
                    {numSources}
                  </Text>
                  <Button icon={<PlusOutlined />} size="small" disabled={numSources >= 10}
                    onClick={() => setNumSources((v) => v + 1)} />
                </Space>
              </Form.Item>
            </Col>
            <Col>
              <Form.Item
                label={
                  <Space size={4}>
                    Споживачі (n)
                    <Tooltip title="Кількість споживачів — стовпці матриці витрат. Кожен має певну потребу Bⱼ">
                      <QuestionCircleOutlined style={{ color: "#8c8c8c", cursor: "help" }} />
                    </Tooltip>
                  </Space>
                }
                style={{ marginBottom: 8 }}
              >
                <Space size={4}>
                  <Button icon={<MinusOutlined />} size="small" disabled={numDests <= 2}
                    onClick={() => setNumDests((v) => v - 1)} />
                  <Text strong style={{ width: 20, textAlign: "center", display: "inline-block" }}>
                    {numDests}
                  </Text>
                  <Button icon={<PlusOutlined />} size="small" disabled={numDests >= 10}
                    onClick={() => setNumDests((v) => v + 1)} />
                </Space>
              </Form.Item>
            </Col>
          </Row>

          {/* Supply + Demand side by side */}
          <Row gutter={24}>
            <Col>
              <Space size={4}>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Запаси (A)</Text>
                <Tooltip title="Aᵢ — кількість одиниць товару, яку може відвантажити постачальник i. Сума запасів має дорівнювати сумі потреб (умова збалансованості)">
                  <QuestionCircleOutlined style={{ color: "#8c8c8c", fontSize: 12, cursor: "help" }} />
                </Tooltip>
              </Space>
              <Row gutter={6} style={{ marginTop: 4 }}>
                {Array.from({ length: numSources }, (_, i) => (
                  <Col key={i}>
                    <Form.Item name={`s_${i}`} label={`A${i + 1}`} initialValue={0} style={{ marginBottom: 6 }}>
                      <InputNumber min={0} style={{ width: 64 }} />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </Col>
            <Col>
              <Space size={4}>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Потреби (B)</Text>
                <Tooltip title="Bⱼ — кількість одиниць товару, яку потребує споживач j. Якщо ΣA ≠ ΣB, буде автоматично доданий фіктивний постачальник або споживач з нульовими витратами">
                  <QuestionCircleOutlined style={{ color: "#8c8c8c", fontSize: 12, cursor: "help" }} />
                </Tooltip>
              </Space>
              <Row gutter={6} style={{ marginTop: 4 }}>
                {Array.from({ length: numDests }, (_, j) => (
                  <Col key={j}>
                    <Form.Item name={`d_${j}`} label={`B${j + 1}`} initialValue={0} style={{ marginBottom: 6 }}>
                      <InputNumber min={0} style={{ width: 64 }} />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </Col>
          </Row>

          {/* Cost matrix */}
          <Space size={4}>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Матриця витрат C</Text>
            <Tooltip title="cᵢⱼ — вартість перевезення однієї одиниці товару від постачальника i до споживача j. Алгоритм мінімізує загальну вартість z = Σ cᵢⱼ · xᵢⱼ">
              <QuestionCircleOutlined style={{ color: "#8c8c8c", fontSize: 12, cursor: "help" }} />
            </Tooltip>
          </Space>
          <div style={{ marginTop: 6 }}>
            {Array.from({ length: numSources }, (_, i) => (
              <Row key={i} gutter={6} align="middle" style={{ marginBottom: 0 }}>
                <Col style={{ width: 36 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>A{i + 1}</Text>
                </Col>
                {Array.from({ length: numDests }, (_, j) => (
                  <Col key={j}>
                    <Form.Item name={`c_${i}_${j}`} initialValue={0}
                      label={i === 0 ? `B${j + 1}` : " "}
                      style={{ marginBottom: 4 }}>
                      <InputNumber min={0} style={{ width: 60 }} />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            ))}
          </div>

          <Form.Item style={{ marginTop: 12, marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading}>
              Розв'язати
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {loading && (
        <div style={{ textAlign: "center", padding: 20 }}>
          <Spin size="large" />
        </div>
      )}

      {result && result.status === "error" && (
        <Alert type="error" message={result.error} style={{ marginTop: 12 }} showIcon />
      )}

      {result && result.status === "optimal" && lastProblem && (
        <div style={{ marginTop: 12 }}>
          {/* Balance notice */}
          {(result.dummy_row || result.dummy_col) && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={
                result.dummy_col
                  ? `Задача незбалансована: запаси (${totalSupply}) > попит (${totalDemand}). Додано фіктивного споживача.`
                  : `Задача незбалансована: попит (${totalDemand}) > запаси (${totalSupply}). Додано фіктивного постачальника.`
              }
            />
          )}

          {/* Summary stats */}
          <Card size="small" style={{ marginBottom: 10 }}>
            <Row gutter={24}>
              <Col>
                <Statistic
                  title="Оптимальне значення цільової функції"
                  value={result.optimal_value}
                  precision={4}
                  valueStyle={{ color: "#1677ff", fontSize: 22 }}
                />
              </Col>
              <Col>
                <Statistic title="Кількість ітерацій" value={result.num_iterations} valueStyle={{ fontSize: 22 }} />
              </Col>
            </Row>
          </Card>

          {/* Optimal allocation */}
          <Card size="small" title="Оптимальний план перевезень" style={{ marginBottom: 10 }}>
            <table style={{ borderCollapse: "collapse", fontFamily: "monospace" }}>
              <thead>
                <tr>
                  <th style={{ padding: "4px 12px", borderBottom: "1px solid #eee" }}></th>
                  {lastProblem.demand.map((d, j) => (
                    <th key={j} style={{ padding: "4px 12px", borderBottom: "1px solid #eee" }}>
                      B{j + 1} ({d})
                    </th>
                  ))}
                  <th style={{ padding: "4px 12px", borderBottom: "1px solid #eee" }}>Запас</th>
                </tr>
              </thead>
              <tbody>
                {result.allocation!.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: "4px 12px", fontWeight: 600 }}>
                      A{i + 1} ({lastProblem.supply[i]})
                    </td>
                    {row.map((val, j) => (
                      <td
                        key={j}
                        style={{
                          padding: "4px 12px",
                          textAlign: "center",
                          background: val > 0 ? "#e6f4ff" : "transparent",
                          fontWeight: val > 0 ? 600 : 400,
                          color: val > 0 ? "#1677ff" : "#ccc",
                        }}
                      >
                        {val > 0 ? val : "·"}
                      </td>
                    ))}
                    <td style={{ padding: "4px 12px", textAlign: "center", fontWeight: 600 }}>
                      {lastProblem.supply[i]}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: "4px 12px", fontWeight: 600 }}>Попит</td>
                  {lastProblem.demand.map((d, j) => (
                    <td key={j} style={{ padding: "4px 12px", textAlign: "center", fontWeight: 600 }}>
                      {d}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </Card>

          {/* Mode toggle */}
          <Row align="middle" style={{ marginTop: 0, marginBottom: 10 }} gutter={12}>
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

          {stepByStep ? (
            <Card>
              <ProminentTransportStep
                key={currentStep}
                step={result.steps![currentStep]}
                stepIndex={currentStep}
                totalSteps={result.steps!.length}
                supply={lastProblem.supply}
                demand={lastProblem.demand}
                costs={lastProblem.costs}
                onPrev={() => setCurrentStep((c) => Math.max(c - 1, 0))}
                onNext={() => setCurrentStep((c) => Math.min(c + 1, result.steps!.length - 1))}
              />
              {result.steps![currentStep].u.some((v) => v !== null) && (
                <PotentialsChecker
                  key={`pot-${currentStep}`}
                  step={result.steps![currentStep]}
                  costs={lastProblem.costs}
                  supply={lastProblem.supply}
                  demand={lastProblem.demand}
                  onMistake={() => setMistakes((m) => m + 1)}
                />
              )}
            </Card>
          ) : (
            <Collapse accordion style={{ marginTop: 0 }}>
              {result.steps!.map((step, idx) => (
                <Collapse.Panel
                  key={idx}
                  header={
                    <Space>
                      <Tag color={
                        step.description.includes("Початков") ? "default" :
                        step.description.includes("Оптимальн") ? "success" : "processing"
                      }>
                        Крок {idx + 1}
                      </Tag>
                      {step.description}
                      {step.entering_cell && (
                        <Tag color="orange">
                          Вхідна: ({step.entering_cell[0] + 1},{step.entering_cell[1] + 1})
                        </Tag>
                      )}
                    </Space>
                  }
                >
                  <TransportTable
                    step={step}
                    supply={lastProblem.supply}
                    demand={lastProblem.demand}
                    costs={lastProblem.costs}
                  />
                  {step.loop && (
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">
                        Цикл покращення:{" "}
                        {step.loop.map(([r, c], k) => (
                          <Tag key={k} color={k % 2 === 0 ? "blue" : "red"}>
                            ({r + 1},{c + 1}) {k % 2 === 0 ? "+" : "−"}
                          </Tag>
                        ))}
                      </Text>
                    </div>
                  )}
                </Collapse.Panel>
              ))}
            </Collapse>
          )}
        </div>
      )}
    </div>
  );
};

export default TransportSolver;
