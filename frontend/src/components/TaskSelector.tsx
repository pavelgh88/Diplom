import React, { useEffect, useState } from "react";
import { Card, Select, Button, Typography, Tag, Spin, Alert, InputNumber, Space, Divider, message } from "antd";
import { BookOutlined, CloseCircleOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { fetchTasks, fetchTask, generateTask } from "../api/client";
import { useAppContext } from "../context/AppContext";
import type { TaskSummary, TaskType } from "../types";

const { Text, Paragraph } = Typography;

const TYPE_LABELS: Record<TaskType, string> = {
  simplex: "Симплекс",
  branch_and_bound: "Гілки і межі",
  transport: "Транспортна",
};

const TYPE_COLORS: Record<TaskType, string> = {
  simplex: "blue",
  branch_and_bound: "purple",
  transport: "green",
};

interface Props {
  taskType: TaskType;
  onLoad: (problem: object, label?: string) => void;
}

const TaskSelector: React.FC<Props> = ({ taskType, onLoad }) => {
  const { selectedTask, setSelectedTask, setCheckMode } = useAppContext();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTask, setLoadingTask] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchTasks(taskType)
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
    // Clear task from another algorithm type when switching tabs
    if (selectedTask && selectedTask.type !== taskType) {
      setSelectedTask(null);
    }
  }, [taskType]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = async (id: number) => {
    setLoadingTask(true);
    try {
      const task = await fetchTask(id);
      setSelectedTask(task);
      setCheckMode(false);
    } catch {
      /* ignore */
    } finally {
      setLoadingTask(false);
    }
  };

  const [genVars, setGenVars] = useState(2);
  const [genConstraints, setGenConstraints] = useState(3);
  const [generating, setGenerating] = useState(false);

  const handleLoad = () => {
    if (selectedTask) {
      onLoad(selectedTask.problem);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await generateTask(taskType, genVars, genConstraints);
      setSelectedTask(null);
      onLoad(data.problem, "Згенерована задача");
      message.success("Задачу згенеровано — натисніть «Розв'язати»");
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? "Помилка мережі";
      message.error(`Не вдалося згенерувати задачу: ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleClear = () => {
    setSelectedTask(null);
    setCheckMode(false);
  };

  return (
    <Card
      size="small"
      title={
        <span>
          <BookOutlined style={{ marginRight: 6 }} />
          Бібліотека задач
        </span>
      }
      style={{ marginBottom: 10 }}
    >
      {loading ? (
        <Spin size="small" />
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          <Select
            placeholder="Оберіть задачу зі списку..."
            style={{ flex: 1, minWidth: 220 }}
            loading={loadingTask}
            onChange={handleSelect}
            value={selectedTask?.id ?? null}
            options={tasks.map((t) => ({
              value: t.id,
              label: t.title,
            }))}
          />
          <Button
            type="primary"
            disabled={!selectedTask || selectedTask.type !== taskType}
            onClick={handleLoad}
            title={selectedTask && selectedTask.type !== taskType ? "Оберіть задачу зі списку вище" : undefined}
          >
            Завантажити
          </Button>
          {selectedTask && (
            <Button icon={<CloseCircleOutlined />} onClick={handleClear} danger>
              Очистити
            </Button>
          )}
        </div>
      )}

      <Divider style={{ margin: "10px 0" }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <ThunderboltOutlined style={{ color: "#faad14" }} />
        <Typography.Text style={{ fontSize: 12, color: "#595959" }}>Згенерувати випадкову:</Typography.Text>
        {taskType !== "transport" ? (
          <>
            <Space size={4}>
              <Typography.Text style={{ fontSize: 11, color: "#888" }}>змінних:</Typography.Text>
              <InputNumber size="small" min={1} max={6} value={genVars} onChange={(v) => setGenVars(v ?? 2)} style={{ width: 52 }} />
            </Space>
            <Space size={4}>
              <Typography.Text style={{ fontSize: 11, color: "#888" }}>обмежень:</Typography.Text>
              <InputNumber size="small" min={1} max={8} value={genConstraints} onChange={(v) => setGenConstraints(v ?? 3)} style={{ width: 52 }} />
            </Space>
          </>
        ) : (
          <>
            <Space size={4}>
              <Typography.Text style={{ fontSize: 11, color: "#888" }}>постач.:</Typography.Text>
              <InputNumber size="small" min={2} max={5} value={genVars} onChange={(v) => setGenVars(v ?? 3)} style={{ width: 52 }} />
            </Space>
            <Space size={4}>
              <Typography.Text style={{ fontSize: 11, color: "#888" }}>спожив.:</Typography.Text>
              <InputNumber size="small" min={2} max={5} value={genConstraints} onChange={(v) => setGenConstraints(v ?? 3)} style={{ width: 52 }} />
            </Space>
          </>
        )}
        <Button
          size="small"
          icon={<ThunderboltOutlined />}
          loading={generating}
          onClick={handleGenerate}
          style={{ borderColor: "#faad14", color: "#d46b08" }}
        >
          Згенерувати
        </Button>
      </div>

      {selectedTask && selectedTask.type === taskType && (
        <div style={{ marginTop: 10 }}>
          <div style={{ marginBottom: 4 }}>
            <Tag color={TYPE_COLORS[selectedTask.type]}>{TYPE_LABELS[selectedTask.type]}</Tag>
            <Text strong>{selectedTask.title}</Text>
          </div>
          <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
            {selectedTask.description}
          </Paragraph>
          {selectedTask.theory_hint && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 8 }}
              message={<Text style={{ fontSize: 12 }}>{selectedTask.theory_hint}</Text>}
            />
          )}
        </div>
      )}
    </Card>
  );
};

export default TaskSelector;
