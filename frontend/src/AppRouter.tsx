import React from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ConfigProvider, Layout, Tabs } from "antd";
import ukUA from "antd/locale/uk_UA";
import SimplexSolver from "./components/SimplexSolver/SimplexSolver";
import BranchAndBound from "./components/BranchAndBound/BranchAndBound";
import TransportSolver from "./components/Transport/TransportSolver";
import { AppProvider } from "./context/AppContext";

const { Header, Content } = Layout;

const Logo: React.FC = () => (
  <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="38" height="38" rx="10" fill="rgba(255,255,255,0.15)" />
    {/* Simplex polytope triangle */}
    <line x1="19" y1="7" x2="7"  y2="29" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="19" y1="7" x2="31" y2="29" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="7"  y1="29" x2="31" y2="29" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" />
    {/* Non-optimal vertices */}
    <circle cx="7"  cy="29" r="3.2" fill="rgba(255,255,255,0.45)" />
    <circle cx="31" cy="29" r="3.2" fill="rgba(255,255,255,0.45)" />
    {/* Optimal vertex — top, gold */}
    <circle cx="19" cy="7" r="4.5" fill="#FFD700" />
    <circle cx="19" cy="7" r="2.5" fill="#FF8C00" />
    {/* z→min label */}
    <text x="19" y="36" textAnchor="middle" fontSize="5.5" fill="rgba(255,255,255,0.7)" fontFamily="monospace">z→min</text>
  </svg>
);

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
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <Header
        style={{
          background: "linear-gradient(120deg, #1677ff 0%, #0747c2 100%)",
          display: "flex",
          alignItems: "center",
          padding: "0 28px",
          height: 62,
          boxShadow: "0 2px 10px rgba(0,0,0,.22)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo />
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, lineHeight: 1.25, letterSpacing: 0.2 }}>
              Розв'язувач задач ЗЛП
            </span>
            <span style={{ color: "rgba(255,255,255,0.60)", fontSize: 11, lineHeight: 1.2, letterSpacing: 0.3 }}>
              Симплекс · Гілки і межі · Транспорт
            </span>
          </div>
        </div>
      </Header>
      <Content style={{ padding: "20px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <Tabs
            activeKey={activeTab}
            size="middle"
            onChange={(key) => navigate(tabToPath[key as TabKey])}
            items={[
              { key: "simplex", label: "Симплекс-метод", children: <SimplexSolver /> },
              { key: "bnb", label: "Метод гілок і меж", children: <BranchAndBound /> },
              { key: "transport", label: "Транспортна задача", children: <TransportSolver /> },
            ]}
          />
        </div>
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
