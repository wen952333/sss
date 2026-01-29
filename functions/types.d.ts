
// Cloudflare Pages Function types with D1 support

export interface Env {
  DB: any;
  API_KEY?: string;
}

export type PluginData = Record<string, unknown>;

export type PagesFunction<
  T = unknown,
  Params extends string = any
> = (context: {
  request: Request;
  functionPath: string;
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
  next(input?: Request | string, init?: RequestInit): Promise<Response>;
  env: Env;
  params: any;
  data: any;
}) => Response | Promise<Response>;
