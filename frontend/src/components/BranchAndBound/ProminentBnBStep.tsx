import React, { useState } from "react";
import { Badge, Button, Card, Col, Row, Space, Tag, Typography } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { checkBnBBranch } from "../../api/client";
import type { BnBNode, ValidatorResult } from "../../types";

const { Text } = Typography;

const fmt = (v: number) => {
  const r = Math.round(v * 10000) / 10000;
  return Number.isInteger(r) ? String(r) : r.toFixed(4).replace(/\.?0+$/, "");
};

const isFrac = (v: number) => Math.abs(v - Math.round(v)) > 1e-6;

const block = (color: string, bg: string): React.CSSProperties => ({
  border: `1px solid ${color}`,
  borderLeft: `4px solid ${color}`,
  background: bg,
  borderRadius: 6,
  padding: "10px 14px",
  marginBottom: 10,
  fontSize: 13,
  lineHeight: 1.7,
});

const STATUS_COLOR: Record<string, string> = {
  branched: "#1677ff",
  integer: "#52c41a",
  pruned: "#ff4d4f",
  infeasible: "#8c8c8c",
};

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

interface Props {
  node: BnBNode;
  nodeIndex: number;
  totalNodes: number;
  optimalValue: number;
  onPrev: () => void;
  onNext: () => void;
}

const ProminentBnBStep: React.FC<Props> = ({
  node, nodeIndex, totalNodes, optimalValue, onPrev, onNext,
}) => {
  const progress = ((nodeIndex + 1) / totalNodes) * 100;
  const color = STATUS_COLOR[node.status] ?? "#888";

  const [branchSelected, setBranchSelected] = useState<number | null>(null);
  const [branchChecking, setBranchChecking] = useState(false);
  const [branchResult, setBranchResult] = useState<ValidatorResult | null>(null);
  const [branchChecked, setBranchChecked] = useState(false);

  const [pruneAnswer, setPruneAnswer] = useState<"yes" | "no" | null>(null);
  const [pruneAnswered, setPruneAnswered] = useState(false);

  const handleBranchCheck = async () => {
    if (branchSelected === null || !node.solution) return;
    setBranchChecking(true);
    try {
      const res = await checkBnBBranch(node.solution, branchSelected);
      setBranchResult(res);
      setBranchChecked(true);
    } catch {
      // silent
    } finally {
      setBranchChecking(false);
    }
  };

  const branchCorrect = branchResult !== null && branchSelected === branchResult.correct_var;
  const fracVars = node.solution
    ? node.solution.map((v, i) => ({ v, i })).filter(({ v }) => isFrac(v))
    : [];

  return (
    <div>
      {/* Progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Text strong style={{ fontSize: 14 }}>Вузол {nodeIndex + 1} з {totalNodes}</Text>
          <Badge status={STATUS_BADGE[node.status]} text={STATUS_LABEL[node.status]} />
        </div>
        <div style={{ height: 7, background: "#f0f0f0", borderRadius: 4 }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: color, borderRadius: 4, transition: "width 0.35s ease",
          }} />
        </div>
      </div>

      {/* Subproblem */}
      <div style={block("#d9d9d9", "#fafafa")}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>📋 Підзадача (вузол #{node.id}, глибина {node.depth})</div>
        <div>
          <strong>Додаткове обмеження:</strong>{" "}
          {node.label === "LP-релаксація"
            ? <Text type="secondary">вихідна задача без додаткових обмежень</Text>
            : <Tag color="blue" style={{ fontFamily: "monospace", fontSize: 13 }}>{node.label}</Tag>
          }
        </div>
        <div style={{ marginTop: 6, fontSize: 12 }}>
          <strong>Поточні межі змінних:</strong>{" "}
          {node.bounds.map(([lb, ub], i) => (
            <Tag key={i} style={{ fontFamily: "monospace", fontSize: 11 }}>
              x<sub>{i + 1}</sub>: [{lb}, {ub ?? "∞"}]
            </Tag>
          ))}
        </div>
      </div>

      {/* LP result */}
      {node.lp_value !== null ? (
        <div style={block("#91caff", "#e6f4ff")}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>🔢 Розв'язок LP-релаксації</div>
          <div style={{ marginBottom: 4 }}>
            Відкидаємо вимогу цілочисловості і розв'язуємо звичайну задачу ЗЛП.
          </div>
          <div>
            <strong>LP-значення:</strong>{" "}
            <span style={{ fontFamily: "monospace", fontSize: 15, color: "#1677ff", fontWeight: 700 }}>
              {fmt(node.lp_value)}
            </span>
          </div>
          {node.solution && (
            <div style={{ marginTop: 6 }}>
              <strong>Вектор розв'язку:</strong>{" "}
              {node.solution.map((v, i) => (
                <span key={i} style={{ marginRight: 14 }}>
                  x<sub>{i + 1}</sub> ={" "}
                  <strong style={{
                    fontFamily: "monospace",
                    color: isFrac(v) ? "#fa8c16" : "#389e0d",
                  }}>
                    {fmt(v)}
                  </strong>
                  {isFrac(v) && (
                    <Tag color="orange" style={{ marginLeft: 3, fontSize: 10 }}>дробове</Tag>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={block("#8c8c8c", "#f5f5f5")}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>🔢 LP-релаксація</div>
          <div>LP-задача з даними обмеженнями <strong>не має допустимого розв'язку</strong> — область порожня.</div>
        </div>
      )}

      {/* Decision */}
      {node.status === "infeasible" && (
        <div style={block("#8c8c8c", "#f5f5f5")}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>✖ Рішення: відсікаємо (порожня область)</div>
          <div>Область допустимих розв'язків цієї підзадачі порожня — <strong>жодне ціле рішення тут неможливе</strong>. Гілка повністю відкидається.</div>
        </div>
      )}

      {node.status === "pruned" && (
        <div style={{
          border: `1.5px dashed ${pruneAnswered ? (pruneAnswer === "yes" ? "#52c41a" : "#ff4d4f") : "#ff7875"}`,
          borderRadius: 8,
          padding: "12px 16px",
          background: pruneAnswered ? (pruneAnswer === "yes" ? "#f6ffed" : "#fff1f0") : "#fff1f0",
          marginBottom: 10,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
            ✂️ Спробуй сам: чи потрібно відсікти цю гілку?
          </div>
          {!pruneAnswered ? (
            <>
              <div style={{ fontSize: 12, color: "#595959", marginBottom: 10 }}>
                LP-значення цього вузла:{" "}
                <strong style={{ fontFamily: "monospace", color: "#1677ff" }}>{fmt(node.lp_value!)}</strong>.{" "}
                Поточний цілочисловий рекорд:{" "}
                <strong style={{ fontFamily: "monospace", color: "#52c41a" }}>{fmt(optimalValue)}</strong>.
                <br />
                Чи може ця гілка дати кращий результат?
              </div>
              <Space>
                <Button
                  size="small"
                  type={pruneAnswer === "yes" ? "primary" : "default"}
                  danger={pruneAnswer === "yes"}
                  onClick={() => setPruneAnswer("yes")}
                >
                  Ні, відсікаємо гілку
                </Button>
                <Button
                  size="small"
                  type={pruneAnswer === "no" ? "primary" : "default"}
                  onClick={() => setPruneAnswer("no")}
                >
                  Так, продовжуємо
                </Button>
                <Button
                  size="small"
                  type="primary"
                  disabled={pruneAnswer === null}
                  onClick={() => setPruneAnswered(true)}
                >
                  Перевірити
                </Button>
              </Space>
            </>
          ) : pruneAnswer === "yes" ? (
            <div style={{ fontSize: 13 }}>
              <div style={{ color: "#389e0d", marginBottom: 8 }}>
                ✅ <strong>Правильно!</strong> Цю гілку слід відсікти.
              </div>
              <div style={{ color: "#595959" }}>
                LP = <strong style={{ fontFamily: "monospace" }}>{fmt(node.lp_value!)}</strong> ≤ рекорд{" "}
                <strong style={{ fontFamily: "monospace" }}>{fmt(optimalValue)}</strong>.{" "}
                Навіть якщо LP-розв'язок округлити до цілих — він не може перевищити вже знайдений рекорд.
                Розгалужуватись далі немає сенсу.
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13 }}>
              <div style={{ color: "#cf1322", marginBottom: 8 }}>
                ❌ <strong>Неправильно.</strong> Цю гілку слід відсікти.
              </div>
              <div style={{ color: "#595959" }}>
                LP = <strong style={{ fontFamily: "monospace" }}>{fmt(node.lp_value!)}</strong> ≤ рекорд{" "}
                <strong style={{ fontFamily: "monospace" }}>{fmt(optimalValue)}</strong>.{" "}
                LP-значення є <em>верхньою межею</em> для будь-якого цілого розв'язку в цій гілці.
                Оскільки вона не перевищує рекорд, продовження безглуздо.
              </div>
            </div>
          )}
        </div>
      )}

      {node.status === "integer" && (
        <div style={block("#52c41a", "#f6ffed")}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>✓ Рішення: знайдено цілочисловий розв'язок!</div>
          <div>Всі змінні мають <strong>цілі значення</strong> — умова цілочисловості виконана.</div>
          <div style={{ marginTop: 6, fontSize: 14 }}>
            <strong>Оновлено рекорд:</strong>{" "}
            <span style={{ fontFamily: "monospace", color: "#52c41a", fontWeight: 700, fontSize: 16 }}>
              {fmt(node.lp_value!)}
            </span>
          </div>
          <div style={{ marginTop: 4 }}>
            {node.solution?.map((v, i) => (
              <span key={i} style={{ marginRight: 14 }}>
                x<sub>{i + 1}</sub> = <strong style={{ fontFamily: "monospace" }}>{Math.round(v)}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {node.status === "branched" && fracVars.length > 0 && node.solution && (
        <div style={{
          border: `1.5px dashed ${branchResult ? (branchCorrect ? "#52c41a" : "#ff4d4f") : "#91caff"}`,
          borderRadius: 8,
          padding: "12px 16px",
          background: branchResult ? (branchCorrect ? "#f6ffed" : "#fff1f0") : "#f0f7ff",
          marginBottom: 10,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
            🎯 Спробуй сам: яку змінну обрати для розгалуження?
          </div>
          {!branchResult ? (
            <>
              <div style={{ fontSize: 12, color: "#595959", marginBottom: 8 }}>
                Яку змінну слід обрати для розгалуження? Подивись на вектор розв'язку вище та
                застосуй стратегію <strong>найдробовіша змінна</strong> (найближча дробова частина до 0.5):
              </div>
              <Space wrap style={{ marginBottom: 10 }}>
                {node.solution.map((_, i) => (
                  <Button
                    key={i}
                    size="small"
                    type={branchSelected === i ? "primary" : "default"}
                    style={{ fontFamily: "monospace", minWidth: 48 }}
                    onClick={() => setBranchSelected(i)}
                  >
                    {`x${i + 1}`}
                  </Button>
                ))}
              </Space>
              <div>
                <Button
                  size="small"
                  type="primary"
                  disabled={branchSelected === null}
                  loading={branchChecking}
                  onClick={handleBranchCheck}
                >
                  Перевірити
                </Button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13 }}>
              {branchCorrect ? (
                <span style={{ color: "#389e0d" }}>
                  ✅ <strong>Правильно!</strong> x{branchSelected! + 1} — найближча до 0.5 дробова змінна, тому розгалужуємось по ній.
                </span>
              ) : (
                <span style={{ color: "#cf1322" }}>
                  ❌ Ти обрав x{branchSelected! + 1}, але правильна відповідь — x{(branchResult.correct_var ?? 0) + 1}.
                  {branchResult.hint && (
                    <div style={{ marginTop: 6, color: "#595959", fontSize: 12 }}>💡 {branchResult.hint}</div>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {node.status === "branched" && node.branch_var !== undefined && branchChecked && (
        <div style={block("#1677ff", "#e6f4ff")}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>🔀 Рішення: розгалуження</div>
          <div>
            Змінна{" "}
            <strong>x<sub>{node.branch_var + 1}</sub> = {fmt(node.branch_value!)}</strong>{" "}
            — дробове значення. Обираємо її для розгалуження, оскільки вона{" "}
            найближча до 0.5 (максимальна невизначеність).
          </div>

          {/* Why this variable — fractional parts compared */}
          {fracVars.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12 }}>
              <div style={{ marginBottom: 4 }}>Чому саме ця змінна — порівнюємо дробові частини (обираємо найближчу до 0.5):</div>
              <table style={{ borderCollapse: "collapse", fontFamily: "monospace", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: "#8c8c8c" }}>
                    {["Змінна", "значення", "дробова частина", "|частка − 0.5|"].map((h) => (
                      <th key={h} style={{ padding: "3px 10px", borderBottom: "1px solid #d6e4ff", textAlign: "center", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fracVars.map(({ v, i }) => {
                    const frac = v - Math.floor(v);
                    const dist = Math.abs(frac - 0.5);
                    const chosen = i === node.branch_var;
                    return (
                      <tr key={i} style={{ background: chosen ? "#bae0ff" : "transparent", fontWeight: chosen ? 700 : 400 }}>
                        <td style={{ padding: "3px 10px", textAlign: "center" }}>
                          x{i + 1}{chosen && <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>← обрана</Tag>}
                        </td>
                        <td style={{ padding: "3px 10px", textAlign: "center" }}>{fmt(v)}</td>
                        <td style={{ padding: "3px 10px", textAlign: "center" }}>{fmt(frac)}</td>
                        <td style={{ padding: "3px 10px", textAlign: "center", color: chosen ? "#1677ff" : undefined }}>
                          {fmt(dist)}{chosen && " (мін)"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Row gutter={12} style={{ marginTop: 10 }}>
            <Col span={12}>
              <Card size="small" style={{ border: "1px solid #91caff", background: "#f0f7ff", textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1677ff", marginBottom: 4 }}>
                  ← Ліва гілка
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 14 }}>
                  x<sub>{node.branch_var + 1}</sub> ≤ {Math.floor(node.branch_value!)}
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  ⌊{fmt(node.branch_value!)}⌋ = {Math.floor(node.branch_value!)}
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" style={{ border: "1px solid #91caff", background: "#f0f7ff", textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1677ff", marginBottom: 4 }}>
                  Права гілка →
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 14 }}>
                  x<sub>{node.branch_var + 1}</sub> ≥ {Math.ceil(node.branch_value!)}
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  ⌈{fmt(node.branch_value!)}⌉ = {Math.ceil(node.branch_value!)}
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "center", alignItems: "center" }}>
        <Button icon={<LeftOutlined />} onClick={onPrev} disabled={nodeIndex === 0}>
          Попередній
        </Button>
        <Text type="secondary" style={{ minWidth: 70, textAlign: "center", fontSize: 13 }}>
          {nodeIndex + 1} / {totalNodes}
        </Text>
        {nodeIndex < totalNodes - 1 ? (
          <Button type="primary" icon={<RightOutlined />} iconPosition="end" onClick={onNext}>
            Наступний вузол
          </Button>
        ) : (
          <Button style={{ background: "#52c41a", borderColor: "#52c41a", color: "#fff" }} disabled>
            ✓ Обхід завершено
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProminentBnBStep;
