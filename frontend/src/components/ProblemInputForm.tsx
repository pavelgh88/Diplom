import React, { forwardRef, useImperativeHandle, useState } from "react";
import {
  Form,
  InputNumber,
  Button,
  Radio,
  Space,
  Tooltip,
  Typography,
  Row,
  Col,
  Divider,
} from "antd";
import { PlusOutlined, MinusOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import type { LPProblem } from "../types";

const { Text } = Typography;

export interface ProblemInputFormHandle {
  loadProblem: (problem: LPProblem) => void;
}

interface Props {
  onSolve: (problem: LPProblem) => void;
  loading: boolean;
  showBounds?: boolean;
}

const ProblemInputForm = forwardRef<ProblemInputFormHandle, Props>(
  ({ onSolve, loading, showBounds }, ref) => {
    const [numVars, setNumVars] = useState(2);
    const [numConstraints, setNumConstraints] = useState(2);
    const [form] = Form.useForm();

    useImperativeHandle(ref, () => ({
      loadProblem(problem: LPProblem) {
        if (!problem.c || !problem.A || !problem.b) return;
        const nv = problem.c.length;
        const nc = problem.A.length;
        setNumVars(nv);
        setNumConstraints(nc);

        const fields: Record<string, any> = {
          maximize: problem.maximize ?? false,
        };
        problem.c.forEach((v, j) => { fields[`c_${j}`] = v; });
        problem.A.forEach((row, i) => {
          row.forEach((v, j) => { fields[`a_${i}_${j}`] = v; });
        });
        problem.b.forEach((v, i) => { fields[`b_${i}`] = v; });
        if (showBounds && problem.bounds) {
          problem.bounds.forEach(([lb, ub], j) => {
            fields[`lb_${j}`] = lb;
            fields[`ub_${j}`] = ub;
          });
        }

        form.setFieldsValue(fields);
      },
    }));

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
      <Form form={form} layout="vertical" onFinish={handleFinish} size="small" style={{ maxWidth: 680 }}>
        <Row gutter={16} style={{ marginBottom: 4 }}>
          <Col>
            <Form.Item
              label={
                <Space size={4}>
                  Змінні
                  <Tooltip title="Кількість невідомих x₁, x₂, …, xₙ — саме їхні значення алгоритм знаходить в процесі оптимізації">
                    <QuestionCircleOutlined style={{ color: "#8c8c8c", cursor: "help" }} />
                  </Tooltip>
                </Space>
              }
              style={{ marginBottom: 8 }}
            >
              <Space size={4}>
                <Button icon={<MinusOutlined />} size="small" disabled={numVars <= 1}
                  onClick={() => setNumVars((v) => v - 1)} />
                <Text strong style={{ width: 20, textAlign: "center", display: "inline-block" }}>
                  {numVars}
                </Text>
                <Button size="small" icon={<PlusOutlined />} onClick={() => setNumVars((v) => v + 1)} />
              </Space>
            </Form.Item>
          </Col>
          <Col>
            <Form.Item
              label={
                <Space size={4}>
                  Обмеження
                  <Tooltip title="Кількість умов виду a₁x₁ + … + aₙxₙ ≤ b, які визначають допустиму область розв'язків">
                    <QuestionCircleOutlined style={{ color: "#8c8c8c", cursor: "help" }} />
                  </Tooltip>
                </Space>
              }
              style={{ marginBottom: 8 }}
            >
              <Space size={4}>
                <Button icon={<MinusOutlined />} size="small" disabled={numConstraints <= 1}
                  onClick={() => setNumConstraints((c) => c - 1)} />
                <Text strong style={{ width: 20, textAlign: "center", display: "inline-block" }}>
                  {numConstraints}
                </Text>
                <Button size="small" icon={<PlusOutlined />} onClick={() => setNumConstraints((c) => c + 1)} />
              </Space>
            </Form.Item>
          </Col>
          <Col>
            <Form.Item
              label={
                <Space size={4}>
                  Напрям оптимізації
                  <Tooltip title="Мінімізація — знайти найменше значення ЦФ (наприклад, мінімальні витрати). Максимізація — знайти найбільше значення (наприклад, максимальний прибуток)">
                    <QuestionCircleOutlined style={{ color: "#8c8c8c", cursor: "help" }} />
                  </Tooltip>
                </Space>
              }
              name="maximize"
              initialValue={false}
              style={{ marginBottom: 8 }}
              normalize={(v) => v === "max"}
              getValueProps={(v) => ({ value: v ? "max" : "min" })}
            >
              <Radio.Group optionType="button" buttonStyle="solid" size="small">
                <Radio value="min">↓ Мінімізація</Radio>
                <Radio value="max">↑ Максимізація</Radio>
              </Radio.Group>
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" style={{ margin: "8px 0" }}>
          Цільова функція{" "}
          <Tooltip title="z = c₁x₁ + c₂x₂ + … + cₙxₙ. Введіть коефіцієнт cⱼ для кожної змінної. Наприклад, якщо ЦФ = 3x₁ + 5x₂, то c₁=3, c₂=5">
            <QuestionCircleOutlined style={{ color: "#8c8c8c", cursor: "help", fontSize: 13 }} />
          </Tooltip>
        </Divider>
        <Row gutter={6} align="middle">
          {Array.from({ length: numVars }, (_, j) => (
            <Col key={j}>
              <Form.Item
                name={`c_${j}`}
                label={`x${j + 1}`}
                initialValue={0}
                style={{ marginBottom: 4 }}
              >
                <InputNumber style={{ width: 68 }} />
              </Form.Item>
            </Col>
          ))}
        </Row>

        <Divider orientation="left" style={{ margin: "8px 0" }}>
          Обмеження (Ax ≤ b){" "}
          <Tooltip title="Кожен рядок — одне обмеження. Введіть коефіцієнти aᵢⱼ перед змінними та праву частину b. Наприклад: 2x₁ + x₂ ≤ 10 → a=[2,1], b=10">
            <QuestionCircleOutlined style={{ color: "#8c8c8c", cursor: "help", fontSize: 13 }} />
          </Tooltip>
        </Divider>
        {Array.from({ length: numConstraints }, (_, i) => (
          <Row key={i} gutter={6} align="middle" style={{ marginBottom: 0 }}>
            {Array.from({ length: numVars }, (_, j) => (
              <Col key={j}>
                <Form.Item name={`a_${i}_${j}`} label={j === 0 ? `#${i + 1}` : " "} initialValue={0} style={{ marginBottom: 4 }}>
                  <InputNumber style={{ width: 68 }} />
                </Form.Item>
              </Col>
            ))}
            <Col>
              <Form.Item label=" " style={{ marginBottom: 4 }}>
                <Text type="secondary">≤</Text>
              </Form.Item>
            </Col>
            <Col>
              <Form.Item name={`b_${i}`} label="b" initialValue={0} style={{ marginBottom: 4 }}>
                <InputNumber style={{ width: 68 }} />
              </Form.Item>
            </Col>
          </Row>
        ))}

        {showBounds && (
          <>
            <Divider orientation="left" style={{ margin: "8px 0" }}>
              Межі змінних{" "}
              <Tooltip title="lb (нижня межа) та ub (верхня межа) значень кожної змінної. За замовчуванням lb=0, ub=∞. Метод гілок і меж розгалужується саме в цих межах">
                <QuestionCircleOutlined style={{ color: "#8c8c8c", cursor: "help", fontSize: 13 }} />
              </Tooltip>
            </Divider>
            <Row gutter={6}>
              {Array.from({ length: numVars }, (_, j) => (
                <Col key={j}>
                  <Space size={4}>
                    <Form.Item name={`lb_${j}`} label={`lb(x${j + 1})`} initialValue={0} style={{ marginBottom: 4 }}>
                      <InputNumber style={{ width: 68 }} />
                    </Form.Item>
                    <Form.Item name={`ub_${j}`} label={`ub(x${j + 1})`} initialValue={null} style={{ marginBottom: 4 }}>
                      <InputNumber style={{ width: 68 }} placeholder="∞" />
                    </Form.Item>
                  </Space>
                </Col>
              ))}
            </Row>
          </>
        )}

        <Form.Item style={{ marginTop: 12, marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading}>
            Розв'язати
          </Button>
        </Form.Item>
      </Form>
    );
  }
);

ProblemInputForm.displayName = "ProblemInputForm";

export default ProblemInputForm;
