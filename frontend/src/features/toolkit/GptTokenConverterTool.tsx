import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  LinkOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Input, Select, message } from "antd";
import { useMemo, useState } from "react";

const { TextArea } = Input;

const DEFAULT_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const DEFAULT_PRIVACY_MODE = "training_off";
const DEFAULT_PLAN_TYPE = "free";
const CHATGPT_SESSION_URL = "https://chatgpt.com/api/auth/session";

type ConverterMode = "normalize" | "to-cpa" | "to-sub";
type JsonRecord = Record<string, any>;
type SummaryItem = {
  label: string;
  value: string;
};
type ConverterOutput = {
  text: string;
  parts: BlobPart[];
  name: string;
  mime: string;
  summary: string;
};
type ConvertResult = {
  records: JsonRecord[];
  shape: string;
  backfilled: number;
  output: ConverterOutput;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function readObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function coerceTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  const text = String(value ?? "").trim();
  if (!text) {
    return 0;
  }
  if (/^-?\d+$/.test(text)) {
    return Math.max(0, Number.parseInt(text, 10));
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? 0 : Math.max(0, Math.trunc(parsed / 1000));
}

function looksLikeEmail(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || /\s/.test(text)) {
    return false;
  }
  const parts = text.split("@");
  return parts.length === 2 && Boolean(parts[0]) && Boolean(parts[1]);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: unknown) {
  let normalized = String(value ?? "").replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  if (remainder) {
    normalized += "=".repeat(4 - remainder);
  }
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function jsonToBase64Url(value: unknown) {
  return bytesToBase64Url(encoder.encode(JSON.stringify(value)));
}

function decodeJwtPayload(token: unknown): JsonRecord {
  try {
    const parts = String(token ?? "").split(".");
    if (parts.length < 2) {
      return {};
    }
    return readObject(JSON.parse(decoder.decode(base64UrlToBytes(parts[1]))));
  } catch {
    return {};
  }
}

function extractAuth(payload: JsonRecord) {
  return readObject(payload["https://api.openai.com/auth"]);
}

function extractProfile(payload: JsonRecord) {
  return readObject(payload["https://api.openai.com/profile"]);
}

function extractAccountIdFromAuth(auth: JsonRecord) {
  const accountId = firstText(auth.chatgpt_account_id, auth.account_id);
  if (accountId) {
    return accountId;
  }
  const accountUserId = firstText(auth.chatgpt_account_user_id);
  return accountUserId.includes("__") ? firstText(accountUserId.split("__").pop()) : "";
}

function extractOrganizationId(idAuth: JsonRecord, accessAuth: JsonRecord) {
  const direct = firstText(idAuth.organization_id, accessAuth.organization_id);
  if (direct) {
    return direct;
  }
  const organizations = Array.isArray(idAuth.organizations) ? idAuth.organizations : [];
  const preferred = organizations.find((org) => readObject(org).is_default) || organizations[0];
  return firstText(readObject(preferred).id);
}

function buildCompatibilityIdToken(args: JsonRecord) {
  const now = Math.trunc(Date.now() / 1000);
  const accountId = firstText(args.accountId);
  const userId = firstText(args.userId);
  const projectId = firstText(args.projectId);
  const payload = {
    aud: [firstText(args.clientId, DEFAULT_CLIENT_ID)],
    email: firstText(args.email),
    exp: now + 3600,
    iat: now,
    iss: "https://auth.openai.com",
    "https://api.openai.com/auth": {
      account_id: accountId,
      chatgpt_account_id: accountId,
      chatgpt_user_id: userId,
      user_id: userId,
      organization_id: firstText(args.organizationId),
      project_id: projectId,
      chatgpt_plan_type: firstText(args.planType, DEFAULT_PLAN_TYPE),
    },
    sub: userId || accountId || "local-compat",
  };
  return `${jsonToBase64Url({ alg: "RS256", typ: "JWT", kid: "compat" })}.${jsonToBase64Url(payload)}.${bytesToBase64Url(
    encoder.encode("local_compat_signature"),
  )}`;
}

function ensureIdTokenClaims(args: JsonRecord) {
  const token = firstText(args.idToken);
  const accountId = firstText(args.accountId);
  if (!accountId) {
    return token;
  }

  const payload = decodeJwtPayload(token);
  if (!Object.keys(payload).length) {
    return buildCompatibilityIdToken(args);
  }

  const auth = { ...extractAuth(payload) };
  const existingChatgptAccountId = firstText(auth.chatgpt_account_id);
  const existingAccountId = firstText(auth.account_id);
  if (existingChatgptAccountId && existingAccountId) {
    return token;
  }

  const resolvedAccountId = firstText(existingChatgptAccountId, existingAccountId, accountId);
  auth.chatgpt_account_id = firstText(existingChatgptAccountId, resolvedAccountId);
  auth.account_id = firstText(existingAccountId, resolvedAccountId);
  auth.chatgpt_user_id = firstText(auth.chatgpt_user_id, auth.user_id, args.userId);
  auth.user_id = firstText(auth.user_id, auth.chatgpt_user_id, args.userId);
  auth.organization_id = firstText(auth.organization_id, args.organizationId);
  auth.project_id = firstText(auth.project_id, args.projectId);
  auth.chatgpt_plan_type = firstText(auth.chatgpt_plan_type, args.planType);

  const parts = token.split(".");
  const header = parts[0] || jsonToBase64Url({ alg: "RS256", typ: "JWT", kid: "compat" });
  const signature = parts[2] || bytesToBase64Url(encoder.encode("local_compat_signature"));
  return `${header}.${jsonToBase64Url({ ...payload, "https://api.openai.com/auth": auth })}.${signature}`;
}

function finalizeRecord(record: JsonRecord) {
  const item = { ...record };
  item.chatgpt_account_id = firstText(item.chatgpt_account_id, item.account_id);
  item.project_id = firstText(item.project_id, item.workspace_id);
  item.workspace_id = firstText(item.workspace_id, item.project_id);
  item.client_id = firstText(item.client_id, DEFAULT_CLIENT_ID);
  item.plan_type = firstText(item.plan_type, DEFAULT_PLAN_TYPE);
  item.privacy_mode = firstText(item.privacy_mode, DEFAULT_PRIVACY_MODE);
  item.openai_oauth_responses_websockets_v2_enabled = Boolean(item.openai_oauth_responses_websockets_v2_enabled);
  item.openai_oauth_responses_websockets_v2_mode = firstText(item.openai_oauth_responses_websockets_v2_mode, "off");
  item.disabled = Boolean(item.disabled);
  item.id_token = ensureIdTokenClaims({
    idToken: item.id_token,
    accountId: item.chatgpt_account_id,
    userId: item.chatgpt_user_id,
    organizationId: item.organization_id,
    projectId: firstText(item.project_id, item.workspace_id),
    email: firstText(item.email, item.account_claims_email),
    planType: item.plan_type,
    clientId: item.client_id,
  });
  return item;
}

function normalizeRecord(input: unknown) {
  const item = readObject(input);
  if (!Object.keys(item).length || Array.isArray(item.accounts)) {
    return null;
  }

  const tokens = readObject(item.tokens);
  const credentials = readObject(item.credentials);
  const extra = readObject(item.extra);
  const user = readObject(item.user);
  const account = readObject(item.account);
  const providerSpecificData = readObject(item.providerSpecificData);
  const idToken = firstText(item.id_token, item.idToken, credentials.id_token, credentials.idToken, tokens.id_token, tokens.idToken);
  const accessToken = firstText(
    item.access_token,
    item.accessToken,
    credentials.access_token,
    credentials.accessToken,
    tokens.access_token,
    tokens.accessToken,
  );
  const idPayload = decodeJwtPayload(idToken);
  const accessPayload = decodeJwtPayload(accessToken);
  const idAuth = extractAuth(idPayload);
  const accessAuth = extractAuth(accessPayload);
  const accessProfile = extractProfile(accessPayload);
  const email = firstText(item.email, user.email, extra.email, credentials.email, providerSpecificData.email, item.name, idPayload.email, accessProfile.email);
  const loginIdentity = firstText(item.login_identity);

  const record = {
    version: Number.parseInt(firstText(item.version, 1), 10) || 1,
    platform: firstText(item.platform, "chatgpt"),
    email,
    password: firstText(item.password),
    login_identity: loginIdentity,
    phone: firstText(item.phone),
    access_token: accessToken,
    refresh_token: firstText(item.refresh_token, item.refreshToken, credentials.refresh_token, credentials.refreshToken, tokens.refresh_token, tokens.refreshToken),
    id_token: idToken,
    session_token: firstText(item.session_token, item.sessionToken, credentials.session_token, credentials.sessionToken, tokens.session_token, tokens.sessionToken),
    client_id: firstText(item.client_id, credentials.client_id, DEFAULT_CLIENT_ID),
    chatgpt_account_id: firstText(
      item.chatgpt_account_id,
      item.chatgptAccountId,
      item.account_id,
      account.id,
      providerSpecificData.chatgptAccountId,
      providerSpecificData.chatgpt_account_id,
      credentials.chatgpt_account_id,
      credentials.account_id,
      extractAccountIdFromAuth(idAuth),
      extractAccountIdFromAuth(accessAuth),
    ),
    chatgpt_user_id: firstText(
      item.chatgpt_user_id,
      item.chatgptUserId,
      user.id,
      providerSpecificData.chatgptUserId,
      providerSpecificData.chatgpt_user_id,
      credentials.chatgpt_user_id,
      idAuth.chatgpt_user_id,
      idAuth.user_id,
      accessAuth.chatgpt_user_id,
      accessAuth.user_id,
    ),
    organization_id: firstText(item.organization_id, credentials.organization_id, extractOrganizationId(idAuth, accessAuth)),
    project_id: firstText(item.project_id, credentials.project_id, item.workspace_id, credentials.workspace_id, idAuth.project_id, accessAuth.project_id),
    workspace_id: firstText(item.workspace_id, credentials.workspace_id, item.project_id, credentials.project_id, idAuth.project_id, accessAuth.project_id),
    created_at: coerceTimestamp(item.created_at),
    last_used: coerceTimestamp(item.last_used),
    expired: coerceTimestamp(firstText(accessPayload.exp, item.expires, item.expiresAt, item.expires_at, item.expired)),
    status: firstText(item.status),
    source: firstText(item.source, item.notes, item.accessToken ? "chatgpt_web_session" : tokens.access_token ? "codex_input" : credentials.access_token ? "sub_bundle_input" : ""),
    disabled: Boolean(item.disabled),
    auth_provider: firstText(item.auth_provider, item.authProvider),
    account_claims_email: firstText(item.account_claims_email, extra.email, idPayload.email, accessProfile.email, email),
    plan_type: firstText(
      item.plan_type,
      item.planType,
      account.plan_type,
      account.planType,
      providerSpecificData.chatgpt_plan_type,
      providerSpecificData.chatgptPlanType,
      credentials.plan_type,
      idAuth.chatgpt_plan_type,
      accessAuth.chatgpt_plan_type,
      DEFAULT_PLAN_TYPE,
    ),
    privacy_mode: firstText(item.privacy_mode, extra.privacy_mode, DEFAULT_PRIVACY_MODE),
    openai_oauth_responses_websockets_v2_enabled: Boolean(item.openai_oauth_responses_websockets_v2_enabled || extra.openai_oauth_responses_websockets_v2_enabled),
    openai_oauth_responses_websockets_v2_mode: firstText(item.openai_oauth_responses_websockets_v2_mode, extra.openai_oauth_responses_websockets_v2_mode, "off"),
  };

  if (record.login_identity && !record.phone && !looksLikeEmail(record.login_identity)) {
    record.phone = record.login_identity;
  }
  if (!record.email) {
    record.email = firstText(record.account_claims_email, record.chatgpt_account_id, "unknown-account");
  }
  return finalizeRecord(record);
}

function parseInputItems(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { items: [] as JsonRecord[], shape: "空输入" };
  }

  let root: unknown = null;
  try {
    root = JSON.parse(trimmed);
  } catch {
    root = null;
  }

  const items: JsonRecord[] = [];
  let shape = "JSONL";

  if (root && typeof root === "object" && !Array.isArray(root)) {
    const objectRoot = readObject(root);
    if (Array.isArray(objectRoot.accounts)) {
      items.push(...objectRoot.accounts.map(readObject).filter((value) => Object.keys(value).length));
      shape = "sub2api bundle JSON";
    } else {
      items.push(objectRoot);
      shape = objectRoot.accessToken ? "ChatGPT Web session JSON" : objectRoot.tokens ? "Codex JSON" : objectRoot.credentials ? "sub2api account JSON" : "Unified JSON";
    }
  } else if (Array.isArray(root)) {
    items.push(...root.map(readObject).filter((value) => Object.keys(value).length));
    shape = items[0]?.accessToken ? "ChatGPT Web session JSON 数组" : items[0]?.tokens ? "Codex JSON 数组" : items[0]?.credentials ? "sub2api account JSON 数组" : "JSON 数组";
  } else {
    for (const [index, rawLine] of trimmed.split(/\r?\n/).entries()) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      try {
        const parsed = readObject(JSON.parse(line));
        if (Array.isArray(parsed.accounts)) {
          items.push(...parsed.accounts.map(readObject).filter((value) => Object.keys(value).length));
          shape = "sub2api bundle JSONL";
        } else if (Object.keys(parsed).length) {
          items.push(parsed);
        }
      } catch (error) {
        throw new Error(`第 ${index + 1} 行不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    shape = items[0]?.accessToken ? "ChatGPT Web session JSONL" : items[0]?.tokens ? "Codex JSONL" : items[0]?.credentials ? "sub2api account JSONL" : "Unified JSONL";
  }

  return { items, shape };
}

function normalizeRecordsFromText(text: string) {
  const { items, shape } = parseInputItems(text);
  const recordMap = new Map<string, JsonRecord>();
  let backfilled = 0;

  for (const item of items) {
    const sourceIdToken = firstText(item.id_token, readObject(item.credentials).id_token, readObject(item.tokens).id_token);
    const beforeAuth = extractAuth(decodeJwtPayload(sourceIdToken));
    const hadClaims = Boolean(firstText(beforeAuth.chatgpt_account_id) && firstText(beforeAuth.account_id));
    const record = normalizeRecord(item);
    if (!record) {
      continue;
    }

    const afterAuth = extractAuth(decodeJwtPayload(record.id_token));
    const hasClaims = Boolean(firstText(afterAuth.chatgpt_account_id) && firstText(afterAuth.account_id));
    if (!hadClaims && hasClaims && firstText(record.chatgpt_account_id)) {
      backfilled += 1;
    }

    const key = firstText(record.email, record.chatgpt_account_id, globalThis.crypto?.randomUUID?.() || Math.random()).toLowerCase();
    recordMap.set(key, record);
  }

  return { records: [...recordMap.values()], shape, backfilled };
}

function toIsoUtc8(date: Date) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " +0800");
}

function sanitizeFilename(value: unknown, fallback: string) {
  const text = firstText(value, fallback).replace(/[\\/:*?"<>|\x00-\x1f]+/g, "_").replace(/\s+/g, "_");
  return text.slice(0, 90) || fallback;
}

function exportFileName(count: number, ext: string, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `chatgpt_${count}_${stamp}.${ext}`;
}

function buildCpaPayload(record: JsonRecord, now = new Date()) {
  const item = finalizeRecord(record);
  const expiresAt = firstText(item.expired) ? item.expired : coerceTimestamp(decodeJwtPayload(item.access_token).exp);
  return {
    type: "codex",
    email: item.email,
    expired: expiresAt ? toIsoUtc8(new Date(Number(expiresAt) * 1000)) : "",
    id_token: item.id_token,
    account_id: firstText(item.chatgpt_account_id),
    disabled: Boolean(item.disabled),
    access_token: item.access_token,
    session_token: item.session_token,
    last_refresh: toIsoUtc8(now),
    refresh_token: item.refresh_token,
  };
}

function buildSubAccount(record: JsonRecord, now = new Date()) {
  const item = finalizeRecord(record);
  let expiresAt = firstText(item.expired) ? Number(item.expired) : coerceTimestamp(decodeJwtPayload(item.access_token).exp);
  if (!expiresAt) {
    expiresAt = Math.trunc(now.getTime() / 1000) + 863999;
  }

  return {
    name: item.email,
    platform: "openai",
    type: "oauth",
    credentials: {
      access_token: item.access_token,
      chatgpt_account_id: item.chatgpt_account_id,
      chatgpt_user_id: item.chatgpt_user_id,
      client_id: firstText(item.client_id, DEFAULT_CLIENT_ID),
      email: item.email,
      expires_at: expiresAt,
      id_token: item.id_token,
      organization_id: item.organization_id,
      plan_type: firstText(item.plan_type, DEFAULT_PLAN_TYPE),
      refresh_token: item.refresh_token,
      session_token: item.session_token,
    },
    extra: {
      email: item.email,
      auth_provider: firstText(item.auth_provider, item.authProvider),
      source: firstText(item.source),
      openai_oauth_responses_websockets_v2_enabled: Boolean(item.openai_oauth_responses_websockets_v2_enabled),
      openai_oauth_responses_websockets_v2_mode: firstText(item.openai_oauth_responses_websockets_v2_mode, "off"),
      privacy_mode: firstText(item.privacy_mode, DEFAULT_PRIVACY_MODE),
    },
    concurrency: 10,
    priority: 1,
    rate_multiplier: 1,
    auto_pause_on_expired: true,
  };
}

function writeText(dst: Uint8Array, offset: number, text: string) {
  const bytes = encoder.encode(text);
  dst.set(bytes.slice(0, Math.max(0, dst.length - offset)), offset);
}

function tarOctal(value: number, length: number) {
  return Math.max(0, Math.trunc(value)).toString(8).padStart(length - 1, "0") + "\0";
}

function tarChecksum(header: Uint8Array) {
  let sum = 0;
  for (const byte of header) {
    sum += byte;
  }
  return `${sum.toString(8).padStart(6, "0")}\0 `;
}

function createTarArchive(files: Array<{ name: string; text: string }>, now = new Date()) {
  const blocks: Uint8Array[] = [];
  const timestamp = Math.trunc(now.getTime() / 1000);

  for (const file of files) {
    const name = sanitizeFilename(file.name, "account.json").slice(0, 99);
    const bytes = encoder.encode(file.text);
    const header = new Uint8Array(512);

    writeText(header, 0, name);
    writeText(header, 100, "0000777\0");
    writeText(header, 108, "0000000\0");
    writeText(header, 116, "0000000\0");
    writeText(header, 124, tarOctal(bytes.length, 12));
    writeText(header, 136, tarOctal(timestamp, 12));
    writeText(header, 148, "        ");
    writeText(header, 156, "0");
    writeText(header, 257, "ustar\0");
    writeText(header, 263, "00");
    writeText(header, 148, tarChecksum(header));

    blocks.push(header, bytes);
    const padding = (512 - (bytes.length % 512)) % 512;
    if (padding) {
      blocks.push(new Uint8Array(padding));
    }
  }

  blocks.push(new Uint8Array(1024));
  const output = new Uint8Array(blocks.reduce((size, block) => size + block.length, 0));
  let offset = 0;
  for (const block of blocks) {
    output.set(block, offset);
    offset += block.length;
  }
  return output;
}

function buildOutput(records: JsonRecord[], mode: ConverterMode, now = new Date()): ConverterOutput {
  if (!records.length) {
    throw new Error("当前输入里没有解析出有效记录。");
  }

  if (mode === "normalize") {
    const text = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
    return {
      text,
      parts: [text],
      name: exportFileName(records.length, "txt", now),
      mime: "application/json;charset=utf-8",
      summary: `已标准化 ${records.length} 条记录，输出 unified JSONL。`,
    };
  }

  if (mode === "to-cpa") {
    const payloads = records.map((record) => buildCpaPayload(record, now));
    if (payloads.length === 1) {
      const text = JSON.stringify(payloads[0], null, 2);
      return {
        text,
        parts: [text],
        name: exportFileName(1, "json", now),
        mime: "application/json;charset=utf-8",
        summary: "已生成 1 个 CPA token JSON。",
      };
    }
    const files = payloads.map((payload, index) => ({
      name: `${sanitizeFilename(payload.email, `account_${index + 1}`)}.json`,
      text: JSON.stringify(payload, null, 2),
    }));
    const tarBytes = createTarArchive(files, now);
    return {
      text: ["CPA .tar 包内文件：", ...files.map((file) => `- ${file.name}`)].join("\n"),
      parts: [tarBytes],
      name: exportFileName(payloads.length, "tar", now),
      mime: "application/x-tar",
      summary: `已生成 1 个 CPA tar 包，包含 ${files.length} 个单账号 JSON 文件。`,
    };
  }

  const bundle = {
    exported_at: now.toISOString(),
    proxies: [],
    accounts: records.map((record) => buildSubAccount(record, now)),
  };
  const text = JSON.stringify(bundle, null, 2);
  return {
    text,
    parts: [text],
    name: exportFileName(bundle.accounts.length, "json", now),
    mime: "application/json;charset=utf-8",
    summary: `已生成 1 个 sub2api bundle JSON，包含 ${bundle.accounts.length} 个账号。`,
  };
}

function convertText(text: string, mode: ConverterMode): ConvertResult {
  const parsed = normalizeRecordsFromText(text);
  return { ...parsed, output: buildOutput(parsed.records, mode) };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseSingleInputItem(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }
  try {
    const root = JSON.parse(trimmed);
    if (Array.isArray(root)) {
      return readObject(root[0]);
    }
    const objectRoot = readObject(root);
    if (Array.isArray(objectRoot.accounts)) {
      return readObject(objectRoot.accounts[0]);
    }
    return objectRoot;
  } catch {
    for (const rawLine of trimmed.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      try {
        return readObject(JSON.parse(line));
      } catch {
        return {};
      }
    }
  }
  return {};
}

function formatPlanName(plan: unknown) {
  const text = firstText(plan);
  const normalized = text.toLowerCase();
  if (!text) {
    return "-";
  }
  if (normalized.includes("enterprise")) {
    return "Enterprise";
  }
  if (normalized.includes("team") || normalized.includes("business")) {
    return "Team";
  }
  if (normalized.includes("plus")) {
    return "Plus";
  }
  if (normalized.includes("pro")) {
    return "Pro";
  }
  if (normalized.includes("free")) {
    return "Free";
  }
  return text;
}

function formatDateHint(value: unknown) {
  const timestamp = coerceTimestamp(value);
  if (!timestamp) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp * 1000));
}

function collectTeamHints(session: JsonRecord, idAuth: JsonRecord, accessAuth: JsonRecord) {
  const account = readObject(session.account);
  const workspace = readObject(account.workspace);
  const team = readObject(account.team);
  const organization = readObject(account.organization);
  const structure = readObject(account.structure);
  const candidates = [
    account.teamName,
    account.team_name,
    account.workspaceName,
    account.workspace_name,
    account.organizationName,
    account.organization_name,
    account.name,
    team.name,
    workspace.name,
    organization.name,
    structure.name,
  ];

  const authOrganizations = [
    ...(Array.isArray(idAuth.organizations) ? idAuth.organizations : []),
    ...(Array.isArray(accessAuth.organizations) ? accessAuth.organizations : []),
  ].map(readObject);
  const defaultOrg = authOrganizations.find((org) => org.is_default) || authOrganizations[0];
  candidates.push(defaultOrg?.title, defaultOrg?.name, defaultOrg?.display_name);

  const unique = Array.from(new Set(candidates.map((candidate) => firstText(candidate)).filter(Boolean)));
  return unique.join(" / ");
}

function buildSessionSummary(text: string, result: ConvertResult | null): SummaryItem[] {
  const session = parseSingleInputItem(text);
  const record = result?.records[0] || normalizeRecord(session) || {};
  const account = readObject(session.account);
  const user = readObject(session.user);
  const idPayload = decodeJwtPayload(firstText(record.id_token, session.id_token));
  const accessPayload = decodeJwtPayload(firstText(record.access_token, session.accessToken, session.access_token));
  const idAuth = extractAuth(idPayload);
  const accessAuth = extractAuth(accessPayload);
  const profile = extractProfile(accessPayload);
  const teamHint = collectTeamHints(session, idAuth, accessAuth);
  const orgId = firstText(record.organization_id, account.organizationId, account.organization_id, idAuth.organization_id, accessAuth.organization_id);
  const accountId = firstText(record.chatgpt_account_id, account.id, account.account_id, extractAccountIdFromAuth(idAuth), extractAccountIdFromAuth(accessAuth));
  const plan = firstText(record.plan_type, account.planType, account.plan_type, accessAuth.chatgpt_plan_type, idAuth.chatgpt_plan_type);
  const expires = formatDateHint(firstText(session.expires, session.expiresAt, session.expires_at, record.expired, accessPayload.exp));

  return [
    { label: "账号", value: firstText(record.email, user.email, profile.email, session.email, "未识别") },
    { label: "套餐", value: formatPlanName(plan) },
    { label: "Team / 工作区", value: teamHint || "-" },
    { label: "账号 ID", value: accountId || "-" },
    { label: "组织 ID", value: orgId || "-" },
    { label: "到期", value: expires || "-" },
  ];
}

export function GptTokenConverterTool() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ConverterMode>("normalize");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState("");

  const stats = useMemo(
    () => [
      { label: "识别", value: result?.shape || "等待输入" },
      { label: "记录数", value: String(result?.records.length || 0) },
      { label: "回填 claims", value: String(result?.backfilled || 0) },
    ],
    [result],
  );
  const sessionSummary = useMemo(() => buildSessionSummary(input, result), [input, result]);

  function runConvert(nextInput = input, nextMode = mode) {
    try {
      const nextResult = convertText(nextInput, nextMode);
      setResult(nextResult);
      setError("");
      message.success(nextResult.output.summary);
      return nextResult;
    } catch (convertError) {
      setResult(null);
      setError(convertError instanceof Error ? convertError.message : String(convertError));
      return null;
    }
  }

  async function copyOutput() {
    if (!result) {
      return;
    }
    await navigator.clipboard.writeText(result.output.text);
    message.success("已复制当前预览文本");
  }

  function downloadOutput() {
    if (!result) {
      return;
    }
    downloadBlob(new Blob(result.output.parts, { type: result.output.mime }), result.output.name);
  }

  function clearAll() {
    setInput("");
    setResult(null);
    setError("");
  }

  return (
    <section className="section-stack utility-tool-shell gpt-token-tool">
      <Card className="panel-card utility-tool-card" bordered={false}>
        <div className="status-card-head">
          <div>
            <span className="section-chip">Token</span>
            <h3>ChatGPT JSON / Session 转 CPA / sub2api</h3>
            <p>打开 session 页面，复制 JSON，粘贴后手动转换。</p>
          </div>
        </div>

        <Alert
          className="tool-alert"
          type="info"
          showIcon
          message="只在浏览器本地解析，不请求后端。"
        />

        <div className="utility-two-column">
          <div className="utility-form-stack">
            <div className="utility-actions">
              <Button icon={<LinkOutlined />} onClick={() => window.open(CHATGPT_SESSION_URL, "_blank", "noopener,noreferrer")}>
                打开 session
              </Button>
              <Button icon={<DeleteOutlined />} onClick={clearAll}>
                清空
              </Button>
            </div>

            {result ? (
              <div className="gpt-session-summary">
                {sessionSummary.map((item) => (
                  <div className="utility-output-item" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="utility-output-list">
              {stats.map((item) => (
                <div className="utility-output-item" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="gpt-manual-panel">
              <label className="utility-field">
                <span>原始 session / JSON</span>
                <TextArea
                  rows={18}
                  spellCheck={false}
                  value={input}
                  placeholder="粘贴 https://chatgpt.com/api/auth/session 返回的 JSON..."
                  onChange={(event) => {
                    setInput(event.target.value);
                    setResult(null);
                    setError("");
                  }}
                />
              </label>
            </div>
          </div>

          <div className="utility-form-stack">
            <label className="utility-field">
              <span>输出模式</span>
              <Select<ConverterMode>
                value={mode}
                options={[
                  { label: "标准化 JSONL", value: "normalize" },
                  { label: "转 CPA JSON", value: "to-cpa" },
                  { label: "转 sub2api bundle", value: "to-sub" },
                ]}
                onChange={setMode}
              />
            </label>
            <div className="utility-actions">
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => runConvert()}>
                转换
              </Button>
              <Button icon={<CopyOutlined />} disabled={!result} onClick={() => void copyOutput()}>
                复制
              </Button>
              <Button icon={<DownloadOutlined />} disabled={!result} onClick={downloadOutput}>
                下载
              </Button>
            </div>
            {error ? <Alert className="tool-alert" type="error" showIcon message={error} /> : null}
            <label className="utility-field">
              <span>输出</span>
              <TextArea rows={28} spellCheck={false} value={result?.output.text || "尚未生成"} readOnly />
            </label>
            <p className="utility-help-text">{result?.output.summary || "CPA 多账号会下载 .tar，包内每个账号一个 JSON 文件。"}</p>
          </div>
        </div>
      </Card>
    </section>
  );
}
