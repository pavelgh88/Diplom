import React, { useState } from "react";
import {
  Form,
  InputNumber,
  Button,
  Switch,
  Space,
  Typography,
  Row,
  Col,
  Divider,
} from "antd";
import { PlusOutlined, MinusOutlined } from "@ant-design/icons";
import type { LPProblem } from "../types";

const { Text } = Typography;

interface Props {
  onSolve: (problem: LPProblem) => void;
  loading: boolean;
  showBounds?: boolean;
}

const ProblemInputForm: React.FC<Props> = ({ onSolve, loading, showBounds }) => {
  const [numVars, setNumVars] = useState(2);
  const [numConstraints, setNumConstraints] = useState(2);
  const [form] = Form.useForm();

  const handleFinish = (values: any) => {
    const c: number[] = Array.from({ length: numVars }, (_, j) => values[`c_${j}`] ?? 0);
    const A: number[][] = Array.from({ length: numConstraints }, (_, i) =>
      Array.from({ length: numVars }, (_, j) => values[`a_${i}_${j}`] ?? 0)
    );
    const b: number[] = Array.from({ length: numConstraints }, (_, i) => values[`b_${i}`] ?? 0);
    const maximize: boolean = values.maximize ?? false;
    const bounds: [number, number | null][] | undefined = showBounds
      ? Array.from({ length: numVars }, (_, j) => [values[`lb_${j}`] ?? 0, values[`ub_${j}`] ?? null])
      : undefined;

    onSolve({ c, A, b, maximize, bounds });
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleFinish} style={{ maxWidth: 720 }}>
      {/* Variable / constraint count */}
      <Row gutter={24}>
        <Col>
          <Form.Item label="Кількість змінних">
            <Space>
              <Button
                icon={<MinusOutlined />}
                disabled={numVars <= 1}
                onClick={() => setNumVars((v) => v - 1)}
              />
              <Text strong style={{ width: 24, textAlign: "center", display: "inline-block" }}>
                {numVars}
              </Text>
              <Button icon={<PlusOutlined />} onClick={() => setNumVars((v) => v + 1)} />
            </Space>
          </Form.Item>
        </Col>
        <Col>
          <Form.Item label="Кількість обмежень">
            <Space>
              <Button
                icon={<MinusOutlined />}
                disabled={numConstraints <= 1}
                onClick={() => setNumConstraints((c) => c - 1)}
              />
              <Text strong style={{ width: 24, textAlign: "center", display: "inline-block" }}>
                {numConstraints}
              </Text>
              <Button icon={<PlusOutlined />} onClick={() => setNumConstraints((c) => c + 1)} />
            </Space>
          </Form.Item>
        </Col>
        <Col>
          <Form.Item label="Напрям" name="maximize" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="max" unCheckedChildren="min" />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left">Цільова функція</Divider>
      <Row gutter={8} align="middle">
        {Array.from({ length: numVars }, (_, j) => (
          <Col key={j}>
            <Form.Item
              name={`c_${j}`}
              label={`x${j + 1}`}
              initialValue={0}
              style={{ marginBottom: 0 }}
            >
              <InputNumber style={{ width: 80 }} />
            </Form.Item>
          </Col>
        ))}
      </Row>

      <Divider orientation="left">Обмеження (Ax ≤ b)</Divider>
      {Array.from({ length: numConstraints }, (_, i) => (
        <Row key={i} gutter={8} align="middle" style={{ marginBottom: 8 }}>
          {Array.from({ length: numVars }, (_, j) => (
            <Col key={j}>
              <Form.Item name={`a_${i}_${j}`} label={j === 0 ? `#${i + 1}` : " "} initialValue={0}>
                <InputNumber style={{ width: 72 }} />
              </Form.Item>
            </Col>
          ))}
          <Col>
            <Form.Item label={" "}>
              <Text type="secondary">≤</Text>
            </Form.Item>
          </Col>
          <Col>
            <Form.Item name={`b_${i}`} label={"b"} initialValue={0}>
              <InputNumber style={{ width: 72 }} />
            </Form.Item>
          </Col>
        </Row>
      ))}

      {showBounds && (
        <>
          <Divider orientation="left">Межі змінних (для МГМ)</Divider>
          <Row gutter={8}>
            {Array.from({ length: numVars }, (_, j) => (
              <Col key={j}>
                <Space>
                  <Form.Item name={`lb_${j}`} label={`lb(x${j + 1})`} initialValue={0}>
                    <InputNumber style={{ width: 72 }} />
                  </Form.Item>
                  <Form.Item name={`ub_${j}`} label={`ub(x${j + 1})`} initialValue={null}>
                    <InputNumber style={{ width: 72 }} placeholder="∞" />
                  </Form.Item>
                </Space>
              </Col>
            ))}
          </Row>
        </>
      )}

      <Form.Item style={{ marginTop: 16 }}>
        <Button type="primary" htmlType="submit" loading={loading} size="large">
          Розв'язати
        </Button>
      </Form.Item>
    </Form>
  );
};

export default ProblemInputForm;
