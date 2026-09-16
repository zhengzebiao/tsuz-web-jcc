import {
  AppstoreOutlined,
  CrownOutlined,
  ExperimentOutlined,
  FireOutlined,
  GlobalOutlined,
  ThunderboltOutlined
} from "@ant-design/icons";
import { Layout, Menu, type MenuProps } from "antd";
import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import JccResourcePage, { type ResourceKey } from "./pages/JccResourcePage";

const { Content, Sider } = Layout;

interface ResourceRoute {
  path: string;
  resource: ResourceKey;
  title: string;
  description: string;
  icon: ReactNode;
}

const resourceRoutes: ResourceRoute[] = [
  {
    path: "/heroes",
    resource: "heroes",
    title: "英雄",
    description: "检索当前版本的英雄、属性与技能资料",
    icon: <CrownOutlined />
  },
  {
    path: "/traits",
    resource: "traits",
    title: "羁绊",
    description: "查看种族与职业羁绊的激活条件和等级效果",
    icon: <GlobalOutlined />
  },
  {
    path: "/equipment",
    resource: "equipment",
    title: "装备",
    description: "浏览装备说明、合成组件与战斗效果",
    icon: <AppstoreOutlined />
  },
  {
    path: "/augments",
    resource: "augments",
    title: "强化符文",
    description: "查阅强化符文等级、图标与详细说明",
    icon: <ThunderboltOutlined />
  },
  {
    path: "/special-mechanics",
    resource: "adventures",
    title: "特殊机制",
    description: "探索当前版本的特殊机制与可用内容",
    icon: <FireOutlined />
  },
  {
    path: "/portals",
    resource: "galaxies",
    title: "传送门",
    description: "查看传送门背景、说明与关联影像",
    icon: <ExperimentOutlined />
  }
];

const menuItems: MenuProps["items"] = resourceRoutes.map(({ path, icon, title }) => ({
  key: path,
  icon,
  label: title
}));

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedPath = resourceRoutes.find(({ path }) => location.pathname === path)?.path;

  return (
    <Layout className="app-shell">
      <Sider className="app-sider" width={220} theme="light">
        <div className="jcc-brand">
          <div className="jcc-brand-mark">J</div>
          <div>
            <strong>JCC ARCHIVE</strong>
            <span>资料观测站</span>
          </div>
        </div>
        <Menu
          className="app-menu"
          mode="inline"
          items={menuItems}
          selectedKeys={selectedPath ? [selectedPath] : []}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Content className="app-content">
        <Routes>
          {resourceRoutes.map(({ path, resource, title, description }) => (
            <Route
              key={path}
              path={path}
              element={<JccResourcePage key={resource} resource={resource} title={title} description={description} />}
            />
          ))}
          <Route path="*" element={<Navigate replace to="/heroes" />} />
        </Routes>
      </Content>
    </Layout>
  );
}
