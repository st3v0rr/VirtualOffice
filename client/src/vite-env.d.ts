/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string
  readonly VITE_OFFICE_LATITUDE?: string
  readonly VITE_OFFICE_LONGITUDE?: string
}

declare module '*.png'
