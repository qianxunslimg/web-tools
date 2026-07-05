import { ConfigProvider, theme } from "antd";
import { useEffect, useState } from "react";

import { NAV_ITEMS, OPS_TABS, SITE_NAME, TOOLKIT_TABS } from "./app/constants";
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
    colorBgBase: "#f8f8f0",
    colorBgContainer: "rgb(247, 243, 223)",
    colorBgElevated: "#fffaf0",
    colorText: "#725d42",
    colorTextSecondary: "#9f927d",
    colorBorder: "#c4b89e",
    borderRadius: 20,
    controlHeight: 45,
    fontFamily:
      '"Nunito", "Noto Sans SC", "Zen Maru Gothic", "PingFang SC", "Hiragino Sans GB", system-ui, sans-serif',
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
      home: SITE_NAME,
      toolkit: toolkitTitleMap[route.toolkitTab],
      ops:
        route.opsTab === "logs"
          ? `日志 | ${SITE_NAME}`
          : route.opsTab === "table"
            ? `数据库 | ${SITE_NAME}`
            : `控制台 | ${SITE_NAME}`,
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

  const consoleTitle = `${SITE_NAME} Console`;

  let pageContent;

  switch (route.page) {
    case "ops":
      pageContent = <OpsPage activeTab={route.opsTab} />;
      break;
    case "toolkit":
      pageContent = <ToolkitPage activeTab={route.toolkitTab} />;
      break;
    case "home":
    default:
      pageContent = <HomePage onNavigate={handleNavigate} />;
      break;
  }

  return (
    <ConfigProvider theme={antdTheme}>
      <div className="app">
        <header className="header">
          <div className="header-title-row">
            <button
              type="button"
              className="console-brand"
              onClick={() => handleNavigate(buildPagePath("home"))}
            >
              <span className="header-logo">QX</span>
              <h2 className="console-title">{consoleTitle}</h2>
            </button>
          </div>
        </header>

        <div className="app-shell">
          <aside className="sidebar">
            {NAV_ITEMS.map((item) => {
              const isActive = route.page === item.key;
              const subnavItems =
                item.key === "toolkit"
                  ? TOOLKIT_TABS
                  : item.key === "ops"
                    ? OPS_TABS
                    : [];

              return (
                <div key={item.key} className="sidebar-nav-group">
                  <button
                    type="button"
                    className={`tab nav-tab${isActive ? " active" : ""}`}
                    onClick={() => {
                      if (isActive) {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        return;
                      }
                      handleNavigate(item.path);
                    }}
                  >
                    <span className="nav-tab-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>

                  {isActive && subnavItems.length > 0 ? (
                    <div className="sidebar-inline-subnav">
                      {subnavItems.map((subItem) => {
                        const isSubnavActive =
                          item.key === "toolkit"
                            ? route.toolkitTab === subItem.key
                            : route.opsTab === subItem.key;

                        return (
                          <button
                            key={subItem.key}
                            type="button"
                            className={`sidebar-subnav-btn${isSubnavActive ? " active" : ""}`}
                            onClick={() => handleNavigate(subItem.path)}
                          >
                            {subItem.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </aside>

          <main className="main">
            {pageContent}
          </main>
        </div>
      </div>
    </ConfigProvider>
  );
}
