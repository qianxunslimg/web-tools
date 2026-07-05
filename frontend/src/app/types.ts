import type { ReactNode } from "react";

export type PageKey = "home" | "toolkit" | "ops";
export type ToolkitTabKey =
  | "image-editor"
  | "time"
  | "horoscope"
  | "almanac"
  | "regex"
  | "unit"
  | "life"
  | "qr"
  | "pdf"
  | "codec"
  | "color"
  | "text"
  | "gpt-token"
  | "banyiping";
export type OpsTabKey = "features" | "logs" | "table";

export type NavItem = {
  key: PageKey;
  label: string;
  icon: ReactNode;
  path: string;
};

export type SubNavItem<T extends string> = {
  key: T;
  label: string;
  path: string;
};

export type ToolDirectoryCategory = "图像" | "文档" | "开发" | "文本" | "时间" | "生活" | "转换";

export type ToolDirectoryItem = {
  key: ToolkitTabKey;
  title: string;
  description: string;
  category: ToolDirectoryCategory;
  path: string;
  keywords: string[];
  icon: ReactNode;
  featured?: boolean;
};

export type RouteState = {
  page: PageKey;
  toolkitTab: ToolkitTabKey;
  opsTab: OpsTabKey;
  path: string;
  canonicalPath: string;
};
