import { useEffect, useState } from "react";

import { NAV_ITEMS, SITE_NAME } from "../../app/constants";
import { OverviewGrid } from "./OverviewGrid";

type HomePageProps = {
  onNavigate: (path: string) => void;
};

function formatShanghaiTime() {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date());
}

export function HomePage({ onNavigate }: HomePageProps) {
  const [phoneTime, setPhoneTime] = useState(() => formatShanghaiTime());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhoneTime(formatShanghaiTime());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="page-stack">
      <section className="home-island-hero">
        <div className="home-hero-copy">
          <span className="section-chip">Welcome</span>
          <h1>{SITE_NAME}</h1>
          <p>个人知识库、效率工具和轻量运维台。</p>
        </div>

        <div className="home-phone-panel" aria-label="快捷入口">
          <div className="home-phone-topbar">
            <span>QX</span>
            <span>{phoneTime}</span>
          </div>
          <div className="home-phone-grid">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`home-phone-app home-phone-app-${item.key}`}
                onClick={() => onNavigate(item.path)}
              >
                <span className="home-phone-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
      <OverviewGrid onNavigate={onNavigate} />
    </div>
  );
}
