type RuntimeEnvKey = "VITE_API_BASE";

const metaEnv = import.meta.env as Record<string, string | undefined>;
const runtimeEnv = typeof window !== "undefined" ? window.__ENV__ : undefined;
const hasRuntimeEnv = Boolean(runtimeEnv && Object.keys(runtimeEnv).length > 0);

function readEnv(key: RuntimeEnvKey) {
  if (runtimeEnv && Object.prototype.hasOwnProperty.call(runtimeEnv, key)) {
    const runtimeValue = runtimeEnv[key];
    if (runtimeValue !== undefined) {
      return runtimeValue;
    }
    return undefined;
  }
  if (!hasRuntimeEnv) {
    const metaValue = metaEnv[key];
    if (metaValue !== undefined && metaValue !== "") {
      return metaValue;
    }
  }
  return undefined;
}

export const env = {
  apiBase: readEnv("VITE_API_BASE") ?? "",
};
