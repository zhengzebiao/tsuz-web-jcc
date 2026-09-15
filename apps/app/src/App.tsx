import { Layout } from "antd";
import { Route, Routes } from "react-router-dom";

const { Content } = Layout;

export default function App() {
  return (
    <Layout className="app-shell">
      <Content className="app-content">
        <Routes>
          <Route path="*" element={<BaseSubAppPage />} />
        </Routes>
      </Content>
    </Layout>
  );
}

function BaseSubAppPage() {
  return null;
}
