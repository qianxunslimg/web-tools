import {
  CopyOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  LinkOutlined,
  QrcodeOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { Button, Card, Checkbox, Input, Select, Slider, message } from "antd";
import CryptoJS from "crypto-js";
import { Lunar, Solar } from "lunar-javascript";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

const { TextArea } = Input;

type ToolOutput = {
  label: string;
  value: string;
};

type DownloadResult = {
  name: string;
  url: string;
  size: string;
};

type QrMode = "text" | "wifi" | "vcard" | "batch";
type QrErrorCorrectionLevel = "L" | "M" | "Q" | "H";
type TextCaseMode = "none" | "upper" | "lower" | "title";
type BirthdayCalendar = "solar" | "lunar";
type AlmanacScene = "general" | "marry" | "funeral" | "move" | "open" | "travel" | "contract";
type UnitCategory = "length" | "weight" | "area" | "volume" | "data";
type ZodiacSign = {
  key: string;
  name: string;
  range: string;
  element: string;
};
type RegexMatchItem = {
  index: number;
  end: number;
  text: string;
  groups: string[];
};
type UnitItem = {
  label: string;
  value: string;
  factor: number;
};
type HoroscopeBirthdayCache = {
  birthdayCalendar?: BirthdayCalendar;
  birthday?: string;
  lunarBirthYear?: number;
  lunarBirthMonth?: number;
  lunarBirthDay?: number;
  lunarBirthLeap?: boolean;
};
type LifeProgressCache = {
  birthday?: string;
  lifeYears?: string;
};
type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>;
};

const zodiacSigns: ZodiacSign[] = [
  { key: "capricorn", name: "摩羯座", range: "12.22 - 01.19", element: "土象" },
  { key: "aquarius", name: "水瓶座", range: "01.20 - 02.18", element: "风象" },
  { key: "pisces", name: "双鱼座", range: "02.19 - 03.20", element: "水象" },
  { key: "aries", name: "白羊座", range: "03.21 - 04.19", element: "火象" },
  { key: "taurus", name: "金牛座", range: "04.20 - 05.20", element: "土象" },
  { key: "gemini", name: "双子座", range: "05.21 - 06.21", element: "风象" },
  { key: "cancer", name: "巨蟹座", range: "06.22 - 07.22", element: "水象" },
  { key: "leo", name: "狮子座", range: "07.23 - 08.22", element: "火象" },
  { key: "virgo", name: "处女座", range: "08.23 - 09.22", element: "土象" },
  { key: "libra", name: "天秤座", range: "09.23 - 10.23", element: "风象" },
  { key: "scorpio", name: "天蝎座", range: "10.24 - 11.22", element: "水象" },
  { key: "sagittarius", name: "射手座", range: "11.23 - 12.21", element: "火象" },
];

const horoscopePhrases = {
  overall: [
    "适合把事情拆小处理，今天越清晰越顺。",
    "不要急着证明自己，稳定推进反而更容易拿到结果。",
    "今天适合整理计划，顺手处理一个拖了很久的小尾巴。",
    "会遇到一点临时变化，但你能用更轻松的方式化解。",
  ],
  love: [
    "表达直接一点会更好，别让对方靠猜。",
    "适合主动联系，也适合把话说柔和一点。",
    "今天更适合陪伴和倾听，不适合翻旧账。",
    "单身的话可以留意熟人圈里的轻松互动。",
  ],
  work: [
    "先处理确定性高的任务，效率会明显好一些。",
    "适合做复盘、排期和文档，不适合硬碰硬沟通。",
    "容易有新的想法，但要先落到可执行清单里。",
    "今天对细节更敏感，适合查漏补缺。",
  ],
  wealth: [
    "消费前多停十秒，今天不太适合冲动下单。",
    "适合做预算和账单整理，小钱也能看出规律。",
    "有机会发现一个省钱办法，但不要为了省钱买不需要的东西。",
    "财务上保持保守，会比冒险更舒服。",
  ],
  health: [
    "注意肩颈和眼睛，别连续久坐太久。",
    "今天适合轻运动，出汗一点就够。",
    "饮食上别太重口，身体会反馈得比较明显。",
    "早点休息比多刷一会儿更划算。",
  ],
};

const luckyColors = ["#19C8B9", "#F5C31C", "#7F97E8", "#E98E63", "#6FBA2C", "#D85C72", "#8D7AE6", "#2F92C8"];
const luckyActions = ["整理桌面", "主动沟通", "早睡", "备份文件", "喝水", "散步", "写计划", "少纠结"];
const horoscopeBirthdayStorageKey = "qianxun:horoscope-birthday";
const lifeProgressStorageKey = "qianxun:life-progress";
const regexTemplates = [
  { label: "邮箱", pattern: "[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}" },
  { label: "URL", pattern: "https?:\\/\\/[^\\s]+" },
  { label: "手机号", pattern: "1[3-9]\\d{9}" },
  { label: "身份证号", pattern: "\\d{17}[\\dXx]" },
  { label: "中文字符", pattern: "[\\u4e00-\\u9fa5]+" },
  { label: "日期 YYYY-MM-DD", pattern: "\\d{4}-\\d{2}-\\d{2}" },
];
const unitGroups: Record<UnitCategory, UnitItem[]> = {
  length: [
    { label: "毫米 mm", value: "mm", factor: 0.001 },
    { label: "厘米 cm", value: "cm", factor: 0.01 },
    { label: "米 m", value: "m", factor: 1 },
    { label: "千米 km", value: "km", factor: 1000 },
    { label: "英寸 in", value: "in", factor: 0.0254 },
    { label: "英尺 ft", value: "ft", factor: 0.3048 },
  ],
  weight: [
    { label: "克 g", value: "g", factor: 0.001 },
    { label: "千克 kg", value: "kg", factor: 1 },
    { label: "吨 t", value: "t", factor: 1000 },
    { label: "斤", value: "jin", factor: 0.5 },
    { label: "磅 lb", value: "lb", factor: 0.45359237 },
  ],
  area: [
    { label: "平方米 m2", value: "m2", factor: 1 },
    { label: "平方厘米 cm2", value: "cm2", factor: 0.0001 },
    { label: "平方千米 km2", value: "km2", factor: 1_000_000 },
    { label: "亩", value: "mu", factor: 666.6666667 },
    { label: "公顷 ha", value: "ha", factor: 10_000 },
  ],
  volume: [
    { label: "毫升 ml", value: "ml", factor: 0.001 },
    { label: "升 L", value: "l", factor: 1 },
    { label: "立方米 m3", value: "m3", factor: 1000 },
    { label: "加仑 gal", value: "gal", factor: 3.785411784 },
  ],
  data: [
    { label: "B", value: "b", factor: 1 },
    { label: "KB", value: "kb", factor: 1024 },
    { label: "MB", value: "mb", factor: 1024 ** 2 },
    { label: "GB", value: "gb", factor: 1024 ** 3 },
    { label: "TB", value: "tb", factor: 1024 ** 4 },
  ],
};
const unitCategoryOptions: Array<{ label: string; value: UnitCategory }> = [
  { label: "长度", value: "length" },
  { label: "重量", value: "weight" },
  { label: "面积", value: "area" },
  { label: "体积", value: "volume" },
  { label: "文件大小", value: "data" },
];
const almanacScenes: Array<{ label: string; value: AlmanacScene }> = [
  { label: "通用", value: "general" },
  { label: "婚嫁", value: "marry" },
  { label: "安葬/祭祀", value: "funeral" },
  { label: "搬家入宅", value: "move" },
  { label: "开业开工", value: "open" },
  { label: "出行", value: "travel" },
  { label: "签约交易", value: "contract" },
];
const almanacSceneKeywords: Record<AlmanacScene, { good: string[]; bad: string[] }> = {
  general: { good: [], bad: [] },
  marry: { good: ["嫁娶", "结婚", "订婚", "纳采"], bad: ["嫁娶", "结婚", "订婚", "纳采"] },
  funeral: { good: ["祭祀", "安葬", "破土", "入殓"], bad: ["祭祀", "安葬", "破土", "入殓"] },
  move: { good: ["入宅", "移徙", "安床"], bad: ["入宅", "移徙", "安床"] },
  open: { good: ["开市", "开业", "开工", "动土"], bad: ["开市", "开业", "开工", "动土"] },
  travel: { good: ["出行", "赴任"], bad: ["出行", "赴任"] },
  contract: { good: ["交易", "立券", "纳财", "订盟"], bad: ["交易", "立券", "纳财", "订盟"] },
};
const hexagrams = [
  "乾为天", "坤为地", "水雷屯", "山水蒙", "水天需", "天水讼", "地水师", "水地比",
  "风天小畜", "天泽履", "地天泰", "天地否", "天火同人", "火天大有", "地山谦", "雷地豫",
  "泽雷随", "山风蛊", "地泽临", "风地观", "火雷噬嗑", "山火贲", "山地剥", "地雷复",
  "天雷无妄", "山天大畜", "山雷颐", "泽风大过", "坎为水", "离为火", "泽山咸", "雷风恒",
  "天山遁", "雷天大壮", "火地晋", "地火明夷", "风火家人", "火泽睽", "水山蹇", "雷水解",
  "山泽损", "风雷益", "泽天夬", "天风姤", "泽地萃", "地风升", "泽水困", "水风井",
  "泽火革", "火风鼎", "震为雷", "艮为山", "风山渐", "雷泽归妹", "雷火丰", "火山旅",
  "巽为风", "兑为泽", "风水涣", "水泽节", "风泽中孚", "雷山小过", "水火既济", "火水未济",
];
const bagua = ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"];
const hexagramHints = [
  "适合先定方向，再慢慢推进。",
  "重在守正，不必急着争一时快慢。",
  "先处理关系，再处理事情会更顺。",
  "可以行动，但要留出调整空间。",
  "今天适合收束，不适合过度扩张。",
  "遇到分歧时，先看事实再做判断。",
];

function formatBytes(value: number) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  const kb = value / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(2)} MB`;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (Math.abs(value) >= 1_000_000_000_000 || (Math.abs(value) > 0 && Math.abs(value) < 0.000001)) {
    return value.toExponential(6);
  }
  const rounded = Number(value.toFixed(8));
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function getRegexFlags(globalMatch: boolean, ignoreCase: boolean, multiline: boolean, dotAll: boolean) {
  return `${globalMatch ? "g" : ""}${ignoreCase ? "i" : ""}${multiline ? "m" : ""}${dotAll ? "s" : ""}`;
}

function collectRegexMatches(text: string, pattern: string, flags: string) {
  if (!pattern) {
    return { matches: [] as RegexMatchItem[], replaceRegex: null as RegExp | null, error: "" };
  }
  try {
    const replaceRegex = new RegExp(pattern, flags);
    const scannerFlags = flags.includes("g") ? flags : `${flags}g`;
    const scanner = new RegExp(pattern, scannerFlags);
    const matches: RegexMatchItem[] = [];
    let match: RegExpExecArray | null;
    while ((match = scanner.exec(text))) {
      matches.push({
        index: match.index,
        end: match.index + match[0].length,
        text: match[0],
        groups: match.slice(1),
      });
      if (match[0].length === 0) {
        scanner.lastIndex += 1;
      }
      if (!flags.includes("g")) {
        break;
      }
    }
    return { matches, replaceRegex, error: "" };
  } catch (error) {
    return {
      matches: [] as RegexMatchItem[],
      replaceRegex: null,
      error: error instanceof Error ? error.message : "正则表达式无效",
    };
  }
}

function convertUnit(value: number, from: UnitItem, to: UnitItem) {
  return (value * from.factor) / to.factor;
}

function getYearProgress(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const end = new Date(date.getFullYear() + 1, 0, 1);
  return ((date.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100;
}

function getMonthProgress(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return ((date.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100;
}

function getWeekProgress(date: Date) {
  const day = (date.getDay() + 6) % 7;
  return ((day * 24 + date.getHours()) / (7 * 24)) * 100;
}

function toRmbUpper(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) {
    return "-";
  }
  const fraction = ["角", "分"];
  const digit = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
  const unit = [["元", "万", "亿"], ["", "拾", "佰", "仟"]];
  let head = amount < 0 ? "负" : "";
  let value = Math.abs(amount);
  let text = fraction
    .map((item, index) => `${digit[Math.floor(value * 10 * 10 ** index) % 10]}${item}`)
    .filter((item) => !item.startsWith("零"))
    .join("");
  text = text || "整";
  value = Math.floor(value);
  for (let index = 0; index < unit[0].length && value > 0; index += 1) {
    let part = "";
    for (let subIndex = 0; subIndex < unit[1].length && value > 0; subIndex += 1) {
      part = `${digit[value % 10]}${unit[1][subIndex]}${part}`;
      value = Math.floor(value / 10);
    }
    text = part.replace(/(零.)*零$/, "").replace(/^$/, "零") + unit[0][index] + text;
  }
  return head + text.replace(/(零.)*零元/, "元").replace(/(零.)+/g, "零").replace(/^整$/, "零元整");
}

function readHoroscopeBirthdayCache(): HoroscopeBirthdayCache {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(horoscopeBirthdayStorageKey);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as HoroscopeBirthdayCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readLifeProgressCache(): LifeProgressCache {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(lifeProgressStorageKey);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as LifeProgressCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseDateOnly(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }
    return date;
  }
  return parseDateInput(value);
}

function solarToDate(solar: any) {
  return new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
}

function getSolarLunar(date: Date) {
  return Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunar();
}

function formatLunar(lunar: any) {
  return `${lunar.getYear()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
}

function getZodiacSign(date: Date) {
  const code = (date.getMonth() + 1) * 100 + date.getDate();
  if (code >= 1222 || code <= 119) return zodiacSigns[0];
  if (code <= 218) return zodiacSigns[1];
  if (code <= 320) return zodiacSigns[2];
  if (code <= 419) return zodiacSigns[3];
  if (code <= 520) return zodiacSigns[4];
  if (code <= 621) return zodiacSigns[5];
  if (code <= 722) return zodiacSigns[6];
  if (code <= 822) return zodiacSigns[7];
  if (code <= 922) return zodiacSigns[8];
  if (code <= 1023) return zodiacSigns[9];
  if (code <= 1122) return zodiacSigns[10];
  return zodiacSigns[11];
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededNumber(seed: string, salt: string, min: number, max: number) {
  const value = hashText(`${seed}:${salt}`);
  return min + (value % (max - min + 1));
}

function seededPick<T>(items: T[], seed: string, salt: string) {
  return items[seededNumber(seed, salt, 0, items.length - 1)];
}

function includesAny(items: string[], keywords: string[]) {
  return keywords.some((keyword) => items.some((item) => item.includes(keyword)));
}

function getSceneAdvice(scene: AlmanacScene, yi: string[], ji: string[]) {
  if (scene === "general") {
    return {
      level: "参考",
      text: yi.length > ji.length ? "宜项相对更多，可以按日常节奏推进。" : "宜忌各有侧重，适合先做准备和确认。",
    };
  }
  const sceneLabel = almanacScenes.find((item) => item.value === scene)?.label ?? "事项";
  const keywords = almanacSceneKeywords[scene];
  const isGood = includesAny(yi, keywords.good);
  const isBad = includesAny(ji, keywords.bad);
  if (isGood && !isBad) {
    return { level: "偏宜", text: `黄历宜项里包含${sceneLabel}相关事项，可以作为民俗参考。` };
  }
  if (isBad && !isGood) {
    return { level: "谨慎", text: `黄历忌项里包含${sceneLabel}相关事项，民俗上会建议另择日期。` };
  }
  if (isGood && isBad) {
    return { level: "需细看", text: `${sceneLabel}相关事项同时出现在宜忌语义附近，建议结合具体事项再判断。` };
  }
  return { level: "普通", text: `当天没有明显${sceneLabel}提示，更适合作为普通日子参考。` };
}

function getHexagram(seed: string) {
  return {
    name: seededPick(hexagrams, seed, "hexagram"),
    upper: seededPick(bagua, seed, "upper"),
    lower: seededPick(bagua, seed, "lower"),
    line: seededNumber(seed, "line", 1, 6),
    hint: seededPick(hexagramHints, seed, "hint"),
  };
}

function getLunarBirthday(year: number, month: number, day: number, isLeap: boolean) {
  try {
    return Lunar.fromYmd(year, isLeap ? -month : month, day);
  } catch {
    return null;
  }
}

function daysBetween(left: Date, right: Date) {
  const leftDay = new Date(left.getFullYear(), left.getMonth(), left.getDate()).getTime();
  const rightDay = new Date(right.getFullYear(), right.getMonth(), right.getDate()).getTime();
  return Math.round((rightDay - leftDay) / (24 * 60 * 60 * 1000));
}

function getFullAge(birthday: Date, atDate: Date) {
  let age = atDate.getFullYear() - birthday.getFullYear();
  const birthdayThisYear = new Date(atDate.getFullYear(), birthday.getMonth(), birthday.getDate());
  if (atDate < birthdayThisYear) {
    age -= 1;
  }
  return Math.max(age, 0);
}

function getNextSolarBirthday(birthday: Date, atDate: Date) {
  let next = new Date(atDate.getFullYear(), birthday.getMonth(), birthday.getDate());
  if (next < new Date(atDate.getFullYear(), atDate.getMonth(), atDate.getDate())) {
    next = new Date(atDate.getFullYear() + 1, birthday.getMonth(), birthday.getDate());
  }
  return next;
}

function findLunarBirthdayOccurrence(
  month: number,
  day: number,
  isLeap: boolean,
  fromDate: Date,
  direction: "next" | "previous",
) {
  const fromLunarYear = getSolarLunar(fromDate).getYear();
  const step = direction === "next" ? 1 : -1;
  for (let offset = 0; offset <= 12; offset += 1) {
    const lunarYear = fromLunarYear + offset * step;
    const lunar = getLunarBirthday(lunarYear, month, day, isLeap);
    if (!lunar) {
      continue;
    }
    const date = solarToDate(lunar.getSolar());
    const delta = daysBetween(fromDate, date);
    if ((direction === "next" && delta >= 0) || (direction === "previous" && delta <= 0)) {
      return { lunarYear, date, lunar };
    }
  }
  return null;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(value: string) {
  if (!value) {
    message.warning("没有可复制的内容");
    return;
  }
  await navigator.clipboard.writeText(value);
  message.success("已复制");
}

function getEyeDropper() {
  return (window as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper;
}

function formatInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatWeekday(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    weekday: "long",
  }).format(date);
}

function parseDateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^-?\d+$/.test(trimmed)) {
    const raw = Number(trimmed);
    const ms = Math.abs(raw) < 10_000_000_000 ? raw * 1000 : raw;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function OutputList({ items }: { items: ToolOutput[] }) {
  return (
    <div className="utility-output-list">
      {items.map((item) => (
        <div key={item.label} className="utility-output-row">
          <span>{item.label}</span>
          <strong>{item.value || "-"}</strong>
          <button type="button" onClick={() => void copyText(item.value)}>
            <CopyOutlined />
          </button>
        </div>
      ))}
    </div>
  );
}

function parsePageSelection(input: string, totalPages: number) {
  const trimmed = input.trim();
  if (!trimmed) {
    return Array.from({ length: totalPages }, (_, index) => index);
  }

  const selected = new Set<number>();
  for (const part of trimmed.split(",")) {
    const token = part.trim();
    if (!token) {
      continue;
    }
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < 1 || end < start || end > totalPages) {
        throw new Error(`页码范围无效：${token}`);
      }
      for (let page = start; page <= end; page += 1) {
        selected.add(page - 1);
      }
      continue;
    }
    const page = Number(token);
    if (!Number.isInteger(page) || page < 1 || page > totalPages) {
      throw new Error(`页码无效：${token}`);
    }
    selected.add(page - 1);
  }

  return [...selected].sort((left, right) => left - right);
}

function baseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || "file";
}

async function loadPdfLib() {
  return import("pdf-lib");
}

async function loadPdfRenderer() {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(value: string) {
  const binary = atob(value.trim());
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeJwtPart(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(decodeBase64(padded));
}

function clampRgbChannel(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 255);
}

function parseAlpha(value?: string) {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.min(Math.max(parsed, 0), 1);
}

function normalizeHexInput(value: string) {
  const trimmed = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed.split("").map((char) => char + char).join("")}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed}`.toUpperCase();
  }
  return null;
}

function parseColorValue(value: string) {
  const normalized = normalizeHexInput(value);
  if (!normalized) {
    const rgbMatch = value
      .trim()
      .match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+)\s*)?\)$/i);
    if (rgbMatch) {
      return {
        r: clampRgbChannel(Number(rgbMatch[1])),
        g: clampRgbChannel(Number(rgbMatch[2])),
        b: clampRgbChannel(Number(rgbMatch[3])),
        a: parseAlpha(rgbMatch[4]),
      };
    }

    const hslMatch = value
      .trim()
      .match(/^hsla?\(\s*([\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+)\s*)?\)$/i);
    if (hslMatch) {
      return {
        ...hslToRgb(Number(hslMatch[1]), Number(hslMatch[2]), Number(hslMatch[3])),
        a: parseAlpha(hslMatch[4]),
      };
    }

    return null;
  }

  const raw = normalized.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
    a: undefined,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === rn) {
      h = (gn - bn) / delta + (gn < bn ? 6 : 0);
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToRgb(h: number, s: number, l: number) {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;

  if (sn === 0) {
    const value = Math.round(ln * 255);
    return { r: value, g: value, b: value };
  }

  const hueToRgb = (p: number, q: number, t: number) => {
    let nextT = t;
    if (nextT < 0) nextT += 1;
    if (nextT > 1) nextT -= 1;
    if (nextT < 1 / 6) return p + (q - p) * 6 * nextT;
    if (nextT < 1 / 2) return q;
    if (nextT < 2 / 3) return p + (q - p) * (2 / 3 - nextT) * 6;
    return p;
  };
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return {
    r: Math.round(hueToRgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, hn) * 255),
    b: Math.round(hueToRgb(p, q, hn - 1 / 3) * 255),
  };
}

function hslToHex(h: number, s: number, l: number) {
  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function luminance(r: number, g: number, b: number) {
  const channel = (value: number) => {
    const next = value / 255;
    return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(left: { r: number; g: number; b: number }, right: { r: number; g: number; b: number }) {
  const l1 = luminance(left.r, left.g, left.b);
  const l2 = luminance(right.r, right.g, right.b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function escapeQrValue(value: string) {
  return value.replace(/[\\;,:"]/g, (char) => `\\${char}`);
}

async function imageFileToJpegBytes(file: File) {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("图片读取失败"));
      nextImage.src = imageUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("当前浏览器不支持 Canvas");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (!nextBlob) {
          reject(new Error("图片转换失败"));
          return;
        }
        resolve(nextBlob);
      }, "image/jpeg", 0.92);
    });
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export function TimeTool() {
  const [now, setNow] = useState(() => new Date());
  const [input, setInput] = useState(() => String(Date.now()));
  const [birthdayCalendar, setBirthdayCalendar] = useState<BirthdayCalendar>("solar");
  const [birthday, setBirthday] = useState("2000-01-01");
  const [lunarBirthYear, setLunarBirthYear] = useState(2000);
  const [lunarBirthMonth, setLunarBirthMonth] = useState(1);
  const [lunarBirthDay, setLunarBirthDay] = useState(1);
  const [lunarBirthLeap, setLunarBirthLeap] = useState(false);
  const [ageAt, setAgeAt] = useState(() => formatDateInput(new Date()));
  const [startDate, setStartDate] = useState(() => formatDateInput(new Date()));
  const [endDate, setEndDate] = useState(() => formatDateInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
  const parsedDate = parseDateInput(input);
  const activeDate = parsedDate ?? now;
  const ageAtDate = parseDateOnly(ageAt);
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const dateDiffDays = start && end ? daysBetween(start, end) : null;
  const solarBirthdayDate = parseDateOnly(birthday);
  const lunarBirth = getLunarBirthday(lunarBirthYear, lunarBirthMonth, lunarBirthDay, lunarBirthLeap);
  const birthdayDate = birthdayCalendar === "solar" ? solarBirthdayDate : lunarBirth ? solarToDate(lunarBirth.getSolar()) : null;
  const birthLunar = birthdayDate ? getSolarLunar(birthdayDate) : null;
  const ageAtLunar = ageAtDate ? getSolarLunar(ageAtDate) : null;
  const nextBirthday =
    birthdayDate && ageAtDate
      ? birthdayCalendar === "solar"
        ? { date: getNextSolarBirthday(birthdayDate, ageAtDate), lunar: null }
        : findLunarBirthdayOccurrence(lunarBirthMonth, lunarBirthDay, lunarBirthLeap, ageAtDate, "next")
      : null;
  const previousLunarBirthday =
    birthdayCalendar === "lunar" && ageAtDate
      ? findLunarBirthdayOccurrence(lunarBirthMonth, lunarBirthDay, lunarBirthLeap, ageAtDate, "previous")
      : null;
  const nextBirthdayDays = nextBirthday && ageAtDate ? daysBetween(ageAtDate, nextBirthday.date) : null;
  const fullAge =
    birthdayDate && ageAtDate
      ? birthdayCalendar === "solar"
        ? getFullAge(birthdayDate, ageAtDate)
        : previousLunarBirthday
          ? Math.max(previousLunarBirthday.lunarYear - lunarBirthYear, 0)
          : 0
      : null;
  const virtualAge = birthLunar && ageAtLunar ? Math.max(ageAtLunar.getYear() - birthLunar.getYear() + 1, 0) : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timestampOutputs = [
    { label: "Unix 秒", value: Math.floor(activeDate.getTime() / 1000).toString() },
    { label: "Unix 毫秒", value: activeDate.getTime().toString() },
    { label: "东八区", value: formatInTimeZone(activeDate, "Asia/Shanghai") },
    { label: "UTC", value: formatInTimeZone(activeDate, "UTC") },
    { label: "星期", value: formatWeekday(activeDate, "Asia/Shanghai") },
  ];
  const ageOutputs =
    birthdayDate && ageAtDate && birthLunar
      ? [
          { label: "生日类型", value: birthdayCalendar === "solar" ? "阳历" : "阴历" },
          { label: "换算阳历", value: formatDateInput(birthdayDate) },
          { label: "对应阴历", value: formatLunar(birthLunar) },
          { label: "周岁", value: `${fullAge ?? "-"} 岁` },
          { label: "虚岁", value: `${virtualAge ?? "-"} 岁` },
          { label: "已过天数", value: `${Math.max(daysBetween(birthdayDate, ageAtDate), 0)} 天` },
          {
            label: "下次生日",
            value: nextBirthdayDays === 0 ? "今天" : nextBirthday ? `${formatDateInput(nextBirthday.date)}（${nextBirthdayDays} 天后）` : "-",
          },
        ]
      : [{ label: "年龄结果", value: "" }];
  const distanceOutputs =
    dateDiffDays === null
      ? [{ label: "日期距离", value: "" }]
      : [
          { label: "相差天数", value: `${Math.abs(dateDiffDays)} 天` },
          { label: "相差周数", value: `${(Math.abs(dateDiffDays) / 7).toFixed(1)} 周` },
          { label: "方向", value: dateDiffDays === 0 ? "同一天" : dateDiffDays > 0 ? "结束日期更晚" : "开始日期更晚" },
        ];

  return (
    <section className="section-stack utility-tool-shell">
      <Card className="panel-card utility-tool-card" bordered={false}>
        <div className="status-card-head">
          <div>
            <span className="section-chip">Time</span>
            <h3>时间 / 日期计算</h3>
            <p>时间戳互转、周岁虚岁计算和两个日期之间的距离。</p>
          </div>
        </div>
        <div className="time-tool-board">
          <section className="time-tool-block">
            <div className="time-tool-block-head">
              <strong>时间戳转换</strong>
              <span>秒 / 毫秒 / 东八区</span>
            </div>
            <div className="time-tool-body">
              <label className="utility-field">
                <span>输入时间戳、ISO 或常见日期</span>
                <Input value={input} onChange={(event) => setInput(event.target.value)} />
              </label>
              <div className="utility-actions">
                <Button onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>当前秒</Button>
                <Button onClick={() => setInput(String(Date.now()))}>当前毫秒</Button>
                <Button onClick={() => setInput(new Date().toISOString())}>当前 ISO</Button>
              </div>
              {!parsedDate && input.trim() ? <p className="utility-warning">无法识别这个时间，请检查输入。</p> : null}
              <OutputList items={timestampOutputs} />
            </div>
          </section>

          <section className="time-tool-block time-tool-birthday">
            <div className="time-tool-block-head">
              <strong>生日 / 年龄计算</strong>
              <span>支持阳历和阴历生日</span>
            </div>
            <div className="time-tool-body">
              <label className="utility-field">
                <span>生日类型</span>
                <Select<BirthdayCalendar>
                  value={birthdayCalendar}
                  options={[
                    { label: "阳历生日", value: "solar" },
                    { label: "阴历生日", value: "lunar" },
                  ]}
                  onChange={setBirthdayCalendar}
                />
              </label>
              {birthdayCalendar === "solar" ? (
                <label className="utility-field">
                  <span>出生日期</span>
                  <Input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} />
                </label>
              ) : (
                <div className="time-lunar-grid">
                  <label className="utility-field">
                    <span>农历年</span>
                    <Input
                      type="number"
                      min={1900}
                      max={2100}
                      value={lunarBirthYear}
                      onChange={(event) => setLunarBirthYear(Number(event.target.value || 0))}
                    />
                  </label>
                  <label className="utility-field">
                    <span>农历月</span>
                    <Select
                      value={lunarBirthMonth}
                      options={Array.from({ length: 12 }, (_, index) => ({ label: `${index + 1} 月`, value: index + 1 }))}
                      onChange={setLunarBirthMonth}
                    />
                  </label>
                  <label className="utility-field">
                    <span>农历日</span>
                    <Select
                      value={lunarBirthDay}
                      options={Array.from({ length: 30 }, (_, index) => ({ label: `${index + 1} 日`, value: index + 1 }))}
                      onChange={setLunarBirthDay}
                    />
                  </label>
                  <Checkbox checked={lunarBirthLeap} onChange={(event) => setLunarBirthLeap(event.target.checked)}>闰月</Checkbox>
                </div>
              )}
              <label className="utility-field">
                <span>计算到</span>
                <Input type="date" value={ageAt} onChange={(event) => setAgeAt(event.target.value)} />
              </label>
              {(!birthdayDate || !ageAtDate) && (birthday || ageAt) ? <p className="utility-warning">生日或计算日期格式不正确。</p> : null}
              {birthdayCalendar === "lunar" && !lunarBirth ? <p className="utility-warning">这个阴历日期不存在，请检查闰月或日期。</p> : null}
              <OutputList items={ageOutputs} />
            </div>
          </section>

          <section className="time-tool-block">
            <div className="time-tool-block-head">
              <strong>日期距离</strong>
              <span>计算两个日期相隔多久</span>
            </div>
            <div className="time-tool-body">
              <div className="utility-inline-grid">
                <label className="utility-field">
                  <span>开始日期</span>
                  <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </label>
                <label className="utility-field">
                  <span>结束日期</span>
                  <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
              </div>
              {(!start || !end) && (startDate || endDate) ? <p className="utility-warning">日期距离格式不正确。</p> : null}
              <OutputList items={distanceOutputs} />
            </div>
          </section>
        </div>
      </Card>
    </section>
  );
}

export function HoroscopeBirthdayTool() {
  const today = formatDateInput(new Date());
  const initialBirthdayCache = useMemo(() => readHoroscopeBirthdayCache(), []);
  const [birthdayCalendar, setBirthdayCalendar] = useState<BirthdayCalendar>(
    initialBirthdayCache.birthdayCalendar === "lunar" ? "lunar" : "solar",
  );
  const [birthday, setBirthday] = useState(initialBirthdayCache.birthday ?? "2000-01-01");
  const [lunarBirthYear, setLunarBirthYear] = useState(initialBirthdayCache.lunarBirthYear ?? 2000);
  const [lunarBirthMonth, setLunarBirthMonth] = useState(initialBirthdayCache.lunarBirthMonth ?? 1);
  const [lunarBirthDay, setLunarBirthDay] = useState(initialBirthdayCache.lunarBirthDay ?? 1);
  const [lunarBirthLeap, setLunarBirthLeap] = useState(initialBirthdayCache.lunarBirthLeap ?? false);
  const [fortuneDate, setFortuneDate] = useState(today);

  useEffect(() => {
    const cache: HoroscopeBirthdayCache = {
      birthdayCalendar,
      birthday,
      lunarBirthYear,
      lunarBirthMonth,
      lunarBirthDay,
      lunarBirthLeap,
    };
    window.localStorage.setItem(horoscopeBirthdayStorageKey, JSON.stringify(cache));
  }, [birthday, birthdayCalendar, lunarBirthDay, lunarBirthLeap, lunarBirthMonth, lunarBirthYear]);

  const fortuneAt = parseDateOnly(fortuneDate) ?? new Date();
  const solarBirthday = parseDateOnly(birthday);
  const lunarBirthday = getLunarBirthday(lunarBirthYear, lunarBirthMonth, lunarBirthDay, lunarBirthLeap);
  const birthdayDate = birthdayCalendar === "solar" ? solarBirthday : lunarBirthday ? solarToDate(lunarBirthday.getSolar()) : null;
  const birthLunar = birthdayDate ? getSolarLunar(birthdayDate) : null;
  const sign = birthdayDate ? getZodiacSign(birthdayDate) : zodiacSigns[0];
  const nextBirthday =
    birthdayDate && fortuneAt
      ? birthdayCalendar === "solar"
        ? { date: getNextSolarBirthday(birthdayDate, fortuneAt), lunar: null }
        : findLunarBirthdayOccurrence(lunarBirthMonth, lunarBirthDay, lunarBirthLeap, fortuneAt, "next")
      : null;
  const nextBirthdayDays = nextBirthday ? daysBetween(fortuneAt, nextBirthday.date) : null;
  const seed = `${sign.key}:${formatDateInput(fortuneAt)}`;
  const scores = {
    overall: seededNumber(seed, "overall", 68, 96),
    love: seededNumber(seed, "love", 62, 98),
    work: seededNumber(seed, "work", 60, 96),
    wealth: seededNumber(seed, "wealth", 58, 95),
    health: seededNumber(seed, "health", 62, 96),
  };
  const luckyColor = seededPick(luckyColors, seed, "color");
  const luckyNumber = seededNumber(seed, "number", 1, 99);
  const luckyAction = seededPick(luckyActions, seed, "action");
  const summary = seededPick(horoscopePhrases.overall, seed, "summary");
  const shareText = [
    `【${sign.name} ${formatDateInput(fortuneAt)}】`,
    `综合运势 ${scores.overall}/100：${summary}`,
    `爱情：${seededPick(horoscopePhrases.love, seed, "love-text")}`,
    `工作：${seededPick(horoscopePhrases.work, seed, "work-text")}`,
    `财运：${seededPick(horoscopePhrases.wealth, seed, "wealth-text")}`,
    `健康：${seededPick(horoscopePhrases.health, seed, "health-text")}`,
    `幸运色 ${luckyColor}，幸运数字 ${luckyNumber}，适合 ${luckyAction}。`,
  ].join("\n");
  const birthdayOutputs =
    birthdayDate && birthLunar
      ? [
          { label: "星座", value: `${sign.name} · ${sign.element}` },
          { label: "日期范围", value: sign.range },
          { label: "生肖", value: birthLunar.getYearShengXiao() },
          { label: "阳历生日", value: formatDateInput(birthdayDate) },
          { label: "阴历生日", value: formatLunar(birthLunar) },
          { label: "距离生日", value: nextBirthdayDays === 0 ? "今天" : `${nextBirthdayDays ?? "-"} 天` },
        ]
      : [{ label: "生日信息", value: "" }];
  const scoreItems = [
    { label: "综合", value: scores.overall, color: "#19C8B9" },
    { label: "爱情", value: scores.love, color: "#D85C72" },
    { label: "工作", value: scores.work, color: "#7F97E8" },
    { label: "财运", value: scores.wealth, color: "#F5C31C" },
    { label: "健康", value: scores.health, color: "#6FBA2C" },
  ];
  const adviceItems = [
    { label: "爱情", text: seededPick(horoscopePhrases.love, seed, "love-text") },
    { label: "工作", text: seededPick(horoscopePhrases.work, seed, "work-text") },
    { label: "财运", text: seededPick(horoscopePhrases.wealth, seed, "wealth-text") },
    { label: "健康", text: seededPick(horoscopePhrases.health, seed, "health-text") },
  ];

  return (
    <section className="section-stack utility-tool-shell">
      <Card className="panel-card utility-tool-card horoscope-tool-card" bordered={false}>
        <div className="status-card-head">
          <div>
            <span className="section-chip">Birthday</span>
            <h3>星座 / 生日小工具</h3>
            <p>本地计算星座、生肖、阴历阳历和每日轻娱乐运势，不接付费 API。</p>
          </div>
        </div>

        <div className="horoscope-layout">
          <div className="horoscope-input-panel">
            <label className="utility-field">
              <span>生日类型</span>
              <Select<BirthdayCalendar>
                value={birthdayCalendar}
                options={[
                  { label: "阳历生日", value: "solar" },
                  { label: "阴历生日", value: "lunar" },
                ]}
                onChange={setBirthdayCalendar}
              />
            </label>
            {birthdayCalendar === "solar" ? (
              <label className="utility-field">
                <span>出生日期</span>
                <Input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} />
              </label>
            ) : (
              <div className="time-lunar-grid">
                <label className="utility-field">
                  <span>农历年</span>
                  <Input
                    type="number"
                    min={1900}
                    max={2100}
                    value={lunarBirthYear}
                    onChange={(event) => setLunarBirthYear(Number(event.target.value || 0))}
                  />
                </label>
                <label className="utility-field">
                  <span>农历月</span>
                  <Select
                    value={lunarBirthMonth}
                    options={Array.from({ length: 12 }, (_, index) => ({ label: `${index + 1} 月`, value: index + 1 }))}
                    onChange={setLunarBirthMonth}
                  />
                </label>
                <label className="utility-field">
                  <span>农历日</span>
                  <Select
                    value={lunarBirthDay}
                    options={Array.from({ length: 30 }, (_, index) => ({ label: `${index + 1} 日`, value: index + 1 }))}
                    onChange={setLunarBirthDay}
                  />
                </label>
                <Checkbox checked={lunarBirthLeap} onChange={(event) => setLunarBirthLeap(event.target.checked)}>闰月</Checkbox>
              </div>
            )}
            <label className="utility-field">
              <span>运势日期</span>
              <Input type="date" value={fortuneDate} onChange={(event) => setFortuneDate(event.target.value)} />
            </label>
            {birthdayCalendar === "lunar" && !lunarBirthday ? <p className="utility-warning">这个阴历日期不存在，请检查闰月或日期。</p> : null}
            <OutputList items={birthdayOutputs} />
          </div>

          <div className="horoscope-result-panel">
            <div className="horoscope-hero" style={{ background: luckyColor }}>
              <span>{formatDateInput(fortuneAt)}</span>
              <strong>{sign.name}</strong>
              <p>{summary}</p>
            </div>
            <div className="horoscope-score-grid">
              {scoreItems.map((item) => (
                <div key={item.label} className="horoscope-score-item">
                  <span>{item.label}</span>
                  <strong style={{ color: item.color }}>{item.value}</strong>
                  <small>/ 100</small>
                </div>
              ))}
            </div>
            <div className="horoscope-lucky-row">
              <span>幸运色 <i style={{ background: luckyColor }} /> {luckyColor}</span>
              <span>幸运数字 {luckyNumber}</span>
              <span>适合 {luckyAction}</span>
            </div>
            <div className="horoscope-advice-grid">
              {adviceItems.map((item) => (
                <div key={item.label}>
                  <strong>{item.label}</strong>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
            <div className="utility-actions">
              <Button icon={<CopyOutlined />} onClick={() => void copyText(shareText)}>复制分享文案</Button>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

export function AlmanacTool() {
  const [date, setDate] = useState(() => formatDateInput(new Date()));
  const [hour, setHour] = useState(9);
  const [scene, setScene] = useState<AlmanacScene>("general");
  const activeDate = parseDateOnly(date) ?? new Date();
  const solar = Solar.fromYmdHms(activeDate.getFullYear(), activeDate.getMonth() + 1, activeDate.getDate(), hour, 0, 0);
  const lunar = solar.getLunar();
  const yi = (lunar.getDayYi(2) as string[]) ?? [];
  const ji = (lunar.getDayJi(2) as string[]) ?? [];
  const festivals = [...lunar.getFestivals(), ...lunar.getOtherFestivals()].filter(Boolean);
  const jieQi = lunar.getJieQi();
  const advice = getSceneAdvice(scene, yi, ji);
  const hexagram = getHexagram(`${date}:${hour}`);
  const coreOutputs = [
    { label: "阳历", value: solar.toYmd() },
    { label: "农历", value: formatLunar(lunar) },
    { label: "生肖", value: lunar.getYearShengXiao() },
    { label: "节气/节日", value: [jieQi, ...festivals].filter(Boolean).join("、") || "-" },
    { label: "场景判断", value: `${advice.level} · ${advice.text}` },
  ];
  const ganzhiOutputs = [
    { label: "年柱", value: `${lunar.getYearInGanZhi()} ${lunar.getYearNaYin()}` },
    { label: "月柱", value: `${lunar.getMonthInGanZhi()} ${lunar.getMonthNaYin()}` },
    { label: "日柱", value: `${lunar.getDayInGanZhi()} ${lunar.getDayNaYin()}` },
    { label: "时柱", value: `${lunar.getTimeInGanZhi()} ${lunar.getTimeNaYin()}` },
    { label: "五行纳音", value: lunar.getDayNaYin() },
  ];
  const directionOutputs = [
    { label: "冲煞", value: `${lunar.getChongDesc()} 煞${lunar.getSha()}` },
    { label: "喜神", value: lunar.getPositionXiDesc() },
    { label: "福神", value: lunar.getPositionFuDesc() },
    { label: "财神", value: lunar.getPositionCaiDesc() },
    { label: "星宿", value: `${lunar.getXiu()}${lunar.getZheng()}${lunar.getAnimal()} · ${lunar.getXiuLuck()}` },
    { label: "彭祖", value: `${lunar.getPengZuGan()} ${lunar.getPengZuZhi()}` },
  ];
  const hexagramText = `本卦 ${hexagram.name}，上${hexagram.upper}下${hexagram.lower}，动爻 ${hexagram.line}。${hexagram.hint}`;

  return (
    <section className="section-stack utility-tool-shell">
      <Card className="panel-card utility-tool-card almanac-tool-card" bordered={false}>
        <div className="status-card-head">
          <div>
            <span className="section-chip">Almanac</span>
            <h3>传统黄历 / 五行易卦</h3>
            <p>本地计算农历、干支、五行纳音、宜忌和每日一卦，仅作民俗文化参考。</p>
          </div>
        </div>

        <div className="almanac-layout">
          <div className="almanac-control-panel">
            <div className="utility-inline-grid">
              <label className="utility-field">
                <span>日期</span>
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label className="utility-field">
                <span>时辰</span>
                <Select
                  value={hour}
                  options={Array.from({ length: 12 }, (_, index) => {
                    const nextHour = (index * 2 + 23) % 24;
                    const labelHour = String(nextHour).padStart(2, "0");
                    return { label: `${labelHour}:00`, value: nextHour };
                  })}
                  onChange={setHour}
                />
              </label>
            </div>
            <label className="utility-field">
              <span>要看的事项</span>
              <Select<AlmanacScene> value={scene} options={almanacScenes} onChange={setScene} />
            </label>
            <div className="almanac-verdict">
              <span>{advice.level}</span>
              <strong>{almanacScenes.find((item) => item.value === scene)?.label}</strong>
              <p>{advice.text}</p>
            </div>
            <OutputList items={coreOutputs} />
          </div>

          <div className="almanac-detail-panel">
            <div className="almanac-yi-ji-grid">
              <div>
                <strong>宜</strong>
                <p>{yi.length ? yi.join("、") : "-"}</p>
              </div>
              <div>
                <strong>忌</strong>
                <p>{ji.length ? ji.join("、") : "-"}</p>
              </div>
            </div>
            <div className="almanac-section-grid">
              <div className="almanac-section">
                <span>干支五行</span>
                <OutputList items={ganzhiOutputs} />
              </div>
              <div className="almanac-section">
                <span>方位冲煞</span>
                <OutputList items={directionOutputs} />
              </div>
            </div>
            <div className="almanac-hexagram">
              <span>每日一卦</span>
              <strong>{hexagram.name}</strong>
              <p>{hexagramText}</p>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

export function QrTool() {
  const [mode, setMode] = useState<QrMode>("text");
  const [text, setText] = useState("https://example.com");
  const [ssid, setSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiHidden, setWifiHidden] = useState(false);
  const [vcardName, setVcardName] = useState("");
  const [vcardPhone, setVcardPhone] = useState("");
  const [vcardEmail, setVcardEmail] = useState("");
  const [batchText, setBatchText] = useState("");
  const [qrSize, setQrSize] = useState(280);
  const [qrMargin, setQrMargin] = useState(2);
  const [qrLevel, setQrLevel] = useState<QrErrorCorrectionLevel>("M");
  const [qrDark, setQrDark] = useState("#000000");
  const [qrLight, setQrLight] = useState("#FFFFFF");
  const [qrUrls, setQrUrls] = useState<Array<{ label: string; url: string; payload: string }>>([]);
  const [decodedQr, setDecodedQr] = useState("");

  const payloads = useMemo(() => {
    if (mode === "wifi") {
      return [
        {
          label: ssid || "WiFi",
          payload: `WIFI:T:WPA;S:${escapeQrValue(ssid)};P:${escapeQrValue(wifiPassword)};H:${wifiHidden ? "true" : "false"};;`,
        },
      ];
    }
    if (mode === "vcard") {
      return [
        {
          label: vcardName || "vCard",
          payload: ["BEGIN:VCARD", "VERSION:3.0", `FN:${vcardName}`, `TEL:${vcardPhone}`, `EMAIL:${vcardEmail}`, "END:VCARD"].join("\n"),
        },
      ];
    }
    if (mode === "batch") {
      return batchText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 20)
        .map((line, index) => ({ label: `二维码 ${index + 1}`, payload: line }));
    }
    return [{ label: "二维码", payload: text }];
  }, [batchText, mode, ssid, text, vcardEmail, vcardName, vcardPhone, wifiHidden, wifiPassword]);

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      const nextUrls = await Promise.all(
        payloads.map(async (item) => ({
          ...item,
          url: await QRCode.toDataURL(item.payload || " ", {
            width: qrSize,
            margin: qrMargin,
            color: {
              dark: qrDark,
              light: qrLight,
            },
            errorCorrectionLevel: qrLevel,
          }),
        }))
      );
      if (!cancelled) {
        setQrUrls(nextUrls);
      }
    }
    void generate();
    return () => {
      cancelled = true;
    };
  }, [payloads, qrDark, qrLevel, qrLight, qrMargin, qrSize]);

  async function downloadQrSvg(item: { label: string; payload: string }) {
    const svg = await QRCode.toString(item.payload || " ", {
      type: "svg",
      width: qrSize,
      margin: qrMargin,
      color: {
        dark: qrDark,
        light: qrLight,
      },
      errorCorrectionLevel: qrLevel,
    });
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${item.label}.svg`);
  }

  async function decodeQrFile(file: File) {
    const barcodeDetectorCtor = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
        };
      }
    ).BarcodeDetector;
    if (!barcodeDetectorCtor) {
      message.warning("当前浏览器不支持二维码解析，可换 Chrome/Edge 试试");
      return;
    }
    const bitmap = await createImageBitmap(file);
    const detector = new barcodeDetectorCtor({ formats: ["qr_code"] });
    const codes = await detector.detect(bitmap);
    setDecodedQr(codes.map((code) => code.rawValue).join("\n"));
    if (codes.length === 0) {
      message.info("没有识别到二维码");
    }
  }

  return (
    <section className="section-stack utility-tool-shell">
      <Card className="panel-card utility-tool-card" bordered={false}>
        <div className="status-card-head">
          <div>
            <span className="section-chip">QR</span>
            <h3>二维码工具</h3>
            <p>文本、链接、WiFi、名片和批量二维码生成，也支持浏览器可用时的二维码解析。</p>
          </div>
        </div>
        <div className="utility-two-column">
          <div className="utility-form-stack">
            <Select<QrMode>
              value={mode}
              options={[
                { label: "文本/链接", value: "text" },
                { label: "WiFi", value: "wifi" },
                { label: "名片", value: "vcard" },
                { label: "批量", value: "batch" },
              ]}
              onChange={setMode}
            />
            {mode === "text" ? (
              <TextArea rows={5} value={text} onChange={(event) => setText(event.target.value)} />
            ) : null}
            {mode === "wifi" ? (
              <>
                <Input placeholder="WiFi 名称 SSID" value={ssid} onChange={(event) => setSsid(event.target.value)} />
                <Input.Password placeholder="WiFi 密码" value={wifiPassword} onChange={(event) => setWifiPassword(event.target.value)} />
                <Checkbox checked={wifiHidden} onChange={(event) => setWifiHidden(event.target.checked)}>隐藏网络</Checkbox>
              </>
            ) : null}
            {mode === "vcard" ? (
              <>
                <Input placeholder="姓名" value={vcardName} onChange={(event) => setVcardName(event.target.value)} />
                <Input placeholder="电话" value={vcardPhone} onChange={(event) => setVcardPhone(event.target.value)} />
                <Input placeholder="邮箱" value={vcardEmail} onChange={(event) => setVcardEmail(event.target.value)} />
              </>
            ) : null}
            {mode === "batch" ? (
              <TextArea rows={7} placeholder="每行生成一个二维码，最多 20 个" value={batchText} onChange={(event) => setBatchText(event.target.value)} />
            ) : null}
            <div className="utility-inline-grid">
              <label className="utility-field">
                <span>尺寸 {qrSize}px</span>
                <Slider min={160} max={520} step={20} value={qrSize} onChange={setQrSize} />
              </label>
              <label className="utility-field">
                <span>留白 {qrMargin}</span>
                <Slider min={0} max={8} step={1} value={qrMargin} onChange={setQrMargin} />
              </label>
            </div>
            <div className="utility-inline-grid">
              <label className="utility-field">
                <span>纠错级别</span>
                <Select<QrErrorCorrectionLevel>
                  value={qrLevel}
                  options={[
                    { label: "L 低", value: "L" },
                    { label: "M 常用", value: "M" },
                    { label: "Q 较高", value: "Q" },
                    { label: "H 最高", value: "H" },
                  ]}
                  onChange={setQrLevel}
                />
              </label>
              <label className="utility-field">
                <span>颜色</span>
                <div className="utility-color-pair">
                  <input type="color" value={qrDark} onChange={(event) => setQrDark(event.target.value)} />
                  <input type="color" value={qrLight} onChange={(event) => setQrLight(event.target.value)} />
                </div>
              </label>
            </div>
            <label className="utility-file-label">
              <QrcodeOutlined />
              解析二维码图片
              <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && void decodeQrFile(event.target.files[0])} />
            </label>
            {decodedQr ? (
              <div className="utility-output-box">
                <span>解析结果</span>
                <pre>{decodedQr}</pre>
              </div>
            ) : null}
          </div>
          <div className="qr-result-grid">
            {qrUrls.map((item, index) => (
              <div key={item.label + index} className="qr-result-card">
                <img src={item.url} alt={item.label} />
                <strong>{item.label}</strong>
                <div className="utility-actions compact">
                  <Button icon={<CopyOutlined />} onClick={() => void copyText(item.payload)}>复制内容</Button>
                  <Button icon={<DownloadOutlined />} href={item.url} download={`${item.label}.png`}>下载</Button>
                  <Button icon={<DownloadOutlined />} onClick={() => void downloadQrSvg(item)}>SVG</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
}

export function PdfTool() {
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [pageRange, setPageRange] = useState("");
  const [imageScale, setImageScale] = useState(1.5);
  const [rotateDegrees, setRotateDegrees] = useState(90);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<DownloadResult[]>([]);

  useEffect(() => {
    return () => {
      results.forEach((result) => URL.revokeObjectURL(result.url));
    };
  }, [results]);

  function replaceResults(nextResults: DownloadResult[]) {
    setResults((current) => {
      current.forEach((result) => URL.revokeObjectURL(result.url));
      return nextResults;
    });
  }

  async function addPdfResult(name: string, bytes: Uint8Array) {
    const arrayBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(arrayBuffer).set(bytes);
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });
    return {
      name,
      url: URL.createObjectURL(blob),
      size: formatBytes(blob.size),
    };
  }

  async function mergePdfs() {
    if (pdfFiles.length < 2) {
      message.warning("请至少选择两个 PDF");
      return;
    }
    setBusy(true);
    try {
      const { PDFDocument } = await loadPdfLib();
      const merged = await PDFDocument.create();
      for (const file of pdfFiles) {
        const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      }
      replaceResults([await addPdfResult("merged.pdf", await merged.save({ useObjectStreams: true }))]);
      message.success("PDF 合并完成");
    } finally {
      setBusy(false);
    }
  }

  async function splitPdf() {
    const file = pdfFiles[0];
    if (!file) {
      message.warning("请先选择 PDF");
      return;
    }
    setBusy(true);
    try {
      const { PDFDocument } = await loadPdfLib();
      const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const pages = parsePageSelection(pageRange, source.getPageCount());
      const nextDoc = await PDFDocument.create();
      const copied = await nextDoc.copyPages(source, pages);
      copied.forEach((page) => nextDoc.addPage(page));
      replaceResults([await addPdfResult(`${baseName(file.name)}-pages.pdf`, await nextDoc.save({ useObjectStreams: true }))]);
      message.success("页面提取完成");
    } finally {
      setBusy(false);
    }
  }

  async function splitEveryPage() {
    const file = pdfFiles[0];
    if (!file) {
      message.warning("请先选择 PDF");
      return;
    }
    setBusy(true);
    try {
      const { PDFDocument } = await loadPdfLib();
      const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const pages = parsePageSelection(pageRange, source.getPageCount()).slice(0, 30);
      const nextResults: DownloadResult[] = [];
      for (const pageIndex of pages) {
        const nextDoc = await PDFDocument.create();
        const [page] = await nextDoc.copyPages(source, [pageIndex]);
        nextDoc.addPage(page);
        nextResults.push(await addPdfResult(`${baseName(file.name)}-page-${pageIndex + 1}.pdf`, await nextDoc.save({ useObjectStreams: true })));
      }
      replaceResults(nextResults);
      message.success("已按页拆分 PDF");
    } finally {
      setBusy(false);
    }
  }

  async function rotatePdf() {
    const file = pdfFiles[0];
    if (!file) {
      message.warning("请先选择 PDF");
      return;
    }
    setBusy(true);
    try {
      const { PDFDocument, degrees } = await loadPdfLib();
      const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const pages = parsePageSelection(pageRange, source.getPageCount());
      pages.forEach((pageIndex) => {
        const page = source.getPage(pageIndex);
        const nextAngle = (page.getRotation().angle + rotateDegrees) % 360;
        page.setRotation(degrees(nextAngle));
      });
      replaceResults([await addPdfResult(`${baseName(file.name)}-rotated.pdf`, await source.save({ useObjectStreams: true }))]);
      message.success("PDF 页面已旋转");
    } finally {
      setBusy(false);
    }
  }

  async function optimizePdf() {
    const file = pdfFiles[0];
    if (!file) {
      message.warning("请先选择 PDF");
      return;
    }
    setBusy(true);
    try {
      const { PDFDocument } = await loadPdfLib();
      const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const bytes = await source.save({ useObjectStreams: true, objectsPerTick: 50 });
      replaceResults([await addPdfResult(`${baseName(file.name)}-optimized.pdf`, bytes)]);
      message.success("已重新保存 PDF；图片型 PDF 不一定会变小");
    } finally {
      setBusy(false);
    }
  }

  async function imagesToPdf() {
    if (imageFiles.length === 0) {
      message.warning("请先选择图片");
      return;
    }
    setBusy(true);
    try {
      const { PDFDocument } = await loadPdfLib();
      const doc = await PDFDocument.create();
      for (const file of imageFiles) {
        const lowerName = file.name.toLowerCase();
        const bytes =
          file.type === "image/jpeg" || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")
            ? new Uint8Array(await file.arrayBuffer())
            : file.type === "image/png" || lowerName.endsWith(".png")
              ? new Uint8Array(await file.arrayBuffer())
              : await imageFileToJpegBytes(file);
        const image =
          file.type === "image/png" || lowerName.endsWith(".png")
            ? await doc.embedPng(bytes)
            : await doc.embedJpg(bytes);
        const maxWidth = 900;
        const maxHeight = 1200;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const width = image.width * scale;
        const height = image.height * scale;
        const page = doc.addPage([width, height]);
        page.drawImage(image, { x: 0, y: 0, width, height });
      }
      replaceResults([await addPdfResult("images.pdf", await doc.save({ useObjectStreams: true }))]);
      message.success("图片已转成 PDF");
    } finally {
      setBusy(false);
    }
  }

  async function pdfToImages() {
    const file = pdfFiles[0];
    if (!file) {
      message.warning("请先选择 PDF");
      return;
    }
    setBusy(true);
    try {
      const { getDocument } = await loadPdfRenderer();
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocument({ data }).promise;
      const pages = parsePageSelection(pageRange, pdf.numPages).slice(0, 10);
      const nextResults: DownloadResult[] = [];
      for (const pageIndex of pages) {
        const page = await pdf.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: imageScale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) {
          throw new Error("当前浏览器不支持 Canvas");
        }
        await page.render({ canvas, canvasContext, viewport }).promise;
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((nextBlob) => {
            if (!nextBlob) {
              reject(new Error("页面渲染失败"));
              return;
            }
            resolve(nextBlob);
          }, "image/png");
        });
        nextResults.push({
          name: `${baseName(file.name)}-page-${pageIndex + 1}.png`,
          url: URL.createObjectURL(blob),
          size: formatBytes(blob.size),
        });
      }
      replaceResults(nextResults);
      message.success("PDF 页面已转图片");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section-stack utility-tool-shell">
      <Card className="panel-card utility-tool-card" bordered={false}>
        <div className="status-card-head">
          <div>
            <span className="section-chip">PDF</span>
            <h3>PDF 工具</h3>
            <p>合并、拆分、重新保存压缩、图片转 PDF、PDF 转图片。PDF 压缩不是强保证，取决于原文件结构。</p>
          </div>
        </div>
        <div className="utility-two-column">
          <div className="utility-form-stack">
            <label className="utility-file-label">
              <FilePdfOutlined />
              选择 PDF
              <input type="file" accept="application/pdf" multiple onChange={(event) => setPdfFiles(Array.from(event.target.files ?? []))} />
            </label>
            <div className="utility-file-list">{pdfFiles.map((file) => <span key={file.name}>{file.name} · {formatBytes(file.size)}</span>)}</div>
            <label className="utility-field">
              <span>页码范围</span>
              <Input placeholder="例如 1-3,5；留空表示全部" value={pageRange} onChange={(event) => setPageRange(event.target.value)} />
            </label>
            <div className="utility-actions">
              <Button loading={busy} onClick={() => void mergePdfs()}>合并 PDF</Button>
              <Button loading={busy} onClick={() => void splitPdf()}>提取页面</Button>
              <Button loading={busy} onClick={() => void splitEveryPage()}>按页拆分</Button>
              <Button loading={busy} onClick={() => void optimizePdf()}>尝试压缩</Button>
            </div>
            <div className="utility-inline-grid">
              <label className="utility-field">
                <span>旋转角度</span>
                <Select
                  value={rotateDegrees}
                  options={[
                    { label: "顺时针 90°", value: 90 },
                    { label: "180°", value: 180 },
                    { label: "逆时针 90°", value: 270 },
                  ]}
                  onChange={setRotateDegrees}
                />
              </label>
              <div className="utility-field utility-field-action">
                <span>作用页码同上</span>
                <Button loading={busy} onClick={() => void rotatePdf()}>旋转页面</Button>
              </div>
            </div>
            <label className="utility-file-label">
              <FilePdfOutlined />
              选择图片转 PDF
              <input type="file" accept="image/*" multiple onChange={(event) => setImageFiles(Array.from(event.target.files ?? []))} />
            </label>
            <div className="utility-file-list">{imageFiles.map((file) => <span key={file.name}>{file.name} · {formatBytes(file.size)}</span>)}</div>
            <div className="utility-actions">
              <Button loading={busy} onClick={() => void imagesToPdf()}>图片转 PDF</Button>
              <Button loading={busy} onClick={() => void pdfToImages()}>PDF 转图片</Button>
            </div>
            <label className="utility-field">
              <span>PDF 转图片清晰度 {imageScale.toFixed(1)}x</span>
              <Slider min={1} max={3} step={0.5} value={imageScale} onChange={setImageScale} />
            </label>
          </div>
          <div className="utility-result-panel">
            {results.length === 0 ? <p>处理完成后会在这里显示下载文件。</p> : null}
            {results.map((result) => (
              <a key={result.url} className="utility-download-row" href={result.url} download={result.name}>
                <DownloadOutlined />
                <span>{result.name}</span>
                <strong>{result.size}</strong>
              </a>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
}

export function CodecTool() {
  const [input, setInput] = useState("Hello Qianxun");
  const [encodedInput, setEncodedInput] = useState("");
  const [jwtInput, setJwtInput] = useState("");
  const [jsonInput, setJsonInput] = useState('{"name":"Qianxun","enabled":true,"items":[1,2,3]}');
  const [decodedText, setDecodedText] = useState("");
  const [jwtDecoded, setJwtDecoded] = useState("");
  const [jsonOutput, setJsonOutput] = useState("");

  const outputs = useMemo<ToolOutput[]>(() => {
    const md5 = CryptoJS.MD5(input).toString();
    const sha1 = CryptoJS.SHA1(input).toString();
    const sha256 = CryptoJS.SHA256(input).toString();
    return [
      { label: "Base64", value: encodeBase64(input) },
      { label: "URL Encode", value: encodeURIComponent(input) },
      { label: "MD5", value: md5 },
      { label: "SHA1", value: sha1 },
      { label: "SHA256", value: sha256 },
    ];
  }, [input]);

  function decodeSelected() {
    try {
      const raw = encodedInput.trim();
      if (!raw) {
        setDecodedText("");
        return;
      }
      setDecodedText(raw.includes("%") ? decodeURIComponent(raw) : decodeBase64(raw));
    } catch {
      message.error("解码失败，请检查输入");
    }
  }

  function decodeJwt() {
    try {
      const parts = jwtInput.trim().split(".");
      if (parts.length < 2) {
        throw new Error("invalid jwt");
      }
      setJwtDecoded(JSON.stringify({
        header: decodeJwtPart(parts[0]),
        payload: decodeJwtPart(parts[1]),
      }, null, 2));
    } catch {
      message.error("JWT 解码失败");
    }
  }

  function flattenJson(value: unknown, prefix = "$"): string[] {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return [`${prefix} = []`];
      }
      return value.flatMap((item, index) => flattenJson(item, `${prefix}[${index}]`));
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return [`${prefix} = {}`];
      }
      return entries.flatMap(([key, item]) => flattenJson(item, `${prefix}.${key}`));
    }
    return [`${prefix} = ${JSON.stringify(value)}`];
  }

  function handleJson(action: "format" | "minify" | "paths") {
    try {
      const parsed = JSON.parse(jsonInput);
      if (action === "format") {
        setJsonOutput(JSON.stringify(parsed, null, 2));
      } else if (action === "minify") {
        setJsonOutput(JSON.stringify(parsed));
      } else {
        setJsonOutput(flattenJson(parsed).join("\n"));
      }
    } catch {
      message.error("JSON 解析失败");
    }
  }

  return (
    <section className="section-stack utility-tool-shell">
      <Card className="panel-card utility-tool-card" bordered={false}>
        <div className="status-card-head">
          <div>
            <span className="section-chip">Codec</span>
            <h3>Base64 / URL / Hash</h3>
            <p>Base64、URL 编解码，MD5/SHA 摘要，UUID 生成和 JWT 解码。</p>
          </div>
        </div>
        <div className="utility-two-column">
          <div className="utility-form-stack">
            <label className="utility-field">
              <span>原文</span>
              <TextArea rows={6} value={input} onChange={(event) => setInput(event.target.value)} />
            </label>
            <div className="utility-actions">
              <Button onClick={() => void copyText(crypto.randomUUID())}>复制 UUID</Button>
              <Button onClick={() => setInput("")}>清空</Button>
            </div>
            <label className="utility-field">
              <span>Base64 或 URL 编码内容</span>
              <TextArea rows={4} value={encodedInput} onChange={(event) => setEncodedInput(event.target.value)} />
            </label>
            <div className="utility-actions">
              <Button icon={<SwapOutlined />} onClick={decodeSelected}>自动解码</Button>
              <Button icon={<CopyOutlined />} onClick={() => void copyText(decodedText)}>复制解码结果</Button>
            </div>
            {decodedText ? <pre className="utility-pre">{decodedText}</pre> : null}
            <label className="utility-field">
              <span>JWT</span>
              <TextArea rows={3} value={jwtInput} onChange={(event) => setJwtInput(event.target.value)} />
            </label>
            <Button icon={<LinkOutlined />} onClick={decodeJwt}>解码 JWT</Button>
            {jwtDecoded ? <pre className="utility-pre">{jwtDecoded}</pre> : null}
            <label className="utility-field">
              <span>JSON</span>
              <TextArea rows={4} value={jsonInput} onChange={(event) => setJsonInput(event.target.value)} />
            </label>
            <div className="utility-actions">
              <Button onClick={() => handleJson("format")}>格式化</Button>
              <Button onClick={() => handleJson("minify")}>压缩</Button>
              <Button onClick={() => handleJson("paths")}>提取路径</Button>
              <Button icon={<CopyOutlined />} onClick={() => void copyText(jsonOutput)}>复制结果</Button>
            </div>
            {jsonOutput ? <pre className="utility-pre">{jsonOutput}</pre> : null}
          </div>
          <OutputList items={outputs} />
        </div>
      </Card>
    </section>
  );
}

export function ColorTool() {
  const [hex, setHex] = useState("#19C8B9");
  const [contrastHex, setContrastHex] = useState("#FFFFFF");
  const [picking, setPicking] = useState<"main" | "contrast" | null>(null);
  const parsedColor = parseColorValue(hex);
  const rgb = parsedColor ?? { r: 25, g: 200, b: 185 };
  const normalizedHex = rgbToHex(rgb.r, rgb.g, rgb.b);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const parsedContrastColor = parseColorValue(contrastHex);
  const contrastRgb = parsedContrastColor ?? { r: 255, g: 255, b: 255 };
  const normalizedContrastHex = rgbToHex(contrastRgb.r, contrastRgb.g, contrastRgb.b);
  const ratio = contrastRatio(rgb, contrastRgb);
  const palette = [
    { key: "base", label: "当前", hex: normalizedHex },
    { key: "complement", label: "互补", hex: hslToHex(hsl.h + 180, hsl.s, hsl.l) },
    { key: "analog-plus", label: "类似 +30", hex: hslToHex(hsl.h + 30, hsl.s, hsl.l) },
    { key: "analog-minus", label: "类似 -30", hex: hslToHex(hsl.h - 30, hsl.s, hsl.l) },
    { key: "light", label: "更亮", hex: hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 18, 92)) },
    { key: "dark", label: "更暗", hex: hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 18, 12)) },
  ];
  const outputs = [
    { label: "HEX", value: normalizedHex },
    { label: "RGB", value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
    {
      label: "RGBA",
      value: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${parsedColor?.a ?? 1})`,
    },
    { label: "HSL", value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
    { label: "对比度", value: `${ratio.toFixed(2)} : 1 ${ratio >= 4.5 ? "AA 可读" : "偏低"}` },
  ];

  async function pickScreenColor(target: "main" | "contrast") {
    const EyeDropper = getEyeDropper();
    if (!EyeDropper) {
      message.warning("当前浏览器不支持屏幕取色，请使用新版 Chrome 或 Edge");
      return;
    }

    setPicking(target);
    try {
      const result = await new EyeDropper().open();
      if (target === "main") {
        setHex(result.sRGBHex.toUpperCase());
      } else {
        setContrastHex(result.sRGBHex.toUpperCase());
      }
      message.success("已取色");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        message.error("取色失败");
      }
    } finally {
      setPicking(null);
    }
  }

  return (
    <section className="section-stack utility-tool-shell">
      <Card className="panel-card utility-tool-card" bordered={false}>
        <div className="status-card-head">
          <div>
            <span className="section-chip">Color</span>
            <h3>颜色工具</h3>
            <p>HEX/RGB/HSL 转换、对比度检查和配色生成。</p>
          </div>
        </div>
        <div className="utility-two-column">
          <div className="utility-form-stack">
            <div className="color-picker-row">
              <input type="color" value={normalizedHex} onChange={(event) => setHex(event.target.value)} />
              <Input value={hex} onChange={(event) => setHex(event.target.value)} />
            </div>
            <div className="utility-actions">
              <Button loading={picking === "main"} onClick={() => void pickScreenColor("main")}>屏幕取色</Button>
              <Button loading={picking === "contrast"} onClick={() => void pickScreenColor("contrast")}>取对比色</Button>
            </div>
            <label className="utility-field">
              <span>对比色</span>
              <div className="color-picker-row">
                <input type="color" value={normalizedContrastHex} onChange={(event) => setContrastHex(event.target.value)} />
                <Input value={contrastHex} onChange={(event) => setContrastHex(event.target.value)} />
              </div>
            </label>
            <div className="color-contrast-preview" style={{ background: normalizedHex, color: normalizedContrastHex }}>
              Qianxun Console
            </div>
            <div className="color-palette-grid">
              {palette.map((item) => (
                <button key={item.label} type="button" className="color-swatch-card" onClick={() => setHex(item.hex)}>
                  <span style={{ background: item.hex }} />
                  <strong>{item.label}</strong>
                  <small>{item.hex}</small>
                </button>
              ))}
            </div>
          </div>
          <OutputList items={outputs} />
        </div>
      </Card>
    </section>
  );
}

function titleCase(value: string) {
  return value.replace(/\S+/g, (word) => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase());
}

function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];
    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function detectDelimiter(value: string) {
  const firstLine = value.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.includes("\t") ? "\t" : ",";
}

function tableToJson(value: string) {
  const delimiter = detectDelimiter(value);
  const lines = value.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    throw new Error("表格至少需要表头和一行数据");
  }
  const headers = parseDelimitedLine(lines[0], delimiter).map((item, index) => item.trim() || `field_${index + 1}`);
  const rows = lines.slice(1).map((line) => {
    const cells = parseDelimitedLine(line, delimiter);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = cells[index] ?? "";
      return record;
    }, {});
  });
  return JSON.stringify(rows, null, 2);
}

function jsonToCsv(value: string) {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new Error("JSON 需要是对象数组");
  }
  const headers = Array.from(new Set(parsed.flatMap((item) => Object.keys(item as Record<string, unknown>))));
  const rows = parsed.map((item) => headers.map((header) => csvEscape((item as Record<string, unknown>)[header])).join(","));
  return [headers.map(csvEscape).join(","), ...rows].join("\n");
}

function RegexHighlight({ text, matches }: { text: string; matches: RegexMatchItem[] }) {
  if (matches.length === 0) {
    return <pre className="regex-highlight-box">{text || "等待输入测试文本"}</pre>;
  }
  const parts: Array<{ text: string; hit: boolean; key: string }> = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    if (match.index > cursor) {
      parts.push({ text: text.slice(cursor, match.index), hit: false, key: `plain-${index}` });
    }
    parts.push({ text: text.slice(match.index, match.end), hit: true, key: `hit-${index}` });
    cursor = match.end;
  });
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), hit: false, key: "plain-last" });
  }
  return (
    <pre className="regex-highlight-box">
      {parts.map((part) => part.hit ? <mark key={part.key}>{part.text}</mark> : <span key={part.key}>{part.text}</span>)}
    </pre>
  );
}

export function RegexTool() {
  const [pattern, setPattern] = useState("[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}");
  const [text, setText] = useState("联系我：hello@example.com\n备用邮箱：team@qianxun.dev");
  const [replaceWith, setReplaceWith] = useState("[邮箱]");
  const [globalMatch, setGlobalMatch] = useState(true);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [multiline, setMultiline] = useState(true);
  const [dotAll, setDotAll] = useState(false);
  const flags = getRegexFlags(globalMatch, ignoreCase, multiline, dotAll);
  const regexResult = useMemo(() => collectRegexMatches(text, pattern, flags), [flags, pattern, text]);
  const replacementPreview = regexResult.replaceRegex ? text.replace(regexResult.replaceRegex, replaceWith) : "";
  const stats = [
    { label: "Flags", value: flags || "-" },
    { label: "匹配数量", value: String(regexResult.matches.length) },
    { label: "首个位置", value: regexResult.matches[0] ? String(regexResult.matches[0].index) : "-" },
  ];

  return (
    <section className="section-stack utility-tool-shell">
      <Card className="panel-card utility-tool-card" bordered={false}>
        <div className="status-card-head">
          <div>
            <span className="section-chip">Regex</span>
            <h3>正则测试器</h3>
            <p>实时匹配、高亮结果、常用模板和替换预览，全部在浏览器本地执行。</p>
          </div>
        </div>
        <div className="regex-tool-layout">
          <div className="utility-form-stack">
            <label className="utility-field">
              <span>常用模板</span>
              <Select
                placeholder="选择模板"
                options={regexTemplates.map((item) => ({ label: item.label, value: item.pattern }))}
                onChange={setPattern}
              />
            </label>
            <label className="utility-field">
              <span>正则表达式</span>
              <Input value={pattern} onChange={(event) => setPattern(event.target.value)} />
            </label>
            <div className="utility-option-grid regex-flag-grid">
              <Checkbox checked={globalMatch} onChange={(event) => setGlobalMatch(event.target.checked)}>g 全局</Checkbox>
              <Checkbox checked={ignoreCase} onChange={(event) => setIgnoreCase(event.target.checked)}>i 忽略大小写</Checkbox>
              <Checkbox checked={multiline} onChange={(event) => setMultiline(event.target.checked)}>m 多行</Checkbox>
              <Checkbox checked={dotAll} onChange={(event) => setDotAll(event.target.checked)}>s 点匹配换行</Checkbox>
            </div>
            <label className="utility-field">
              <span>测试文本</span>
              <TextArea rows={10} value={text} onChange={(event) => setText(event.target.value)} />
            </label>
            <label className="utility-field">
              <span>替换为</span>
              <Input value={replaceWith} onChange={(event) => setReplaceWith(event.target.value)} />
            </label>
          </div>
          <div className="utility-form-stack">
            <OutputList items={stats} />
            {regexResult.error ? <p className="utility-warning">{regexResult.error}</p> : null}
            <div className="regex-panel">
              <span>高亮匹配</span>
              <RegexHighlight text={text} matches={regexResult.matches} />
            </div>
            <div className="regex-panel">
              <span>替换预览</span>
              <pre className="regex-highlight-box">{replacementPreview || "-"}</pre>
            </div>
            <div className="regex-match-list">
              {regexResult.matches.map((match, index) => (
                <button key={`${match.index}-${index}`} type="button" onClick={() => void copyText(match.text)}>
                  <strong>#{index + 1}</strong>
                  <span>{match.text}</span>
                  <small>{match.index}-{match.end}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

export function UnitConverterTool() {
  const [category, setCategory] = useState<UnitCategory>("length");
  const [value, setValue] = useState("1");
  const [fromUnit, setFromUnit] = useState("m");
  const [toUnit, setToUnit] = useState("cm");
  const [imageWidthPx, setImageWidthPx] = useState("800");
  const [imageHeightPx, setImageHeightPx] = useState("800");
  const [dpi, setDpi] = useState("300");
  const [physicalMm, setPhysicalMm] = useState("25");
  const [rmbValue, setRmbValue] = useState("1234.56");

  const units = unitGroups[category];
  useEffect(() => {
    const nextUnits = unitGroups[category];
    setFromUnit(nextUnits[0].value);
    setToUnit(nextUnits[1]?.value ?? nextUnits[0].value);
  }, [category]);

  const from = units.find((item) => item.value === fromUnit) ?? units[0];
  const to = units.find((item) => item.value === toUnit) ?? units[0];
  const numericValue = Number(value);
  const converted = convertUnit(numericValue, from, to);
  const allResults = units.map((item) => ({
    label: item.label,
    value: formatNumber(convertUnit(numericValue, from, item)),
  }));
  const widthPx = Number(imageWidthPx);
  const heightPx = Number(imageHeightPx);
  const dpiValue = Number(dpi);
  const widthMm = dpiValue > 0 ? widthPx / dpiValue * 25.4 : 0;
  const heightMm = dpiValue > 0 ? heightPx / dpiValue * 25.4 : 0;
  const widthCm = widthMm / 10;
  const heightCm = heightMm / 10;
  const pxFromMm = dpiValue > 0 ? (Number(physicalMm) / 25.4) * dpiValue : 0;
  const rmbUpper = toRmbUpper(Number(rmbValue));

  function swapUnits() {
    setFromUnit(to.value);
    setToUnit(from.value);
  }

  return (
    <section className="section-stack utility-tool-shell">
      <Card className="panel-card utility-tool-card" bordered={false}>
        <div className="status-card-head">
          <div>
            <span className="section-chip">Unit</span>
            <h3>单位换算工具</h3>
            <p>常用单位、图片 DPI、毫米/像素和人民币大写换算。</p>
          </div>
        </div>
        <div className="unit-tool-layout">
          <div className="utility-form-stack">
            <div className="unit-main-card">
              <div className="unit-card-title">
                <strong>标准换算</strong>
                <span>选类别后只展示同类单位</span>
              </div>
              <div className="unit-input-grid">
                <label className="utility-field">
                  <span>类别</span>
                  <Select<UnitCategory> value={category} options={unitCategoryOptions} onChange={setCategory} />
                </label>
                <label className="utility-field">
                  <span>数值</span>
                  <Input type="number" value={value} onChange={(event) => setValue(event.target.value)} />
                </label>
                <label className="utility-field">
                  <span>从</span>
                  <Select value={fromUnit} options={units.map((item) => ({ label: item.label, value: item.value }))} onChange={setFromUnit} />
                </label>
                <label className="utility-field">
                  <span>到</span>
                  <Select value={toUnit} options={units.map((item) => ({ label: item.label, value: item.value }))} onChange={setToUnit} />
                </label>
              </div>
              <div className="unit-result-hero">
                <div>
                  <span>{value || "0"} {from.label} {"->"} {to.label}</span>
                  <strong>{formatNumber(converted)}</strong>
                </div>
                <div className="unit-hero-actions">
                  <Button icon={<SwapOutlined />} onClick={swapUnits}>互换</Button>
                  <Button icon={<CopyOutlined />} onClick={() => void copyText(formatNumber(converted))}>复制</Button>
                </div>
              </div>
            </div>
            <div className="unit-side-card">
              <div className="unit-card-title">
                <strong>图片 / DPI</strong>
                <span>证件照、打印尺寸会用到</span>
              </div>
              <div className="unit-input-grid compact">
                <Input type="number" addonBefore="宽 px" value={imageWidthPx} onChange={(event) => setImageWidthPx(event.target.value)} />
                <Input type="number" addonBefore="高 px" value={imageHeightPx} onChange={(event) => setImageHeightPx(event.target.value)} />
                <Input type="number" addonBefore="DPI" value={dpi} onChange={(event) => setDpi(event.target.value)} />
                <Input type="number" addonBefore="毫米" value={physicalMm} onChange={(event) => setPhysicalMm(event.target.value)} />
              </div>
              <div className="unit-mini-output-grid">
                <button type="button" onClick={() => void copyText(`${formatNumber(widthMm)} x ${formatNumber(heightMm)} mm`)}>
                  <span>物理尺寸</span>
                  <strong>{formatNumber(widthMm)} x {formatNumber(heightMm)} mm</strong>
                </button>
                <button type="button" onClick={() => void copyText(`${formatNumber(widthCm)} x ${formatNumber(heightCm)} cm`)}>
                  <span>厘米尺寸</span>
                  <strong>{formatNumber(widthCm)} x {formatNumber(heightCm)} cm</strong>
                </button>
                <button type="button" onClick={() => void copyText(`${formatNumber(pxFromMm)} px`)}>
                  <span>{physicalMm || "0"} mm 对应像素</span>
                  <strong>{formatNumber(pxFromMm)} px</strong>
                </button>
              </div>
            </div>
            <div className="unit-side-card">
              <div className="unit-card-title">
                <strong>人民币大写</strong>
                <span>金额票据格式</span>
              </div>
              <Input type="number" value={rmbValue} onChange={(event) => setRmbValue(event.target.value)} />
              <button className="unit-rmb-result" type="button" onClick={() => void copyText(rmbUpper)}>
                {rmbUpper}
              </button>
            </div>
          </div>
          <div className="unit-result-panel">
            <div className="unit-card-title">
              <strong>同类换算</strong>
              <span>点击任意结果复制</span>
            </div>
            <div className="unit-result-grid">
              {allResults.map((item) => (
                <button
                  key={item.label}
                  className={item.label === to.label ? "is-active" : ""}
                  type="button"
                  onClick={() => void copyText(item.value)}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className="life-progress-row">
      <div>
        <span>{label}</span>
        <strong>{safeValue.toFixed(2)}%</strong>
      </div>
      <i><b style={{ width: `${safeValue}%` }} /></i>
    </div>
  );
}

export function LifeProgressTool() {
  const today = new Date();
  const lifeCache = useMemo(() => readLifeProgressCache(), []);
  const [birthday, setBirthday] = useState(() => lifeCache.birthday ?? "1995-01-01");
  const [lifeYears, setLifeYears] = useState(() => lifeCache.lifeYears ?? "80");
  const birthDate = parseDateOnly(birthday);
  const expectedYears = Math.max(Number(lifeYears) || 80, 1);
  const livedDays = birthDate ? Math.max(daysBetween(birthDate, today), 0) : 0;
  const totalDays = Math.round(expectedYears * 365.2425);
  const lifePercent = birthDate ? (livedDays / totalDays) * 100 : 0;
  const age = birthDate ? getFullAge(birthDate, today) : 0;
  const yearDay = daysBetween(new Date(today.getFullYear(), 0, 1), today) + 1;
  const cells = Array.from({ length: Math.min(Math.round(expectedYears), 100) }, (_, index) => index);
  const shareText = `今天是 ${formatDateInput(today)}，今年第 ${yearDay} 天，今年已过 ${getYearProgress(today).toFixed(2)}%，人生进度约 ${lifePercent.toFixed(2)}%。`;

  useEffect(() => {
    window.localStorage.setItem(lifeProgressStorageKey, JSON.stringify({ birthday, lifeYears }));
  }, [birthday, lifeYears]);

  function handleDownloadShareCard() {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1200;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      message.error("分享卡生成失败");
      return;
    }

    const drawRoundRect = (x: number, y: number, width: number, height: number, radius: number) => {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };
    const fillRoundRect = (x: number, y: number, width: number, height: number, radius: number, color: string) => {
      ctx.fillStyle = color;
      drawRoundRect(x, y, width, height, radius);
      ctx.fill();
    };
    const drawProgress = (label: string, value: number, y: number) => {
      const safeValue = Math.max(0, Math.min(100, value));
      ctx.fillStyle = "#9f927d";
      ctx.font = '700 26px "Noto Sans SC", sans-serif';
      ctx.fillText(label, 110, y);
      ctx.fillStyle = "#725d42";
      ctx.textAlign = "right";
      ctx.fillText(`${safeValue.toFixed(2)}%`, 790, y);
      ctx.textAlign = "left";
      fillRoundRect(110, y + 22, 680, 18, 9, "rgba(196,184,158,0.32)");
      fillRoundRect(110, y + 22, 680 * safeValue / 100, 18, 9, "#19c8b9");
    };

    ctx.fillStyle = "#f8f8f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    fillRoundRect(50, 50, 800, 1100, 36, "#fffaf0");
    ctx.strokeStyle = "#c4b89e";
    ctx.lineWidth = 4;
    drawRoundRect(50, 50, 800, 1100, 36);
    ctx.stroke();

    fillRoundRect(90, 90, 720, 210, 28, "#19c8b9");
    ctx.fillStyle = "#fffaf0";
    ctx.font = '900 46px "Noto Sans SC", sans-serif';
    ctx.fillText("Qianxun Life Card", 130, 168);
    ctx.font = '800 28px "Noto Sans SC", sans-serif';
    ctx.fillText(`今天是 ${formatDateInput(today)}，今年第 ${yearDay} 天`, 130, 226);

    ctx.fillStyle = "#725d42";
    ctx.font = '900 82px "Noto Sans SC", sans-serif';
    ctx.fillText(`${lifePercent.toFixed(2)}%`, 110, 410);
    ctx.font = '800 30px "Noto Sans SC", sans-serif';
    ctx.fillText(birthDate ? `${age} 周岁 · 已生活 ${livedDays} 天` : "输入生日后生成更完整的卡片", 110, 468);
    ctx.fillStyle = "#9f927d";
    ctx.font = '700 24px "Noto Sans SC", sans-serif';
    ctx.fillText(`按 ${expectedYears} 年估算，剩余约 ${Math.max(totalDays - livedDays, 0)} 天`, 110, 512);

    drawProgress("今年进度", getYearProgress(today), 595);
    drawProgress("本月进度", getMonthProgress(today), 675);
    drawProgress("本周进度", getWeekProgress(today), 755);
    drawProgress("人生进度", lifePercent, 835);

    ctx.fillStyle = "#725d42";
    ctx.font = '900 28px "Noto Sans SC", sans-serif';
    ctx.fillText("人生格子", 110, 955);
    const gridX = 110;
    const gridY = 990;
    const size = 22;
    const gap = 10;
    cells.forEach((_, index) => {
      const x = gridX + index % 20 * (size + gap);
      const y = gridY + Math.floor(index / 20) * (size + gap);
      fillRoundRect(x, y, size, size, 6, index < age ? "#19c8b9" : index === age ? "#f5c31c" : "#f0e8d8");
    });

    ctx.fillStyle = "#9f927d";
    ctx.font = '700 22px "Noto Sans SC", sans-serif';
    ctx.fillText("Generated by Qianxun Console", 110, 1140);

    canvas.toBlob((blob) => {
      if (!blob) {
        message.error("分享卡生成失败");
        return;
      }
      downloadBlob(blob, `qianxun-life-${formatDateInput(today)}.png`);
    }, "image/png");
  }

  return (
    <section className="section-stack utility-tool-shell">
      <Card className="panel-card utility-tool-card life-tool-card" bordered={false}>
        <div className="status-card-head">
          <div>
            <span className="section-chip">Life</span>
            <h3>人生进度 / 年度进度</h3>
            <p>看今年、本月、本周走到哪里，也可以生成一张人生格子卡。</p>
          </div>
        </div>
        <div className="life-layout">
          <div className="life-input-panel">
            <div className="utility-inline-grid">
              <label className="utility-field">
                <span>生日</span>
                <Input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} />
              </label>
              <label className="utility-field">
                <span>预期年数</span>
                <Input type="number" value={lifeYears} onChange={(event) => setLifeYears(event.target.value)} />
              </label>
            </div>
            <div className="life-hero-card">
              <span>{formatDateInput(today)}</span>
              <strong>{yearDay}</strong>
              <p>今天是今年第 {yearDay} 天，{birthDate ? `你现在约 ${age} 周岁。` : "输入生日后显示人生进度。"}</p>
            </div>
            <OutputList
              items={[
                { label: "已生活", value: `${livedDays} 天` },
                { label: "人生进度", value: `${lifePercent.toFixed(2)}%` },
                { label: "剩余估算", value: `${Math.max(totalDays - livedDays, 0)} 天` },
              ]}
            />
            <div className="utility-actions">
              <Button icon={<CopyOutlined />} onClick={() => void copyText(shareText)}>复制分享文案</Button>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadShareCard}>生成分享卡</Button>
            </div>
          </div>
          <div className="life-result-panel">
            <ProgressBar label="今年进度" value={getYearProgress(today)} />
            <ProgressBar label="本月进度" value={getMonthProgress(today)} />
            <ProgressBar label="本周进度" value={getWeekProgress(today)} />
            <ProgressBar label="人生进度" value={lifePercent} />
            <div className="life-grid-card">
              <span>人生格子</span>
              <div className="life-year-grid">
                {cells.map((index) => (
                  <i key={index} className={index < age ? "is-past" : index === age ? "is-current" : ""} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

export function TextTool() {
  const [input, setInput] = useState("  apple\nbanana\napple\n  Orange\n\nbanana  ");
  const [trimLines, setTrimLines] = useState(true);
  const [removeEmpty, setRemoveEmpty] = useState(true);
  const [uniqueLines, setUniqueLines] = useState(true);
  const [sortLines, setSortLines] = useState(false);
  const [reverseLines, setReverseLines] = useState(false);
  const [caseMode, setCaseMode] = useState<TextCaseMode>("none");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [conversionOutput, setConversionOutput] = useState("");

  const processedText = useMemo(() => {
    let rows = input.split(/\r?\n/);
    if (trimLines) {
      rows = rows.map((line) => line.trim());
    }
    if (removeEmpty) {
      rows = rows.filter((line) => line.length > 0);
    }
    if (uniqueLines) {
      rows = Array.from(new Set(rows));
    }
    if (sortLines) {
      rows = [...rows].sort((left, right) => left.localeCompare(right, "zh-CN"));
    }
    if (reverseLines) {
      rows = [...rows].reverse();
    }
    let nextText = rows.join("\n");
    if (findText) {
      try {
        nextText = useRegex
          ? nextText.replace(new RegExp(findText, "g"), replaceText)
          : nextText.split(findText).join(replaceText);
      } catch {
        nextText = rows.join("\n");
      }
    }
    if (caseMode === "upper") {
      nextText = nextText.toUpperCase();
    } else if (caseMode === "lower") {
      nextText = nextText.toLowerCase();
    } else if (caseMode === "title") {
      nextText = titleCase(nextText);
    }
    return nextText;
  }, [caseMode, findText, input, removeEmpty, replaceText, reverseLines, sortLines, trimLines, uniqueLines, useRegex]);

  const visibleOutput = conversionOutput || processedText;
  const originalRows = input.split(/\r?\n/);
  const processedRows = processedText ? processedText.split(/\r?\n/) : [];
  const stats = [
    { label: "原始行数", value: String(originalRows.length) },
    { label: "输出行数", value: String(processedRows.filter((line) => line.length > 0).length) },
    { label: "字符数", value: String(visibleOutput.length) },
    { label: "字节数", value: formatBytes(new Blob([visibleOutput]).size) },
  ];

  function convertTable() {
    try {
      setConversionOutput(tableToJson(processedText));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "表格转换失败");
    }
  }

  function convertJson() {
    try {
      setConversionOutput(jsonToCsv(input.trim() || processedText));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "JSON 转换失败");
    }
  }

  return (
    <section className="section-stack utility-tool-shell">
      <Card className="panel-card utility-tool-card" bordered={false}>
        <div className="status-card-head">
          <div>
            <span className="section-chip">Text</span>
            <h3>文本整理 / 表格转换</h3>
            <p>去重、排序、去空行、查找替换、大小写转换，顺手把 CSV/TSV 和 JSON 互转。</p>
          </div>
        </div>
        <div className="utility-two-column">
          <div className="utility-form-stack">
            <label className="utility-field">
              <span>原文、名单、CSV 或 TSV</span>
              <TextArea rows={10} value={input} onChange={(event) => {
                setInput(event.target.value);
                setConversionOutput("");
              }} />
            </label>
            <div className="utility-option-grid">
              <Checkbox checked={trimLines} onChange={(event) => setTrimLines(event.target.checked)}>去首尾空格</Checkbox>
              <Checkbox checked={removeEmpty} onChange={(event) => setRemoveEmpty(event.target.checked)}>去空行</Checkbox>
              <Checkbox checked={uniqueLines} onChange={(event) => setUniqueLines(event.target.checked)}>按行去重</Checkbox>
              <Checkbox checked={sortLines} onChange={(event) => setSortLines(event.target.checked)}>排序</Checkbox>
              <Checkbox checked={reverseLines} onChange={(event) => setReverseLines(event.target.checked)}>反转</Checkbox>
              <Checkbox checked={useRegex} onChange={(event) => setUseRegex(event.target.checked)}>正则替换</Checkbox>
            </div>
            <div className="utility-inline-grid">
              <label className="utility-field">
                <span>查找</span>
                <Input value={findText} onChange={(event) => setFindText(event.target.value)} />
              </label>
              <label className="utility-field">
                <span>替换为</span>
                <Input value={replaceText} onChange={(event) => setReplaceText(event.target.value)} />
              </label>
            </div>
            <label className="utility-field">
              <span>大小写</span>
              <Select<TextCaseMode>
                value={caseMode}
                options={[
                  { label: "不处理", value: "none" },
                  { label: "全部大写", value: "upper" },
                  { label: "全部小写", value: "lower" },
                  { label: "标题格式", value: "title" },
                ]}
                onChange={setCaseMode}
              />
            </label>
            <div className="utility-actions">
              <Button onClick={convertTable}>表格转 JSON</Button>
              <Button onClick={convertJson}>JSON 转 CSV</Button>
              <Button onClick={() => setConversionOutput("")}>回到文本整理</Button>
              <Button onClick={() => setInput("")}>清空</Button>
            </div>
          </div>
          <div className="utility-form-stack">
            <OutputList items={stats} />
            <label className="utility-field">
              <span>输出结果</span>
              <TextArea rows={14} value={visibleOutput} readOnly />
            </label>
            <div className="utility-actions">
              <Button icon={<CopyOutlined />} onClick={() => void copyText(visibleOutput)}>复制结果</Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => downloadBlob(new Blob([visibleOutput], { type: "text/plain;charset=utf-8" }), "qianxun-text.txt")}
              >
                下载 TXT
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
