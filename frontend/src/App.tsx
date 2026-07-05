import { SettingOutlined } from "@ant-design/icons";
import { ConfigProvider, theme } from "antd";
import { useEffect, useState } from "react";

import { OPS_TABS, SITE_NAME, TOOLKIT_TABS } from "./app/constants";
import { buildPagePath, parseRoute } from "./app/routes";
import type { RouteState } from "./app/types";
import { HomePage } from "./features/home/HomePage";
import { OpsPage } from "./features/ops/OpsPage";
import { ToolkitPage } from "./features/toolkit/ToolkitPage";

const antdTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#19c8b9",
    colorInfo: "#19c8b9",
    colorSuccess: "#6fba2c",
    colorWarning: "#f5c31c",
    colorError: "#e05a5a",
    colorBgBase: "#f6f8fb",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorText: "#1f2937",
    colorTextSecondary: "#64748b",
    colorBorder: "#d8dee8",
    borderRadius: 8,
    controlHeight: 38,
    fontFamily: '"Inter", "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", system-ui, sans-serif',
  },
};

const toolkitTitleMap: Record<RouteState["toolkitTab"], string> = {
  "image-editor": `图片编辑 | ${SITE_NAME}`,
  time: `时间转换 | ${SITE_NAME}`,
  horoscope: `星座生日 | ${SITE_NAME}`,
  almanac: `传统黄历 | ${SITE_NAME}`,
  regex: `正则测试 | ${SITE_NAME}`,
  unit: `单位换算 | ${SITE_NAME}`,
  life: `人生进度 | ${SITE_NAME}`,
  qr: `二维码 | ${SITE_NAME}`,
  pdf: `PDF 工具 | ${SITE_NAME}`,
  codec: `编码工具 | ${SITE_NAME}`,
  color: `颜色工具 | ${SITE_NAME}`,
  text: `文本整理 | ${SITE_NAME}`,
  "gpt-token": `GPT 转换 | ${SITE_NAME}`,
  banyiping: `BYP | ${SITE_NAME}`,
};

export default function App() {
  const [route, setRoute] = useState<RouteState>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const syncRoute = () => {
      const nextRoute = parseRoute(window.location.pathname);
      if (window.location.pathname !== nextRoute.canonicalPath) {
        window.history.replaceState({}, "", nextRoute.canonicalPath);
        setRoute({
          ...nextRoute,
          path: nextRoute.canonicalPath,
        });
        return;
      }
      setRoute(nextRoute);
    };

    syncRoute();
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useEffect(() => {
    const titleMap = {
      home: `${SITE_NAME} | qxslimg`,
      toolkit: toolkitTitleMap[route.toolkitTab],
      ops: route.opsTab === "logs" ? `日志 | ${SITE_NAME}` : route.opsTab === "table" ? `数据库 | ${SITE_NAME}` : `控制台 | ${SITE_NAME}`,
    };

    document.title = titleMap[route.page];
  }, [route.opsTab, route.page, route.toolkitTab]);

  function handleNavigate(path: string) {
    const nextRoute = parseRoute(path);
    const targetPath = nextRoute.canonicalPath;

    if (window.location.pathname === targetPath) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    window.history.pushState({}, "", targetPath);
    setRoute({
      ...nextRoute,
      path: targetPath,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const activeTool = TOOLKIT_TABS.find((item) => item.key === route.toolkitTab);
  const activeOps = OPS_TABS.find((item) => item.key === route.opsTab);
  const activeLabel = route.page === "ops" ? activeOps?.label || "运维" : activeTool?.label || "工具";
  const centerTabs = route.page === "ops" ? OPS_TABS : TOOLKIT_TABS;

  const pageContent =
    route.page === "home" ? <HomePage /> : route.page === "ops" ? <OpsPage activeTab={route.opsTab} /> : <ToolkitPage activeTab={route.toolkitTab} />;

  if (route.page === "home") {
    return (
      <ConfigProvider theme={antdTheme}>
        <div className="app directory-app">{pageContent}</div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={antdTheme}>
      <div className="app">
        <header className="header workbench-header">
          <button type="button" className="console-brand" onClick={() => handleNavigate(buildPagePath("home"))}>
            <span className="header-logo">wt</span>
            <span className="workbench-brand-copy">
              <strong>{SITE_NAME}</strong>
              <span>{activeLabel}</span>
            </span>
          </button>

          <nav className="workbench-tool-nav" aria-label={route.page === "ops" ? "运维导航" : "工具导航"}>
            {centerTabs.map((item) => {
              const isActive = route.page === "ops" ? route.opsTab === item.key : route.toolkitTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`workbench-tool-tab${isActive ? " active" : ""}`}
                  onClick={() => handleNavigate(item.path)}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            className={`ops-icon-button${route.page === "ops" ? " active" : ""}`}
            title="运维"
            aria-label="运维"
            onClick={() => handleNavigate(buildPagePath("ops"))}
          >
            <SettingOutlined />
          </button>
        </header>

        <main className="main workbench-main">{pageContent}</main>
      </div>
    </ConfigProvider>
  );
}
