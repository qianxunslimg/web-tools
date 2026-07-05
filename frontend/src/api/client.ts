import { env } from "../env";
import type {
  BypAnalysisData,
  CommonResponse,
  OpsFeatureFlagListData,
  OpsFeatureFlagRecord,
  OpsLogFileListData,
  OpsLogTailData,
  OpsOverviewData,
  OpsQueryableTableListData,
  OpsTableQueryFilter,
  OpsTableQueryResult,
  ServiceHealthData,
  SiteRuntimeData,
} from "./types";

const API_PREFIX = "/api/v1";

type ApiErrorPayload = {
  message?: string;
  detail?: string;
};

type RequestStatusSnapshot = {
  status: string;
  error: string;
};

type RequestStatusListener = (snapshot: RequestStatusSnapshot) => void;
export type BlobDownload = {
  blob: Blob;
  filename: string;
};

const requestStatusListeners = new Set<RequestStatusListener>();
let requestStatusSnapshot: RequestStatusSnapshot = {
  status: "",
  error: "",
};

function normalizeSuccessMessage(value?: string | null) {
  const text = (value || "").trim();
  if (!text || text === "ok") {
    return "success";
  }
  return text;
}

function publishRequestStatus(next: RequestStatusSnapshot) {
  requestStatusSnapshot = next;
  requestStatusListeners.forEach((listener) => listener(next));
}

function extractSuccessMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string") {
      return normalizeSuccessMessage(message);
    }
  }
  return "success";
}

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

function extractDownloadFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("Content-Disposition") || "";
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1]);
  }
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }
  return fallback;
}

function extractErrorMessage(response: Response, rawText: string) {
  const text = rawText.trim();
  if (text) {
    try {
      const payload = JSON.parse(text) as ApiErrorPayload;
      if (payload.message && payload.message.trim()) {
        return payload.message.trim();
      }
      if (payload.detail && payload.detail.trim()) {
        return payload.detail.trim();
      }
    } catch {
      return text;
    }
    return text;
  }
  return response.statusText || `请求失败（HTTP ${response.status}）`;
}

async function throwRequestError(response: Response): Promise<never> {
  const text = await response.text();
  const message = extractErrorMessage(response, text);
  publishRequestStatus({ status: "", error: message });
  throw new Error(message);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${env.apiBase}${path}`, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求失败";
    publishRequestStatus({ status: "", error: message });
    throw new Error(message);
  }
  if (!response.ok) {
    await throwRequestError(response);
  }
  const payload = await response.json() as T;
  publishRequestStatus({ status: extractSuccessMessage(payload), error: "" });
  return payload;
}

async function requestBlob(path: string, init?: RequestInit, fallbackFilename = "download") {
  let response: Response;
  try {
    response = await fetch(`${env.apiBase}${path}`, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求失败";
    publishRequestStatus({ status: "", error: message });
    throw new Error(message);
  }
  if (!response.ok) {
    await throwRequestError(response);
  }
  publishRequestStatus({ status: "success", error: "" });
  return {
    blob: await response.blob(),
    filename: extractDownloadFilename(response, fallbackFilename),
  };
}

async function getJson<T>(path: string, headers?: HeadersInit): Promise<T> {
  return requestJson<T>(path, {
    method: "GET",
    headers,
  });
}

async function sendJson<T>(method: "POST" | "PUT" | "PATCH", path: string, body: unknown, headers?: HeadersInit): Promise<T> {
  return requestJson<T>(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function buildOpsHeaders(password: string) {
  return {
    "X-Ops-Password": password,
  };
}

export function subscribeRequestStatus(listener: RequestStatusListener) {
  requestStatusListeners.add(listener);
  listener(requestStatusSnapshot);
  return () => {
    requestStatusListeners.delete(listener);
  };
}

export async function fetchSiteRuntime() {
  return getJson<CommonResponse<SiteRuntimeData>>(`${API_PREFIX}/site/runtime`);
}

export async function fetchServiceHealth() {
  return getJson<CommonResponse<ServiceHealthData>>(`${API_PREFIX}/system/health`);
}

export async function analyzeByp(url: string) {
  const query = buildQuery({ url });
  return getJson<CommonResponse<BypAnalysisData>>(`${API_PREFIX}/byp_analyze/${query}`);
}

export async function fetchOpsOverview(password: string) {
  return getJson<CommonResponse<OpsOverviewData>>(`${API_PREFIX}/ops/overview`, buildOpsHeaders(password));
}

export async function fetchOpsFeatures(password: string) {
  return getJson<CommonResponse<OpsFeatureFlagListData>>(`${API_PREFIX}/ops/features`, buildOpsHeaders(password));
}

export async function updateOpsFeature(password: string, featureKey: string, enabled: boolean) {
  return sendJson<CommonResponse<OpsFeatureFlagRecord>>(
    "PUT",
    `${API_PREFIX}/ops/features/${encodeURIComponent(featureKey)}`,
    { enabled },
    buildOpsHeaders(password)
  );
}

export async function fetchOpsLogsList(password: string) {
  return getJson<CommonResponse<OpsLogFileListData>>(`${API_PREFIX}/ops/logs/list`, buildOpsHeaders(password));
}

export async function fetchOpsLogTail(
  password: string,
  params: {
    filename: string;
    lines?: number;
    keyword?: string;
    level?: string;
  }
) {
  const query = buildQuery(params);
  return getJson<CommonResponse<OpsLogTailData>>(`${API_PREFIX}/ops/logs/tail${query}`, buildOpsHeaders(password));
}

export async function downloadOpsLogFile(password: string, filename: string): Promise<BlobDownload> {
  const query = buildQuery({ filename });
  return requestBlob(
    `${API_PREFIX}/ops/logs/download${query}`,
    {
      method: "GET",
      headers: buildOpsHeaders(password),
    },
    filename
  );
}

export async function downloadOpsLogsArchive(password: string): Promise<BlobDownload> {
  return requestBlob(
    `${API_PREFIX}/ops/logs/archive`,
    {
      method: "GET",
      headers: buildOpsHeaders(password),
    },
    "site_logs.zip"
  );
}

export async function fetchOpsQueryableTables(password: string) {
  return getJson<CommonResponse<OpsQueryableTableListData>>(`${API_PREFIX}/ops/db/tables`, buildOpsHeaders(password));
}

export async function queryOpsTable(
  password: string,
  payload: {
    table: string;
    page?: number;
    page_size?: number;
    filters?: OpsTableQueryFilter[];
    order_by?: string;
    order_desc?: boolean;
    select_columns?: string[];
  }
) {
  return sendJson<CommonResponse<OpsTableQueryResult>>("POST", `${API_PREFIX}/ops/db/query`, payload, buildOpsHeaders(password));
}
