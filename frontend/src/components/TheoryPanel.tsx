import React from "react";
import { Collapse } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";

interface Props {
  children: React.ReactNode;
}

const TheoryPanel: React.FC<Props> = ({ children }) => (
  <Collapse
    size="small"
    style={{ marginBottom: 10, background: "#fafafa" }}
    items={[
      {
        key: "theory",
        label: (
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            <InfoCircleOutlined style={{ marginRight: 6, color: "#1677ff" }} />
            Теоретична довідка
          </span>
        ),
        children: (
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "#333" }}>
            {children}
          </div>
        ),
      },
    ]}
  />
);

export default TheoryPanel;
