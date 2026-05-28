import React from "react";
import { Button, Drawer, Empty, Statistic, Table, Tag, Typography } from "antd";
import { BarChartOutlined, DeleteOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/AppContext";
import type { TaskAttempt } from "../types";

const { Title } = Typography;

const TYPE_COLORS: Record<string, string> = {
  simplex: "blue",
  branch_and_bound: "purple",
  transport: "green",
};
const TYPE_LABELS: Record<string, string> = {
  simplex: "Симплекс",
  branch_and_bound: "Гілки і межі",
  transport: "Транспорт",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

const StatsPanel: React.FC<Props> = ({ open, onClose }) => {
  const { attempts, clearAttempts } = useAppContext();

  const solved = attempts.filter((a) => a.solved).length;
  const totalMistakes = attempts.reduce((s, a) => s + a.mistakes, 0);
  const totalHints = attempts.reduce((s, a) => s + a.hints, 0);

  const score = attempts.length === 0 ? 0 : Math.max(0, Math.round(
    (solved / attempts.length) * 100 - totalMistakes * 3 - totalHints * 2
  ));

  const columns = [
    {
      title: "Задача",
      dataIndex: "label",
      key: "label",
      render: (v: string, r: TaskAttempt) => (
        <span>
          <Tag color={TYPE_COLORS[r.type] ?? "default"} style={{ fontSize: 10 }}>
            {TYPE_LABELS[r.type] ?? r.type}
          </Tag>
          {v}
        </span>
      ),
    },
    {
      title: "Помилки",
      dataIndex: "mistakes",
      key: "mistakes",
      width: 80,
      align: "center" as const,
      render: (v: number) => <span style={{ color: v > 0 ? "#cf1322" : "#389e0d" }}>{v}</span>,
    },
    {
      title: "Підказки",
      dataIndex: "hints",
      key: "hints",
      width: 80,
      align: "center" as const,
      render: (v: number) => <span style={{ color: v > 0 ? "#d46b08" : "#389e0d" }}>{v}</span>,
    },
    {
      title: "Статус",
      dataIndex: "solved",
      key: "solved",
      width: 90,
      align: "center" as const,
      render: (v: boolean) => (
        <Tag color={v ? "success" : "error"}>{v ? "Розв'язано" : "Не завершено"}</Tag>
      ),
    },
  ];

  return (
    <Drawer
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BarChartOutlined />
          <span>Статистика сесії</span>
        </div>
      }
      open={open}
      onClose={onClose}
      width={520}
      extra={
        attempts.length > 0 && (
          <Button size="small" danger icon={<DeleteOutlined />} onClick={clearAttempts}>
            Очистити
          </Button>
        )
      }
    >
      {attempts.length === 0 ? (
        <Empty description="Ще не розв'язано жодної задачі" />
      ) : (
        <>
          <div style={{ display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
            <Statistic title="Розв'язано" value={solved} suffix={`/ ${attempts.length}`} valueStyle={{ color: "#389e0d" }} />
            <Statistic title="Помилок" value={totalMistakes} valueStyle={{ color: totalMistakes > 0 ? "#cf1322" : "#389e0d" }} />
            <Statistic title="Підказок" value={totalHints} valueStyle={{ color: totalHints > 0 ? "#d46b08" : "#389e0d" }} />
            <Statistic title="Бал сесії" value={score} suffix="%" valueStyle={{ color: score >= 70 ? "#389e0d" : score >= 40 ? "#d46b08" : "#cf1322" }} />
          </div>

          <Title level={5} style={{ marginBottom: 8 }}>Історія спроб</Title>
          <Table
            size="small"
            dataSource={[...attempts].reverse().map((a, i) => ({ ...a, key: i }))}
            columns={columns}
            pagination={false}
            scroll={{ y: 380 }}
          />
        </>
      )}
    </Drawer>
  );
};

export default StatsPanel;
