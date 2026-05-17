import React from "react";
import { ConfigProvider, Layout, Tabs, Typography } from "antd";
import ukUA from "antd/locale/uk_UA";
import SimplexSolver from "./components/SimplexSolver/SimplexSolver";
import BranchAndBound from "./components/BranchAndBound/BranchAndBound";
import TransportSolver from "./components/Transport/TransportSolver";

const { Header, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => (
  <ConfigProvider locale={ukUA}>
    <Layout style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <Header style={{ background: "#1677ff", display: "flex", alignItems: "center", padding: "0 32px" }}>
        <Title level={3} style={{ color: "#fff", margin: 0 }}>
          Розв'язувач задач лінійного програмування
        </Title>
      </Header>
      <Content style={{ padding: "24px 32px" }}>
        <Tabs
          defaultActiveKey="simplex"
          size="large"
          items={[
            {
              key: "simplex",
              label: "Симплекс-метод",
              children: <SimplexSolver />,
            },
            {
              key: "bnb",
              label: "Метод гілок і меж",
              children: <BranchAndBound />,
            },
            {
              key: "transport",
              label: "Транспортна задача",
              children: <TransportSolver />,
            },
          ]}
        />
      </Content>
    </Layout>
  </ConfigProvider>
);

export default App;
