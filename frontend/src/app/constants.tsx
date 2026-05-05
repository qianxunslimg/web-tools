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
  { key: "time", label: "时间转换", path: buildToolkitPath("time") },
  { key: "horoscope", label: "星座生日", path: buildToolkitPath("horoscope") },
  { key: "almanac", label: "传统黄历", path: buildToolkitPath("almanac") },
  { key: "regex", label: "正则测试", path: buildToolkitPath("regex") },
  { key: "unit", label: "单位换算", path: buildToolkitPath("unit") },
  { key: "life", label: "人生进度", path: buildToolkitPath("life") },
  { key: "qr", label: "二维码", path: buildToolkitPath("qr") },
  { key: "pdf", label: "PDF", path: buildToolkitPath("pdf") },
  { key: "codec", label: "编码", path: buildToolkitPath("codec") },
  { key: "color", label: "颜色", path: buildToolkitPath("color") },
  { key: "text", label: "文本整理", path: buildToolkitPath("text") },
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
    label: "Tools",
    title: "效率工具箱",
    description: "生日、星座、黄历、正则、单位换算和文本整理工具。",
    path: buildToolkitPath("horoscope"),
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
