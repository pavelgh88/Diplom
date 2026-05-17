import React, { useRef, useState } from "react";
import { Alert, Card, Collapse, Statistic, Row, Col, Typography, Spin } from "antd";
import ProblemInputForm from "../ProblemInputForm";
import type { ProblemInputFormHandle } from "../ProblemInputForm";
import SimplexTable from "./SimplexTable";
import TaskSelector from "../TaskSelector";
import { solveSimplex } from "../../api/client";
import type { LPProblem, SimplexResult } from "../../types";

const { Title, Text } = Typography;

const SimplexSolver: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimplexResult | null>(null);
  const formRef = useRef<ProblemInputFormHandle | null>(null);

  const handleSolve = async (problem: LPProblem) => {
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

  return (
    <div>
      <Title level={4}>Симплекс-метод</Title>
      <Text type="secondary">
        Розв'язує задачу лінійного програмування покроково із відображенням симплекс-таблиці на кожній ітерації.
      </Text>

      <TaskSelector taskType="simplex" onLoad={handleLoadTask} />

      <Card style={{ marginTop: 8 }}>
        <ProblemInputForm ref={formRef} onSolve={handleSolve} loading={loading} />
      </Card>

      {loading && (
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <Spin size="large" tip="Розв'язую..." />
        </div>
      )}

      {result && !loading && (
        <div style={{ marginTop: 24 }}>
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

              <Title level={5} style={{ marginTop: 24 }}>
                Покрокове розв'язання
              </Title>
              <Collapse
                defaultActiveKey={["0"]}
                items={result.steps?.map((step, idx) => ({
                  key: String(idx),
                  label: `Крок ${idx + 1}: ${step.description}`,
                  children: <SimplexTable step={step} stepIndex={idx} />,
                }))}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SimplexSolver;
