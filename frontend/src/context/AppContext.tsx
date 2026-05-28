import React, { createContext, useContext, useState, useCallback } from "react";
import type { Task, TaskAttempt } from "../types";

interface AppState {
  selectedTask: Task | null;
  setSelectedTask: (task: Task | null) => void;
  checkMode: boolean;
  setCheckMode: (enabled: boolean) => void;
  attempts: TaskAttempt[];
  recordAttempt: (attempt: Omit<TaskAttempt, "ts">) => void;
  clearAttempts: () => void;
}

const AppContext = createContext<AppState>({
  selectedTask: null,
  setSelectedTask: () => {},
  checkMode: false,
  setCheckMode: () => {},
  attempts: [],
  recordAttempt: () => {},
  clearAttempts: () => {},
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [checkMode, setCheckMode] = useState(false);
  const [attempts, setAttempts] = useState<TaskAttempt[]>([]);

  const recordAttempt = useCallback((attempt: Omit<TaskAttempt, "ts">) => {
    setAttempts((prev) => [...prev, { ...attempt, ts: Date.now() }]);
  }, []);

  const clearAttempts = useCallback(() => setAttempts([]), []);

  return (
    <AppContext.Provider value={{
      selectedTask, setSelectedTask,
      checkMode, setCheckMode,
      attempts, recordAttempt, clearAttempts,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
