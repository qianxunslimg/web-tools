import {
  CalendarOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined,
  LockOutlined,
  SearchOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { Button, Empty, Input, Spin } from "antd";
import { type FormEvent, type MouseEvent, useEffect, useState } from "react";

import { SITE_NAME } from "../../app/constants";
import {
  buildBlogCategoryPath,
  buildBlogPath,
  buildBlogPostPath,
  buildBlogTagPath,
} from "../../app/routes";
import type { RouteState } from "../../app/types";
import { fetchBlogIndex, fetchBlogPost } from "../../api/client";
import type { BlogIndexData, BlogPostDetail, BlogPostSummary } from "../../api/types";
import { env } from "../../env";

type BlogPageProps = {
  route: RouteState;
  onNavigate: (path: string) => void;
};

function formatBlogDate(value: string | null) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function postMatchesSearch(post: BlogPostSummary, searchText: string) {
  const normalized = normalizeSearch(searchText);
  if (!normalized) {
    return true;
  }
  const haystack = [
    post.title,
    post.summary,
    post.excerpt,
    post.categories.join(" "),
    post.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return normalized.split(/\s+/).every((part) => haystack.includes(part));
}

function buildRouteLabel(route: RouteState) {
  if (route.blogMode === "tag" && route.blogTag) {
    return `标签：${route.blogTag}`;
  }
  if (route.blogMode === "category" && route.blogCategory) {
    return `分类：${route.blogCategory}`;
  }
  if (route.blogMode === "post") {
    return "文章详情";
  }
  return "全部文章";
}

function normalizeBlogAssetUrl(value: string | null | undefined) {
  const text = (value || "").trim();
  if (!text || !text.startsWith("/api/")) {
    return text;
  }
  return `${env.apiBase.replace(/\/$/, "")}${text}`;
}

function normalizeBlogContentHtml(contentHtml: string) {
  if (!contentHtml || typeof document === "undefined") {
    return contentHtml;
  }

  const template = document.createElement("template");
  template.innerHTML = contentHtml;

  template.content.querySelectorAll("img[src]").forEach((image) => {
    const src = image.getAttribute("src");
    if (!src) {
      return;
    }
    image.setAttribute("src", normalizeBlogAssetUrl(src));
    image.setAttribute("loading", "lazy");
    image.setAttribute("decoding", "async");
  });

  template.content.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) {
      return;
    }
    link.setAttribute("href", normalizeBlogAssetUrl(href));
  });

  return template.innerHTML;
}

export function BlogPage({ route, onNavigate }: BlogPageProps) {
  const [indexData, setIndexData] = useState<BlogIndexData | null>(null);
  const [indexLoading, setIndexLoading] = useState(false);
  const [indexError, setIndexError] = useState("");
  const [detailCache, setDetailCache] = useState<Record<string, BlogPostDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [passwordValues, setPasswordValues] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordLoading, setPasswordLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setIndexLoading(true);
    setIndexError("");
    void fetchBlogIndex()
      .then((response) => {
        if (cancelled) {
          return;
        }
        setIndexData(response.data);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setIndexError(error instanceof Error ? error.message : "博客索引加载失败");
      })
      .finally(() => {
        if (!cancelled) {
          setIndexLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (route.blogMode !== "post" || !route.blogPostPath) {
      setDetailError("");
      return;
    }
    if (detailCache[route.blogPostPath]) {
      return;
    }

    const [year, month, day, postId] = route.blogPostPath.split("/");
    if (!year || !month || !day || !postId) {
      setDetailError("文章路径无效");
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    void fetchBlogPost(year, month, day, postId)
      .then((response) => {
        const detail = response.data;
        if (cancelled || !detail) {
          return;
        }
        setDetailCache((current) => ({
          ...current,
          [detail.post_path]: detail,
        }));
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setDetailError(error instanceof Error ? error.message : "文章加载失败");
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [detailCache, route.blogMode, route.blogPostPath]);

  const allPosts = indexData?.posts ?? [];
  const filteredPosts = allPosts.filter((post) => {
    if (route.blogMode === "tag" && route.blogTag && !post.tags.includes(route.blogTag)) {
      return false;
    }
    if (
      route.blogMode === "category" &&
      route.blogCategory &&
      !post.categories.includes(route.blogCategory)
    ) {
      return false;
    }
    return postMatchesSearch(post, searchText);
  });

  const activePost =
    route.blogMode === "post" && route.blogPostPath ? detailCache[route.blogPostPath] ?? null : null;
  const fallbackSummary =
    route.blogMode === "post" && route.blogPostPath
      ? allPosts.find((post) => post.post_path === route.blogPostPath) ?? null
      : null;
  const normalizedArticleHtml = activePost ? normalizeBlogContentHtml(activePost.content_html) : "";
  const activePasswordValue =
    route.blogMode === "post" && route.blogPostPath ? passwordValues[route.blogPostPath] ?? "" : "";
  const activePasswordError =
    route.blogMode === "post" && route.blogPostPath ? passwordErrors[route.blogPostPath] ?? "" : "";
  const activePasswordLoading =
    route.blogMode === "post" && route.blogPostPath ? Boolean(passwordLoading[route.blogPostPath]) : false;
  const routeLabel = buildRouteLabel(route);

  useEffect(() => {
    if (route.blogMode === "post") {
      const title = activePost?.title || fallbackSummary?.title || "博客";
      document.title = `${title} | ${SITE_NAME}`;
      return;
    }
    if (route.blogMode === "tag" && route.blogTag) {
      document.title = `#${route.blogTag} | ${SITE_NAME}`;
      return;
    }
    if (route.blogMode === "category" && route.blogCategory) {
      document.title = `${route.blogCategory} | ${SITE_NAME}`;
      return;
    }
    document.title = `博客 | ${SITE_NAME}`;
  }, [activePost?.title, fallbackSummary?.title, route.blogCategory, route.blogMode, route.blogTag]);

  function handleArticleBodyClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const anchor = target.closest("a");
    if (!(anchor instanceof HTMLAnchorElement)) {
      return;
    }

    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) {
      return;
    }

    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) {
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      return;
    }

    event.preventDefault();
    onNavigate(url.pathname);
  }

  function updatePasswordValue(value: string) {
    if (!route.blogPostPath) {
      return;
    }
    setPasswordValues((current) => ({ ...current, [route.blogPostPath as string]: value }));
    setPasswordErrors((current) => ({ ...current, [route.blogPostPath as string]: "" }));
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!route.blogPostPath) {
      return;
    }
    const [year, month, day, postId] = route.blogPostPath.split("/");
    const password = activePasswordValue.trim();
    if (!year || !month || !day || !postId) {
      setPasswordErrors((current) => ({ ...current, [route.blogPostPath as string]: "文章路径无效" }));
      return;
    }
    if (!password) {
      setPasswordErrors((current) => ({ ...current, [route.blogPostPath as string]: "请输入文章密码" }));
      return;
    }

    const cacheKey = route.blogPostPath;
    setPasswordLoading((current) => ({ ...current, [cacheKey]: true }));
    setPasswordErrors((current) => ({ ...current, [cacheKey]: "" }));

    void fetchBlogPost(year, month, day, postId, password)
      .then((response) => {
        const detail = response.data;
        if (!detail) {
          setPasswordErrors((current) => ({ ...current, [cacheKey]: "文章解锁失败" }));
          return;
        }
        if (detail.password_required && !detail.password_unlocked) {
          setPasswordErrors((current) => ({ ...current, [cacheKey]: "密码不正确" }));
          return;
        }
        setDetailCache((current) => ({
          ...current,
          [detail.post_path]: detail,
        }));
      })
      .catch((error: unknown) => {
        setPasswordErrors((current) => ({
          ...current,
          [cacheKey]: error instanceof Error ? error.message : "文章解锁失败",
        }));
      })
      .finally(() => {
        setPasswordLoading((current) => ({ ...current, [cacheKey]: false }));
      });
  }

  if (indexLoading && !indexData) {
    return (
      <div className="page-stack">
        <section className="panel-card status-loading">
          <Spin size="large" />
        </section>
      </div>
    );
  }

  if (indexError && !indexData) {
    return (
      <div className="page-stack">
        <section className="panel-card tool-empty">
          <p>{indexError}</p>
        </section>
      </div>
    );
  }

  if (route.blogMode === "post") {
    return (
      <div className="page-stack">
        {detailLoading && !activePost ? (
          <section className="panel-card status-loading">
            <Spin size="large" />
          </section>
        ) : null}

        {detailError ? (
          <section className="panel-card tool-empty">
            <p>{detailError}</p>
          </section>
        ) : null}

        {activePost ? (
          <div className="blog-detail-layout">
            <article className="blog-article-card">
              <header className="blog-article-header">
                <div className="blog-meta-row">
                  <span>
                    <CalendarOutlined />
                    <span>{formatBlogDate(activePost.published_at)}</span>
                  </span>
                  <span>
                    <ClockCircleOutlined />
                    <span>{activePost.reading_minutes} 分钟</span>
                  </span>
                  <span>
                    <FolderOpenOutlined />
                    <span>{activePost.categories.join(" / ") || "未分类"}</span>
                  </span>
                </div>
                <h1>{activePost.title}</h1>

                <div className="blog-chip-group">
                  {activePost.categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className="blog-chip blog-chip-category"
                      onClick={() => onNavigate(buildBlogCategoryPath(category))}
                    >
                      {category}
                    </button>
                  ))}
                  {activePost.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="blog-chip"
                      onClick={() => onNavigate(buildBlogTagPath(tag))}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </header>

              {activePost.password_required && !activePost.password_unlocked ? (
                <form className="blog-password-panel" onSubmit={handlePasswordSubmit}>
                  <div className="blog-password-copy">
                    <span className="section-chip">Protected</span>
                    <h2>
                      <LockOutlined />
                      <span>这篇文章需要密码</span>
                    </h2>
                    <p>输入文章密码后会在本页直接解锁正文。</p>
                  </div>
                  <div className="blog-password-controls">
                    <Input.Password
                      size="large"
                      placeholder="输入文章密码"
                      value={activePasswordValue}
                      onChange={(event) => updatePasswordValue(event.target.value)}
                    />
                    <Button
                      htmlType="submit"
                      size="large"
                      type="primary"
                      loading={activePasswordLoading}
                    >
                      解锁文章
                    </Button>
                  </div>
                  {activePasswordError ? <p className="blog-password-error">{activePasswordError}</p> : null}
                </form>
              ) : (
                <div
                  className="blog-prose"
                  onClick={handleArticleBodyClick}
                  dangerouslySetInnerHTML={{ __html: normalizedArticleHtml }}
                />
              )}
            </article>

            <aside className="panel-card blog-side-card">
              <div className="blog-side-section">
                <span className="section-chip">Meta</span>
                <strong>{activePost.word_count} 字</strong>
                <p>{formatBlogDate(activePost.updated_at || activePost.published_at)} 最近整理</p>
              </div>

              <div className="blog-side-section">
                <span className="section-chip">Explore</span>
                <button type="button" className="blog-side-link" onClick={() => onNavigate(buildBlogPath())}>
                  查看全部文章
                </button>
                {activePost.categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className="blog-side-link"
                    onClick={() => onNavigate(buildBlogCategoryPath(category))}
                  >
                    分类 · {category}
                  </button>
                ))}
                {activePost.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="blog-side-link"
                    onClick={() => onNavigate(buildBlogTagPath(tag))}
                  >
                    标签 · #{tag}
                  </button>
                ))}
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="blog-list-layout">
        <aside className="blog-filter-sidebar">
          <section className="panel-card blog-filter-card blog-filter-intro">
            <span className="section-chip">Browse</span>
            <div className="blog-filter-heading">
              <h1>{routeLabel}</h1>
            </div>

            <Input
              allowClear
              size="large"
              placeholder="按标题、摘要、标签搜索"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />

            <div className="blog-filter-stats">
              <div className="blog-filter-stat">
                <strong>{indexData?.total_posts ?? 0}</strong>
                <span>文章</span>
              </div>
              <div className="blog-filter-stat">
                <strong>{indexData?.categories.length ?? 0}</strong>
                <span>分类</span>
              </div>
              <div className="blog-filter-stat">
                <strong>{indexData?.tags.length ?? 0}</strong>
                <span>标签</span>
              </div>
            </div>
          </section>

          <section className="panel-card blog-filter-card">
            <div className="blog-filter-section">
              <span className="section-chip">分类</span>
              <div className="blog-filter-chip-list">
                <button
                  type="button"
                  className={`blog-filter-chip${route.blogMode === "index" ? " active" : ""}`}
                  onClick={() => onNavigate(buildBlogPath())}
                >
                  全部文章
                  <span>{indexData?.total_posts ?? 0}</span>
                </button>
                {(indexData?.categories ?? []).map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    className={`blog-filter-chip${route.blogCategory === item.name ? " active" : ""}`}
                    onClick={() => onNavigate(buildBlogCategoryPath(item.name))}
                  >
                    {item.name}
                    <span>{item.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="panel-card blog-filter-card">
            <div className="blog-filter-section">
              <span className="section-chip">标签</span>
              <div className="blog-filter-chip-list">
                {(indexData?.tags ?? []).map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    className={`blog-filter-chip${route.blogTag === item.name ? " active" : ""}`}
                    onClick={() => onNavigate(buildBlogTagPath(item.name))}
                  >
                    #{item.name}
                    <span>{item.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </aside>

        <section className="blog-results">
          <div className="page-head blog-results-head">
            <div className="blog-results-headline">
              <span className="section-chip">Results</span>
              <h2>{filteredPosts.length} 篇文章</h2>
            </div>
            {searchText ? <span className="blog-results-search">关键词 · {searchText}</span> : null}
          </div>

          {filteredPosts.length === 0 ? (
            <section className="panel-card blog-empty-card">
              <Empty description="当前筛选条件下没有文章" />
            </section>
          ) : (
            <div className="blog-post-grid">
              {filteredPosts.map((post) => (
                <article
                  key={post.post_path}
                  className="card blog-post-card"
                  onClick={() => onNavigate(buildBlogPostPath(post.post_path))}
                >
                  {post.cover_image ? (
                    <div className="blog-card-cover">
                      <img
                        src={normalizeBlogAssetUrl(post.cover_image)}
                        alt={post.title}
                        loading="lazy"
                      />
                    </div>
                  ) : null}

                  <div className="blog-card-body">
                    <div className="blog-meta-row compact">
                      <span>
                        <CalendarOutlined />
                        <span>{formatBlogDate(post.published_at)}</span>
                      </span>
                      <span>
                        <ClockCircleOutlined />
                        <span>{post.reading_minutes} 分钟</span>
                      </span>
                    </div>

                    <h3>{post.title}</h3>
                    <p>{post.summary || post.excerpt}</p>

                    <div className="blog-chip-group">
                      {post.categories.map((category) => (
                        <button
                          key={category}
                          type="button"
                          className="blog-chip blog-chip-category"
                          onClick={(event) => {
                            event.stopPropagation();
                            onNavigate(buildBlogCategoryPath(category));
                          }}
                        >
                          {category}
                        </button>
                      ))}
                      {post.tags.slice(0, 3).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="blog-chip"
                          onClick={(event) => {
                            event.stopPropagation();
                            onNavigate(buildBlogTagPath(tag));
                          }}
                        >
                          <TagOutlined />
                          <span>{tag}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
