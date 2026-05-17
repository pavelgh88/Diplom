import React from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ConfigProvider, Layout, Tabs, Typography } from "antd";
import ukUA from "antd/locale/uk_UA";
import SimplexSolver from "./components/SimplexSolver/SimplexSolver";
import BranchAndBound from "./components/BranchAndBound/BranchAndBound";
import TransportSolver from "./components/Transport/TransportSolver";
import { AppProvider } from "./context/AppContext";

const { Header, Content } = Layout;
const { Title } = Typography;

const TAB_KEYS = ["simplex", "bnb", "transport"] as const;
type TabKey = typeof TAB_KEYS[number];

const pathToTab: Record<string, TabKey> = {
  "/simplex": "simplex",
  "/bnb": "bnb",
  "/transport": "transport",
};

const tabToPath: Record<TabKey, string> = {
  simplex: "/simplex",
  bnb: "/bnb",
  transport: "/transport",
};

const AppShell: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeTab = pathToTab[pathname] ?? "simplex";

  return (
    <Layout style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <Header
        style={{ background: "#1677ff", display: "flex", alignItems: "center", padding: "0 32px" }}
      >
        <Title level={3} style={{ color: "#fff", margin: 0 }}>
          Розв'язувач задач лінійного програмування
        </Title>
      </Header>
      <Content style={{ padding: "24px 32px" }}>
        <Tabs
          activeKey={activeTab}
          size="large"
          onChange={(key) => navigate(tabToPath[key as TabKey])}
          items={[
            { key: "simplex", label: "Симплекс-метод", children: <SimplexSolver /> },
            { key: "bnb", label: "Метод гілок і меж", children: <BranchAndBound /> },
            { key: "transport", label: "Транспортна задача", children: <TransportSolver /> },
          ]}
        />
      </Content>
    </Layout>
  );
};

const AppRouter: React.FC = () => (
  <ConfigProvider locale={ukUA}>
    <AppProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/simplex" replace />} />
        <Route path="/simplex" element={<AppShell />} />
        <Route path="/bnb" element={<AppShell />} />
        <Route path="/transport" element={<AppShell />} />
        <Route path="*" element={<Navigate to="/simplex" replace />} />
      </Routes>
    </AppProvider>
  </ConfigProvider>
);

export default AppRouter;
