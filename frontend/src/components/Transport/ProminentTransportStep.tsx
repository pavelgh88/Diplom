import React, { useState } from "react";
import { Button, Space, Tag, Typography } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import TransportTable from "./TransportTable";
import type { TransportStep } from "../../types";

const { Text } = Typography;

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  const r = Math.round(v * 10000) / 10000;
  return Number.isInteger(r) ? String(r) : r.toFixed(4).replace(/\.?0+$/, "");
};

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

interface Props {
  step: TransportStep;
  stepIndex: number;
  totalSteps: number;
  supply: number[];
  demand: number[];
  costs: number[][];
  onPrev: () => void;
  onNext: () => void;
}

const ProminentTransportStep: React.FC<Props> = ({
  step, stepIndex, totalSteps, supply, demand, costs, onPrev, onNext,
}) => {
  const [cellSelected, setCellSelected] = useState<string | null>(null);
  const [cellAnswered, setCellAnswered] = useState(false);

  const isInitial = step.description.toLowerCase().includes("початков");
  const isOptimal = !isInitial && step.entering_cell === null;
  const isIteration = !isInitial && !isOptimal;

  const progress = ((stepIndex + 1) / totalSteps) * 100;
  const progressColor = isOptimal ? "#52c41a" : isInitial ? "#8c8c8c" : "#1677ff";

  const m = supply.length;
  const n = demand.length;

  // Collect negative deltas (non-basic cells)
  const basicSet = new Set(step.basic_cells.map(([r, c]) => `${r}_${c}`));
  const negativeCells: { i: number; j: number; delta: number }[] = [];
  if (step.delta) {
    step.delta.forEach((row, i) =>
      row.forEach((d, j) => {
        if (d !== null && d < -1e-9 && !basicSet.has(`${i}_${j}`)) {
          negativeCells.push({ i, j, delta: d });
        }
      })
    );
  }
  negativeCells.sort((a, b) => a.delta - b.delta);

  // Theta for cycle redistribution
  let theta: number | null = null;
  if (step.loop) {
    const minusVals = step.loop
      .filter((_, k) => k % 2 === 1)
      .map(([r, c]) => step.allocation[r][c]);
    if (minusVals.length > 0) theta = Math.min(...minusVals);
  }

  // u/v that are not null
  const knownU = step.u.map((v, i) => ({ i, v })).filter(({ v }) => v !== null);
  const knownV = step.v.map((v, j) => ({ j, v })).filter(({ v }) => v !== null);

  return (
    <div>
      {/* Progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Text strong style={{ fontSize: 14 }}>Крок {stepIndex + 1} з {totalSteps}</Text>
          <Tag color={isOptimal ? "success" : isInitial ? "default" : "processing"} style={{ fontSize: 12 }}>
            {step.description}
          </Tag>
        </div>
        <div style={{ height: 7, background: "#f0f0f0", borderRadius: 4 }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: progressColor, borderRadius: 4, transition: "width 0.35s ease",
          }} />
        </div>
      </div>

      {/* ── INITIAL STEP ── */}
      {isInitial && (
        <>
          <div style={block("#91caff", "#e6f4ff")}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>📋 Метод північно-західного кута</div>
            <div>Будуємо <strong>початковий допустимий план</strong> — заповнюємо матрицю перевезень, починаючи з верхнього лівого кута (1,1).</div>
            <div style={{ marginTop: 8 }}>
              <strong>Алгоритм:</strong>
              <ol style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12 }}>
                <li>x₁₁ = min(A₁, B₁) = min({supply[0]}, {demand[0]}) = <strong>{Math.min(supply[0], demand[0])}</strong></li>
                <li>Зменшуємо запас або потребу на x₁₁. Якщо запас вичерпано — переходимо на рядок нижче. Якщо потреба задоволена — переходимо на стовпець правіше.</li>
                <li>Повторюємо до заповнення останньої клітини.</li>
              </ol>
            </div>
          </div>
          <div style={block("#d9d9d9", "#fafafa")}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>ℹ️ Кількість базисних клітин</div>
            <div>
              Для незвиродненого плану: m + n − 1 ={" "}
              <strong>{m} + {n} − 1 = {m + n - 1}</strong>.
            </div>
            <div style={{ marginTop: 4 }}>
              Поточна кількість базисних клітин: <strong>{step.basic_cells.length}</strong>. Цей план ще <strong>не оптимальний</strong> — далі перевіряємо методом потенціалів.
            </div>
          </div>
        </>
      )}

      {/* ── ITERATION STEP ── */}
      {isIteration && (
        <>
          {/* Potentials */}
          <div style={block("#b37feb", "#f9f0ff")}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>🔮 Потенціали uᵢ і vⱼ</div>
            <div style={{ marginBottom: 6 }}>
              Для кожної <strong>базисної клітини</strong> (xᵢⱼ &gt; 0) має виконуватись:{" "}
              <strong>uᵢ + vⱼ = cᵢⱼ</strong>. Фіксуємо u₁ = 0 і знаходимо решту послідовно.
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <Text strong style={{ fontSize: 12 }}>Потенціали рядків (u):</Text>
                <div style={{ fontFamily: "monospace", marginTop: 2 }}>
                  {knownU.map(({ i, v }) => (
                    <div key={i}>
                      u<sub>{i + 1}</sub> = <strong>{fmt(v)}</strong>
                      {i === 0 && " (фіксовано = 0)"}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Text strong style={{ fontSize: 12 }}>Потенціали стовпців (v):</Text>
                <div style={{ fontFamily: "monospace", marginTop: 2 }}>
                  {knownV.map(({ j, v }) => (
                    <div key={j}>
                      v<sub>{j + 1}</sub> = <strong>{fmt(v)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Delta check */}
          <div style={block("#ffa940", "#fff7e6")}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>🔍 Оцінки небазисних клітин (Δᵢⱼ)</div>
            <div style={{ marginBottom: 6 }}>
              Для кожної небазисної клітини:{" "}
              <strong>Δᵢⱼ = cᵢⱼ − uᵢ − vⱼ</strong>.{" "}
              Якщо всі Δᵢⱼ ≥ 0 — план оптимальний. Якщо є Δ &lt; 0 — можна покращити.
            </div>
            {negativeCells.length > 0 ? (
              <>
                <div style={{ marginBottom: 4 }}>
                  ❌ Від'ємні оцінки (кандидати на покращення):
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {negativeCells.map(({ i, j, delta }) => (
                    <Tag key={`${i}_${j}`} color="orange" style={{ fontFamily: "monospace", fontSize: 12 }}>
                      Δ({i + 1},{j + 1}) = {fmt(delta)}
                      {step.entering_cell?.[0] === i && step.entering_cell?.[1] === j && (
                        <strong> ← мін</strong>
                      )}
                    </Tag>
                  ))}
                </div>
              </>
            ) : (
              <div>✅ Всі Δᵢⱼ ≥ 0 — план оптимальний.</div>
            )}
          </div>

          {/* Entering cell quiz */}
          {negativeCells.length > 0 && step.entering_cell && (() => {
            const correctKey = `${step.entering_cell[0]}_${step.entering_cell[1]}`;
            const isCorrect = cellSelected === correctKey;
            const selectedCell = cellSelected
              ? negativeCells.find(({ i, j }) => `${i}_${j}` === cellSelected)
              : null;
            return (
              <div style={{
                border: `1.5px dashed ${cellAnswered ? (isCorrect ? "#52c41a" : "#ff4d4f") : "#ffa940"}`,
                borderRadius: 8,
                padding: "12px 16px",
                background: cellAnswered ? (isCorrect ? "#f6ffed" : "#fff1f0") : "#fffbe6",
                marginBottom: 10,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
                  🎯 Спробуй сам: яку клітину обрати для входу в базис?
                </div>
                {!cellAnswered ? (
                  <>
                    <div style={{ fontSize: 12, color: "#595959", marginBottom: 8 }}>
                      Обери клітину з <strong>найменшим (найбільш від'ємним)</strong> значенням Δᵢⱼ:
                    </div>
                    <Space wrap style={{ marginBottom: 10 }}>
                      {negativeCells.map(({ i, j, delta }) => {
                        const key = `${i}_${j}`;
                        return (
                          <Button
                            key={key}
                            size="small"
                            type={cellSelected === key ? "primary" : "default"}
                            style={{ fontFamily: "monospace" }}
                            onClick={() => setCellSelected(key)}
                          >
                            A{i + 1}→B{j + 1} (Δ={fmt(delta)})
                          </Button>
                        );
                      })}
                    </Space>
                    <Button
                      size="small"
                      type="primary"
                      disabled={cellSelected === null}
                      onClick={() => setCellAnswered(true)}
                    >
                      Перевірити
                    </Button>
                  </>
                ) : (
                  <div style={{ fontSize: 13 }}>
                    {isCorrect ? (
                      <span style={{ color: "#389e0d" }}>
                        ✅ <strong>Правильно!</strong> Клітина ({step.entering_cell![0] + 1},{step.entering_cell![1] + 1}){" "}
                        має найменше Δ = <strong style={{ fontFamily: "monospace" }}>
                          {fmt(step.delta?.[step.entering_cell![0]]?.[step.entering_cell![1]])}
                        </strong> і входить до базису.
                      </span>
                    ) : (
                      <span style={{ color: "#cf1322" }}>
                        ❌ Обрано A{selectedCell!.i + 1}→B{selectedCell!.j + 1} (Δ={fmt(selectedCell!.delta)}),
                        але правильна відповідь —{" "}
                        <strong>A{step.entering_cell![0] + 1}→B{step.entering_cell![1] + 1}</strong>{" "}
                        (Δ = <strong style={{ fontFamily: "monospace" }}>
                          {fmt(step.delta?.[step.entering_cell![0]]?.[step.entering_cell![1]])}
                        </strong>) — це мінімальна оцінка серед від'ємних.
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Entering cell — revealed after quiz answered */}
          {cellAnswered && step.entering_cell && (
            <div style={block("#fa8c16", "#fff7e6")}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>📍 Вхідна клітина</div>
              <div>
                Обираємо клітину з <strong>найменшою оцінкою</strong> Δ:
              </div>
              <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 14 }}>
                Клітина ({step.entering_cell[0] + 1}, {step.entering_cell[1] + 1}){" "}
                — Δ = <strong style={{ color: "#d4380d" }}>
                  {fmt(step.delta?.[step.entering_cell[0]]?.[step.entering_cell[1]])}
                </strong>
                , c = {fmt(costs[step.entering_cell[0]]?.[step.entering_cell[1]])}
              </div>
              <div style={{ marginTop: 4, fontSize: 12 }}>
                Ця клітина <strong>входить до базису</strong> — перерозподіляємо вантаж по циклу.
              </div>
            </div>
          )}

          {/* Cycle — revealed after quiz answered */}
          {cellAnswered && step.loop && theta !== null && (
            <div style={block("#52c41a", "#f6ffed")}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>🔄 Цикл перерозподілу</div>
              <div style={{ marginBottom: 8 }}>
                Знаходимо замкнений цикл через базисні клітини.
                Чергуємо знаки: вхідна клітина (+), далі (−), (+), (−) …
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                {step.loop.map(([r, c], k) => (
                  <Tag
                    key={k}
                    color={k % 2 === 0 ? "blue" : "red"}
                    style={{ fontFamily: "monospace", fontSize: 12 }}
                  >
                    ({r + 1},{c + 1}) {k % 2 === 0 ? "+θ" : "−θ"}
                  </Tag>
                ))}
              </div>
              <div>
                θ = мінімальний вантаж серед клітин зі знаком «−»:{" "}
                <strong style={{ fontFamily: "monospace", fontSize: 14, color: "#389e0d" }}>
                  θ = {fmt(theta)}
                </strong>
              </div>
              <div style={{ marginTop: 4, fontSize: 12 }}>
                Клітина з вантажем θ у знаку «−» <strong>виходить з базису</strong>.
                Додаємо +θ до клітин «+» і −θ до клітин «−».
              </div>
            </div>
          )}
        </>
      )}

      {/* ── OPTIMAL ── */}
      {isOptimal && (
        <div style={block("#52c41a", "#f6ffed")}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>✅ Оптимальний план досягнуто!</div>
          <div>Всі оцінки небазисних клітин <strong>Δᵢⱼ ≥ 0</strong> — жодна зміна базису не покращить загальну вартість перевезень.</div>
          <div style={{ marginTop: 6 }}>
            <strong>Кількість базисних клітин:</strong> {step.basic_cells.length} = m + n − 1 = {m + n - 1}
          </div>
        </div>
      )}

      {/* Transport table */}
      <TransportTable step={step} supply={supply} demand={demand} costs={costs} />

      {/* Navigation */}
      <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "center", alignItems: "center" }}>
        <Button icon={<LeftOutlined />} onClick={onPrev} disabled={stepIndex === 0}>
          Попередній
        </Button>
        <Text type="secondary" style={{ minWidth: 70, textAlign: "center", fontSize: 13 }}>
          {stepIndex + 1} / {totalSteps}
        </Text>
        {stepIndex < totalSteps - 1 ? (
          <Button type="primary" icon={<RightOutlined />} iconPosition="end" onClick={onNext}>
            Наступний крок
          </Button>
        ) : (
          <Button style={{ background: "#52c41a", borderColor: "#52c41a", color: "#fff" }} disabled>
            ✓ Завершено
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProminentTransportStep;
