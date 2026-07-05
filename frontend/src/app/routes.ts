import type { OpsTabKey, PageKey, RouteState, ToolkitTabKey } from "./types";

const rawBasePath = (import.meta.env.VITE_BASE_PATH || import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
const appBasePath = rawBasePath === "" || rawBasePath === "/" ? "" : rawBasePath;

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
  "gpt-token",
  "banyiping",
];

function normalizePath(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

function stripBasePath(pathname: string) {
  const path = normalizePath(pathname);
  if (!appBasePath) {
    return path;
  }
  if (path === appBasePath) {
    return "/";
  }
  if (path.startsWith(`${appBasePath}/`)) {
    return normalizePath(path.slice(appBasePath.length));
  }
  return path;
}

function withBasePath(pathname: string) {
  const path = normalizePath(pathname);
  if (!appBasePath) {
    return path;
  }
  if (path === "/") {
    return `${appBasePath}/`;
  }
  return `${appBasePath}${path}`;
}

function buildBaseRoute(path: string, canonicalPath: string): RouteState {
  return {
    page: "toolkit",
    toolkitTab: "image-editor",
    opsTab: "features",
    path,
    canonicalPath,
  };
}

export function buildToolkitPath(tab: ToolkitTabKey) {
  return withBasePath("/toolkit/" + tab);
}

export function buildOpsPath(tab: OpsTabKey) {
  return withBasePath("/ops/" + tab);
}

export function buildPagePath(page: PageKey) {
  switch (page) {
    case "home":
      return withBasePath("/");
    case "toolkit":
      return buildToolkitPath("image-editor");
    case "ops":
      return buildOpsPath("features");
    default:
      return "/";
  }
}

export function parseRoute(pathname: string): RouteState {
  const originalPath = normalizePath(pathname);
  const path = stripBasePath(originalPath);
  const rawSegments = path.split("/").filter(Boolean);

  switch (path) {
    case "/":
      return {
        ...buildBaseRoute(originalPath, withBasePath("/")),
        page: "home",
        toolkitTab: "image-editor",
      };
    case "/toolkit":
      return {
        ...buildBaseRoute(originalPath, buildToolkitPath("image-editor")),
        page: "toolkit",
        toolkitTab: "image-editor",
      };
    default:
      if (rawSegments[0] === "toolkit" && rawSegments[1] && toolkitTabKeys.includes(rawSegments[1] as ToolkitTabKey)) {
        const toolkitTab = rawSegments[1] as ToolkitTabKey;
        return {
          ...buildBaseRoute(originalPath, buildToolkitPath(toolkitTab)),
          page: "toolkit",
          toolkitTab,
        };
      }
      break;
  }

  switch (path) {
    case "/toolkit/banyiping":
      return {
        ...buildBaseRoute(originalPath, buildToolkitPath("banyiping")),
        page: "toolkit",
        toolkitTab: "banyiping",
      };
    case "/toolkit/health":
      return {
        ...buildBaseRoute(originalPath, buildOpsPath("features")),
        page: "ops",
        opsTab: "features",
      };
    case "/toolkit/intake":
      return {
        ...buildBaseRoute(originalPath, buildToolkitPath("banyiping")),
        page: "toolkit",
        toolkitTab: "banyiping",
      };
    case "/ops":
      return {
        ...buildBaseRoute(originalPath, buildOpsPath("features")),
        page: "ops",
        opsTab: "features",
      };
    case "/ops/features":
      return {
        ...buildBaseRoute(originalPath, buildOpsPath("features")),
        page: "ops",
        opsTab: "features",
      };
    case "/ops/logs":
      return {
        ...buildBaseRoute(originalPath, buildOpsPath("logs")),
        page: "ops",
        opsTab: "logs",
      };
    case "/ops/table":
      return {
        ...buildBaseRoute(originalPath, buildOpsPath("table")),
        page: "ops",
        opsTab: "table",
      };
  }

  return {
    ...buildBaseRoute(originalPath, buildToolkitPath("image-editor")),
    page: "toolkit",
    toolkitTab: "image-editor",
  };
}
