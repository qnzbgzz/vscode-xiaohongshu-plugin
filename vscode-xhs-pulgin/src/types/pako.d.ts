declare module 'pako' {
  export interface GzipOptions {
    level?: number;
    header?: {
      time?: number;
      os?: number;
    };
  }

  export function gzip(data: Uint8Array, options?: GzipOptions): Uint8Array;
}
