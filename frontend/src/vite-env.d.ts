/// <reference types="vite/client" />

declare module "lunar-javascript" {
  export const Solar: any;
  export const Lunar: any;
}

interface Window {
  __ENV__?: Record<string, string | undefined>;
}
