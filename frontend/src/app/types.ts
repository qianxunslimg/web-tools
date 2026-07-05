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

export type RouteState = {
  page: PageKey;
  toolkitTab: ToolkitTabKey;
  opsTab: OpsTabKey;
  path: string;
  canonicalPath: string;
};
