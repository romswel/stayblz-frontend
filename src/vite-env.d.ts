/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

/** From package.json, set in vite.config.ts. */
declare const __APP_VERSION__: string;
/** Short commit id of the deployed build ("local" on a developer machine). */
declare const __APP_BUILD__: string;
