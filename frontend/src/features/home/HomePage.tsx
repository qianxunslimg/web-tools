import { ExportOutlined, SearchOutlined, StarFilled } from "@ant-design/icons";
import { useMemo, useState } from "react";

import { SITE_NAME, TOOL_DIRECTORY_ITEMS } from "../../app/constants";
import type { ToolDirectoryCategory } from "../../app/types";

const CATEGORY_FILTERS: Array<"全部" | ToolDirectoryCategory> = ["全部", "图像", "文档", "开发", "文本", "时间", "生活", "转换"];

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function HomePage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORY_FILTERS)[number]>("全部");

  const filteredTools = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return TOOL_DIRECTORY_ITEMS.filter((item) => {
      const categoryMatched = category === "全部" || item.category === category;
      if (!categoryMatched) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const haystack = [item.title, item.description, item.category, ...item.keywords].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [category, query]);

  return (
    <main className="directory-home">
      <header className="directory-topbar">
        <a className="directory-brand" href="./" aria-label={SITE_NAME}>
          <span className="directory-logo">wt</span>
          <span>
            <strong>{SITE_NAME}</strong>
            <small>by qxslimg</small>
          </span>
        </a>
        <label className="directory-search">
          <SearchOutlined />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索工具，例如 token、二维码、PDF、正则"
            autoComplete="off"
          />
        </label>
      </header>

      <section className="directory-category-strip" aria-label="工具分类">
        {CATEGORY_FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            className={item === category ? "active" : ""}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </section>

      <section className="tool-directory-grid" aria-label="工具列表">
        {filteredTools.map((item) => (
          <a key={item.key} className="tool-directory-card" href={item.path} target="_blank" rel="noreferrer">
            <span className="tool-card-icon">{item.icon}</span>
            <span className="tool-card-category">[{item.category}]</span>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            <span className="tool-card-footer">
              {item.featured ? (
                <span className="tool-card-featured">
                  <StarFilled />
                  推荐
                </span>
              ) : (
                <span />
              )}
              <span className="tool-card-open">
                打开
                <ExportOutlined />
              </span>
            </span>
          </a>
        ))}
      </section>

      {!filteredTools.length ? (
        <section className="directory-empty">
          <strong>没有匹配的工具</strong>
          <p>换个关键词或分类试试。</p>
        </section>
      ) : null}
    </main>
  );
}
