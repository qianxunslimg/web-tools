import type { OpsTabKey, PageKey, RouteState, ToolkitTabKey } from "./types";

const toolkitTabKeys: ToolkitTabKey[] = [
  "image-editor",
  "time",
  "horoscope",
  "almanac",
  "regex",
  "unit",
  "life",
  "qr",
  "pdf",
  "codec",
  "color",
  "text",
  "banyiping",
];

function normalizePath(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

function buildBaseRoute(path: string, canonicalPath: string): RouteState {
  return {
    page: "home",
    toolkitTab: "image-editor",
    opsTab: "features",
    blogMode: "index",
    blogTag: null,
    blogCategory: null,
    blogPostPath: null,
    path,
    canonicalPath,
  };
}

function isDateSegment(value?: string) {
  return !!value && /^\d+$/.test(value);
}

export function buildToolkitPath(tab: ToolkitTabKey) {
  return "/toolkit/" + tab;
}

export function buildOpsPath(tab: OpsTabKey) {
  return "/ops/" + tab;
}

export function buildBlogPath() {
  return "/blog";
}

export function buildBlogTagPath(tag: string) {
  return `/blog/tags/${encodeURIComponent(tag)}`;
}

export function buildBlogCategoryPath(category: string) {
  return `/blog/categories/${encodeURIComponent(category)}`;
}

export function buildBlogPostPath(postPath: string) {
  return `/blog/${postPath.replace(/^\/+|\/+$/g, "")}`;
}

export function buildPagePath(page: PageKey) {
  switch (page) {
    case "home":
      return "/";
    case "blog":
      return buildBlogPath();
    case "toolkit":
      return buildToolkitPath("image-editor");
    case "ops":
      return buildOpsPath("features");
    default:
      return "/";
  }
}

export function parseRoute(pathname: string): RouteState {
  const path = normalizePath(pathname);
  const rawSegments = path.split("/").filter(Boolean);

  if (rawSegments[0] === "blog") {
    if (rawSegments.length === 1) {
      return {
        ...buildBaseRoute(path, buildBlogPath()),
        page: "blog",
      };
    }

    if (rawSegments[1] === "tags" && rawSegments[2]) {
      const tag = decodeURIComponent(rawSegments.slice(2).join("/"));
      return {
        ...buildBaseRoute(path, buildBlogTagPath(tag)),
        page: "blog",
        blogMode: "tag",
        blogTag: tag,
      };
    }

    if (rawSegments[1] === "categories" && rawSegments[2]) {
      const category = decodeURIComponent(rawSegments.slice(2).join("/"));
      return {
        ...buildBaseRoute(path, buildBlogCategoryPath(category)),
        page: "blog",
        blogMode: "category",
        blogCategory: category,
      };
    }

    if (
      rawSegments.length === 5 &&
      isDateSegment(rawSegments[1]) &&
      isDateSegment(rawSegments[2]) &&
      isDateSegment(rawSegments[3])
    ) {
      const postPath = [
        rawSegments[1],
        rawSegments[2],
        rawSegments[3],
        decodeURIComponent(rawSegments[4]),
      ].join("/");
      return {
        ...buildBaseRoute(path, buildBlogPostPath(postPath)),
        page: "blog",
        blogMode: "post",
        blogPostPath: postPath,
      };
    }

    return {
      ...buildBaseRoute(path, buildBlogPath()),
      page: "blog",
    };
  }

  if (
    rawSegments.length === 4 &&
    isDateSegment(rawSegments[0]) &&
    isDateSegment(rawSegments[1]) &&
    isDateSegment(rawSegments[2])
  ) {
    const postPath = [
      rawSegments[0],
      rawSegments[1],
      rawSegments[2],
      decodeURIComponent(rawSegments[3]),
    ].join("/");
    return {
      ...buildBaseRoute(path, buildBlogPostPath(postPath)),
      page: "blog",
      blogMode: "post",
      blogPostPath: postPath,
    };
  }

  switch (path) {
    case "/":
      return {
        ...buildBaseRoute(path, "/"),
        page: "home",
      };
    case "/toolkit":
      return {
        ...buildBaseRoute(path, buildToolkitPath("image-editor")),
        page: "toolkit",
        toolkitTab: "image-editor",
      };
    default:
      if (rawSegments[0] === "toolkit" && rawSegments[1] && toolkitTabKeys.includes(rawSegments[1] as ToolkitTabKey)) {
        const toolkitTab = rawSegments[1] as ToolkitTabKey;
        return {
          ...buildBaseRoute(path, buildToolkitPath(toolkitTab)),
          page: "toolkit",
          toolkitTab,
        };
      }
      break;
  }

  switch (path) {
    case "/toolkit/banyiping":
      return {
        ...buildBaseRoute(path, buildToolkitPath("banyiping")),
        page: "toolkit",
        toolkitTab: "banyiping",
      };
    case "/toolkit/health":
      return {
        ...buildBaseRoute(path, buildOpsPath("features")),
        page: "ops",
        opsTab: "features",
      };
    case "/toolkit/intake":
      return {
        ...buildBaseRoute(path, buildToolkitPath("banyiping")),
        page: "toolkit",
        toolkitTab: "banyiping",
      };
    case "/ops":
      return {
        ...buildBaseRoute(path, buildOpsPath("features")),
        page: "ops",
        opsTab: "features",
      };
    case "/ops/features":
      return {
        ...buildBaseRoute(path, buildOpsPath("features")),
        page: "ops",
        opsTab: "features",
      };
    case "/ops/logs":
      return {
        ...buildBaseRoute(path, buildOpsPath("logs")),
        page: "ops",
        opsTab: "logs",
      };
    case "/ops/table":
      return {
        ...buildBaseRoute(path, buildOpsPath("table")),
        page: "ops",
        opsTab: "table",
      };
  }

  return {
    ...buildBaseRoute(path, "/"),
    page: "home",
  };
}
