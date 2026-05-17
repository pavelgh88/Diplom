import React, { createContext, useContext, useState } from "react";
import type { Task } from "../types";

interface AppState {
  selectedTask: Task | null;
  setSelectedTask: (task: Task | null) => void;
  checkMode: boolean;
  setCheckMode: (enabled: boolean) => void;
}

const AppContext = createContext<AppState>({
  selectedTask: null,
  setSelectedTask: () => {},
  checkMode: false,
  setCheckMode: () => {},
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [checkMode, setCheckMode] = useState(false);

  return (
    <AppContext.Provider value={{ selectedTask, setSelectedTask, checkMode, setCheckMode }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
