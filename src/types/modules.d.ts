/*!
 * express
 * Type declarations for modules without official @types packages.
 * MIT Licensed
 */

// ────────────────────────────────────────────────────────────────────────────────
// router
// ────────────────────────────────────────────────────────────────────────────────
declare module 'router' {
  import type * as http from 'node:http';

  export interface RouterOptions {
    caseSensitive?: boolean;
    mergeParams?: boolean;
    strict?: boolean;
  }

  export type NextFunction = (err?: unknown) => void;
  export type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse, next: NextFunction) => void;
  export type ParamHandler = (req: http.IncomingMessage, res: http.ServerResponse, next: NextFunction, value: string, name: string) => void;

  export interface Route {
    path: string;
    stack: unknown[];
    all(...handlers: RequestHandler[]): this;
    [method: string]: unknown;
  }

  export interface Router extends RequestHandler {
    params: Record<string, unknown[]>;
    handle(req: http.IncomingMessage, res: http.ServerResponse, callback: NextFunction): void;
    use(path: string | RegExp | (string | RegExp)[] | RequestHandler, ...handlers: RequestHandler[]): this;
    route(path: string | RegExp | (string | RegExp)[]): Route;
    param(name: string, handler: ParamHandler): this;
    [method: string]: unknown;
  }

  export interface Route {
    path: string;
    stack: unknown[];
  }

  const RouterFactory: {
    (options?: RouterOptions): Router;
    new(options?: RouterOptions): Router;
    Route: new (path: string) => Route;
  };

  export = RouterFactory;
}
