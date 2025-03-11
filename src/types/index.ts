/**
 * Type definitions for Deno and Hono
 * This helps with TypeScript errors when using Deno-specific APIs
 */

// Deno namespace declaration
declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    toObject(): { [key: string]: string };
  }

  export const env: Env;

  export function readFile(path: string): Promise<Uint8Array>;
  export function writeTextFile(path: string, data: string): Promise<void>;
  export function mkdir(
    path: string,
    options?: { recursive?: boolean }
  ): Promise<void>;

  export namespace errors {
    export class NotFound extends Error {}
    export class AlreadyExists extends Error {}
  }
}

// Hono types (simplified)
declare module "jsr:@hono/hono" {
  export class Hono {
    constructor();
    use(
      path: string,
      middleware: (c: Context, next: Next) => Promise<void> | void
    ): Hono;
    get(path: string, handler: (c: Context) => any): Hono;
    post(path: string, handler: (c: Context) => any): Hono;
    options(path: string, handler: (c: Context) => any): Hono;
    onError(handler: (err: Error, c: Context) => any): Hono;
    fetch: (request: Request, env?: any, ctx?: any) => Promise<Response>;
  }

  export interface Context {
    req: {
      url: string;
      method: string;
      path: string;
      json(): Promise<any>;
      param(name: string): string;
    };
    header(name: string, value: string): void;
    text(text: string, status?: number): Response;
    json(data: any, status?: number): Response;
    body(data: any): Response;
    html(html: string): Response;
  }

  export type Next = () => Promise<void> | void;
}
