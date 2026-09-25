/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Cloud OAuth 2.0 Web Client ID (Google ile giriş için). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
