/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_DEMO_SCOPE_SLUG: string;
  readonly VITE_SSO_APP_CODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '@euac/ai-base/style.css';
