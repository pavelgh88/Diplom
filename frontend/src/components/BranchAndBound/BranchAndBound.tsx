import React, { useState } from "react";
import { Alert, Badge, Card, Col, Row, Spin, Statistic, Table, Typography } from "antd";
import ProblemInputForm from "../ProblemInputForm";
import BnBTree from "./BnBTree";
import { solveBranchAndBound } from "../../api/client";
import type { BnBResult, LPProblem } from "../../types";

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

const BranchAndBound: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BnBResult | null>(null);

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
    { title: "ID", dataIndex: "id", key: "id", width: 50 },
    {
      title: "Мітка",
      dataIndex: "label",
      key: "label",
    },
    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      render: (s: string) => <Badge status={STATUS_BADGE[s]} text={STATUS_LABEL[s]} />,
    },
    {
      title: "LP значення",
      dataIndex: "lp_value",
      key: "lp_value",
      render: (v: number | null) => (v !== null ? v.toFixed(4) : "—"),
    },
    {
      title: "Розв'язок",
      dataIndex: "solution",
      key: "solution",
      render: (sol: number[] | null) =>
        sol ? `[${sol.map((v) => v.toFixed(2)).join(", ")}]` : "—",
    },
  ];

  return (
    <div>
      <Title level={4}>Метод гілок і меж</Title>
      <Text type="secondary">
        Розв'язує цілочисельну задачу лінійного програмування методом гілок і меж з візуалізацією дерева перебору.
      </Text>

      <Card style={{ marginTop: 16 }}>
        <ProblemInputForm onSolve={handleSolve} loading={loading} showBounds />
      </Card>

      {loading && (
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <Spin size="large" tip="Будую дерево..." />
        </div>
      )}

      {result && !loading && (
        <div style={{ marginTop: 24 }}>
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

              <Title level={5} style={{ marginTop: 24 }}>
                Дерево гілок і меж
              </Title>
              {result.nodes && <BnBTree nodes={result.nodes} />}

              <Title level={5} style={{ marginTop: 24 }}>
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
