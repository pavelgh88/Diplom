import React, { useEffect, useState } from "react";
import { Card, Select, Button, Typography, Tag, Spin, Alert } from "antd";
import { BookOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { fetchTasks, fetchTask } from "../api/client";
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
  onLoad: (problem: object) => void;
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
  }, [taskType]);

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

  const handleLoad = () => {
    if (selectedTask) {
      onLoad(selectedTask.problem);
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
      style={{ marginBottom: 16 }}
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
          <Button type="primary" disabled={!selectedTask} onClick={handleLoad}>
            Завантажити
          </Button>
          {selectedTask && (
            <Button icon={<CloseCircleOutlined />} onClick={handleClear} danger>
              Очистити
            </Button>
          )}
        </div>
      )}

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
