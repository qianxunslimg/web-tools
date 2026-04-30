import {
  ExperimentOutlined,
  HomeOutlined,
  ReadOutlined,
  SettingOutlined,
} from "@ant-design/icons";

import { buildOpsPath, buildPagePath, buildToolkitPath } from "./routes";
import type { NavItem, OpsTabKey, SubNavItem, ToolkitTabKey } from "./types";

export const SITE_NAME = "Qianxun";
export const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "首页", icon: <HomeOutlined />, path: buildPagePath("home") },
  { key: "blog", label: "博客", icon: <ReadOutlined />, path: buildPagePath("blog") },
  { key: "toolkit", label: "工具", icon: <ExperimentOutlined />, path: buildPagePath("toolkit") },
  { key: "ops", label: "运维", icon: <SettingOutlined />, path: buildPagePath("ops") },
];

export const TOOLKIT_TABS: SubNavItem<ToolkitTabKey>[] = [
  { key: "image-editor", label: "图片编辑", path: buildToolkitPath("image-editor") },
  { key: "banyiping", label: "BYP", path: buildToolkitPath("banyiping") },
];

export const OPS_TABS: SubNavItem<OpsTabKey>[] = [
  { key: "features", label: "控制台", path: buildOpsPath("features") },
  { key: "logs", label: "日志查看", path: buildOpsPath("logs") },
  { key: "table", label: "数据库查询", path: buildOpsPath("table") },
];

export const OVERVIEW_ITEMS = [
  {
    label: "Blog",
    title: "个人博客",
    description: "统一托管文章、分类、标签和本地图片资源。",
    path: buildPagePath("blog"),
  },
  {
    label: "Image",
    title: "图片编辑器",
    description: "改尺寸、压缩体积、旋转翻转并导出证件照。",
    path: buildToolkitPath("image-editor"),
  },
  {
    label: "BYP",
    title: "班易评分析",
    description: "Excel 链接分析工具入口。",
    path: buildToolkitPath("banyiping"),
  },
  {
    label: "Console",
    title: "控制台",
    description: "查看服务状态并管理功能开关。",
    path: buildOpsPath("features"),
  },
  {
    label: "Ops",
    title: "运维控制台",
    description: "查看日志、管理开关、查询数据库。",
    path: buildPagePath("ops"),
  },
];
