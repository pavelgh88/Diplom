import React, { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Divider,
  Form,
  InputNumber,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from "antd";
import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { solveTransport } from "../../api/client";
import TransportTable from "./TransportTable";
import type { TransportResult } from "../../types";

const { Title, Text } = Typography;

const TransportSolver: React.FC = () => {
  const [numSources, setNumSources] = useState(3);
  const [numDests, setNumDests] = useState(3);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TransportResult | null>(null);
  const [lastProblem, setLastProblem] = useState<{
    supply: number[];
    demand: number[];
    costs: number[][];
  } | null>(null);

  const handleFinish = async (values: any) => {
    const supply: number[] = Array.from({ length: numSources }, (_, i) => values[`s_${i}`] ?? 0);
    const demand: number[] = Array.from({ length: numDests }, (_, j) => values[`d_${j}`] ?? 0);
    const costs: number[][] = Array.from({ length: numSources }, (_, i) =>
      Array.from({ length: numDests }, (_, j) => values[`c_${i}_${j}`] ?? 0)
    );

    setLastProblem({ supply, demand, costs });
    setLoading(true);
    setResult(null);
    try {
      const res = await solveTransport({ supply, demand, costs });
      setResult(res);
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
      <Card title="Параметри транспортної задачі">
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          {/* Source / Destination count controls */}
          <Row gutter={24}>
            <Col>
              <Form.Item label="Постачальники (m)">
                <Space>
                  <Button icon={<MinusOutlined />} disabled={numSources <= 2}
                    onClick={() => setNumSources((v) => v - 1)} />
                  <Text strong style={{ width: 24, textAlign: "center", display: "inline-block" }}>
                    {numSources}
                  </Text>
                  <Button icon={<PlusOutlined />} disabled={numSources >= 10}
                    onClick={() => setNumSources((v) => v + 1)} />
                </Space>
              </Form.Item>
            </Col>
            <Col>
              <Form.Item label="Споживачі (n)">
                <Space>
                  <Button icon={<MinusOutlined />} disabled={numDests <= 2}
                    onClick={() => setNumDests((v) => v - 1)} />
                  <Text strong style={{ width: 24, textAlign: "center", display: "inline-block" }}>
                    {numDests}
                  </Text>
                  <Button icon={<PlusOutlined />} disabled={numDests >= 10}
                    onClick={() => setNumDests((v) => v + 1)} />
                </Space>
              </Form.Item>
            </Col>
          </Row>

          {/* Supply vector */}
          <Divider orientation="left">Запаси постачальників</Divider>
          <Row gutter={8}>
            {Array.from({ length: numSources }, (_, i) => (
              <Col key={i}>
                <Form.Item name={`s_${i}`} label={`A${i + 1}`} initialValue={10}>
                  <InputNumber min={0} style={{ width: 80 }} />
                </Form.Item>
              </Col>
            ))}
          </Row>

          {/* Demand vector */}
          <Divider orientation="left">Потреби споживачів</Divider>
          <Row gutter={8}>
            {Array.from({ length: numDests }, (_, j) => (
              <Col key={j}>
                <Form.Item name={`d_${j}`} label={`B${j + 1}`} initialValue={10}>
                  <InputNumber min={0} style={{ width: 80 }} />
                </Form.Item>
              </Col>
            ))}
          </Row>

          {/* Cost matrix */}
          <Divider orientation="left">Матриця транспортних витрат</Divider>
          {Array.from({ length: numSources }, (_, i) => (
            <Row key={i} gutter={8} align="middle" style={{ marginBottom: 8 }}>
              <Col style={{ width: 48 }}>
                <Text type="secondary">A{i + 1}</Text>
              </Col>
              {Array.from({ length: numDests }, (_, j) => (
                <Col key={j}>
                  <Form.Item name={`c_${i}_${j}`} initialValue={1}
                    label={i === 0 ? `B${j + 1}` : " "}>
                    <InputNumber min={0} style={{ width: 72 }} />
                  </Form.Item>
                </Col>
              ))}
            </Row>
          ))}

          <Form.Item style={{ marginTop: 16 }}>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              Розв'язати
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {loading && (
        <div style={{ textAlign: "center", padding: 32 }}>
          <Spin size="large" />
        </div>
      )}

      {result && result.status === "error" && (
        <Alert type="error" message={result.error} style={{ marginTop: 16 }} showIcon />
      )}

      {result && result.status === "optimal" && lastProblem && (
        <div style={{ marginTop: 16 }}>
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
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={32}>
              <Col>
                <Statistic
                  title="Оптимальне значення цільової функції"
                  value={result.optimal_value}
                  precision={4}
                  valueStyle={{ color: "#1677ff" }}
                />
              </Col>
              <Col>
                <Statistic title="Кількість ітерацій" value={result.num_iterations} />
              </Col>
            </Row>
          </Card>

          {/* Optimal allocation */}
          <Card title="Оптимальний план перевезень" style={{ marginBottom: 16 }}>
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

          {/* Step-by-step */}
          <Title level={5}>Покрокове розв'язання</Title>
          <Collapse accordion style={{ marginTop: 8 }}>
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
        </div>
      )}
    </div>
  );
};

export default TransportSolver;
