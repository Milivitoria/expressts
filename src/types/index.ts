/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

import type * as http from 'node:http';
import type * as net from 'node:net';

// ────────────────────────────────────────────────────────────────────────────────
// Utility types
// ────────────────────────────────────────────────────────────────────────────────

export type NextFunction = (err?: unknown) => void;

export type ParamsDictionary = Record<string, string>;
export type ParsedQs = { [key: string]: string | string[] | ParsedQs | ParsedQs[] | undefined };

// ────────────────────────────────────────────────────────────────────────────────
// Engine / View types
// ────────────────────────────────────────────────────────────────────────────────

/** Signature expected of a template-engine render function. */
export type EngineCallback = (err: Error | null, str?: string) => void;
export type EngineRenderFn = (path: string, options: object, callback: EngineCallback) => void;

export interface ViewOptions {
  defaultEngine?: string;
  root: string | string[];
  engines: Record<string, EngineRenderFn>;
}

// ────────────────────────────────────────────────────────────────────────────────
// ETag / Query-parser / Trust-proxy helpers
// ────────────────────────────────────────────────────────────────────────────────

export type ETagFn = (body: Buffer | string, encoding?: BufferEncoding) => string;
export type QueryParserFn = (str: string) => ParsedQs;
export type TrustProxyFn = (addr: string, i: number) => boolean;

export type ETagSetting = boolean | 'weak' | 'strong' | ETagFn;
export type QueryParserSetting = boolean | 'simple' | 'extended' | QueryParserFn;
export type TrustProxySetting = boolean | number | string | string[] | TrustProxyFn;

// ────────────────────────────────────────────────────────────────────────────────
// Application settings map
// ────────────────────────────────────────────────────────────────────────────────

export interface AppSettings {
  env: string;
  etag: ETagSetting;
  'etag fn'?: ETagFn;
  'query parser': QueryParserSetting;
  'query parser fn'?: QueryParserFn;
  'subdomain offset': number;
  'trust proxy': TrustProxySetting;
  'trust proxy fn': TrustProxyFn;
  'view': new (name: string, options: ViewOptions) => IView;
  'views': string | string[];
  'jsonp callback name': string;
  'view engine'?: string;
  'view cache'?: boolean;
  'x-powered-by'?: boolean;
  'json escape'?: boolean;
  'json replacer'?: ((key: string, value: unknown) => unknown) | null;
  'json spaces'?: number | string;
  'case sensitive routing'?: boolean;
  'strict routing'?: boolean;
  [key: string]: unknown;
}

// ────────────────────────────────────────────────────────────────────────────────
// View interface
// ────────────────────────────────────────────────────────────────────────────────

export interface IView {
  path: string | undefined;
  name: string;
  ext: string;
  root: string | string[];
  defaultEngine: string | undefined;
  engine: EngineRenderFn;
  render(options: object, callback: EngineCallback): void;
  lookup(name: string): string | undefined;
}

// ────────────────────────────────────────────────────────────────────────────────
// Request extensions
// ────────────────────────────────────────────────────────────────────────────────

export interface Request extends http.IncomingMessage {
  /** The express application. */
  app: Application;
  /** The corresponding response object. */
  res: Response;
  /** Next middleware function. */
  next: NextFunction;
  /** URL path. */
  baseUrl: string;
  /** Original URL. */
  originalUrl: string;
  /** Route parameters. */
  params: ParamsDictionary;
  /** Parsed query string. */
  readonly query: ParsedQs;
  /** Route info. */
  route?: unknown;
  /** Decoded cookies (set by cookie-parser middleware). */
  cookies: Record<string, string>;
  /** Signed cookies (set by cookie-parser middleware). */
  signedCookies: Record<string, string>;
  /** Cookie secret (set by cookie-parser middleware). */
  secret?: string | string[];
  /** Parsed body (set by body-parser middleware). */
  body: unknown;
  /** Remote IP (respects trust proxy). */
  readonly ip: string;
  /** IP list (respects trust proxy). */
  readonly ips: string[];
  /** Protocol: 'http' | 'https'. */
  readonly protocol: string;
  /** Whether TLS. */
  readonly secure: boolean;
  /** Subdomains array. */
  readonly subdomains: string[];
  /** Parsed hostname. */
  readonly hostname: string | undefined;
  /** Parsed host. */
  readonly host: string | undefined;
  /** URL pathname. */
  readonly path: string;
  /** Whether request is fresh. */
  readonly fresh: boolean;
  /** Whether request is stale. */
  readonly stale: boolean;
  /** Whether request is XHR. */
  readonly xhr: boolean;

  get(name: 'set-cookie'): string[] | undefined;
  get(name: string): string | undefined;
  header(name: 'set-cookie'): string[] | undefined;
  header(name: string): string | undefined;
  accepts(): string[];
  accepts(type: string): string | false;
  accepts(type: string[]): string | false;
  accepts(...type: string[]): string | false;
  acceptsEncodings(): string[];
  acceptsEncodings(encoding: string): string | false;
  acceptsEncodings(encoding: string[]): string | false;
  acceptsEncodings(...encoding: string[]): string | false;
  acceptsCharsets(): string[];
  acceptsCharsets(charset: string): string | false;
  acceptsCharsets(charset: string[]): string | false;
  acceptsCharsets(...charset: string[]): string | false;
  acceptsLanguages(): string[];
  acceptsLanguages(lang: string): string | false;
  acceptsLanguages(lang: string[]): string | false;
  acceptsLanguages(...lang: string[]): string | false;
  range(size: number, options?: { combine?: boolean }): import('range-parser').Result | import('range-parser').Ranges | undefined;
  is(type: string | string[]): string | false | null;
  is(...type: string[]): string | false | null;
  socket: net.Socket & { encrypted?: boolean };
}

// ────────────────────────────────────────────────────────────────────────────────
// Response extensions
// ────────────────────────────────────────────────────────────────────────────────

export interface CookieOptions {
  maxAge?: number;
  signed?: boolean;
  expires?: Date;
  httpOnly?: boolean;
  path?: string;
  domain?: string;
  secure?: boolean;
  encode?: (val: string) => string;
  sameSite?: boolean | 'lax' | 'strict' | 'none';
  partitioned?: boolean;
  priority?: 'low' | 'medium' | 'high';
  headers?: Record<string, string | string[]>;
}

export interface SendFileOptions {
  maxAge?: number | string;
  root?: string;
  lastModified?: boolean;
  headers?: Record<string, string | string[]>;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  acceptRanges?: boolean;
  cacheControl?: boolean;
  immutable?: boolean;
  etag?: boolean;
  extensions?: string | string[] | boolean;
}

export interface DownloadOptions {
  maxAge?: number | string;
  root?: string;
  lastModified?: boolean;
  headers?: Record<string, string | string[]>;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  acceptRanges?: boolean;
  cacheControl?: boolean;
  immutable?: boolean;
  etag?: boolean;
  extensions?: string | string[] | boolean;
}

export interface Response extends http.ServerResponse {
  /** The express application. */
  app: Application;
  /** The corresponding request object. */
  req: Request;
  /** Local variables scoped to the request. */
  locals: Record<string, unknown>;

  status(code: number): this;
  sendStatus(statusCode: number): this;
  links(links: Record<string, string | string[]>): this;
  send(body?: string | Buffer | object | boolean | null): this;
  json(obj: unknown): this;
  jsonp(obj: unknown): this;
  sendFile(path: string, callback?: (err?: Error) => void): void;
  sendFile(path: string, options: SendFileOptions, callback?: (err?: Error) => void): void;
  download(path: string, callback?: (err?: Error) => void): void;
  download(path: string, filename: string, callback?: (err?: Error) => void): void;
  download(path: string, filename: string, options: DownloadOptions, callback?: (err?: Error) => void): void;
  download(path: string, options: DownloadOptions, callback?: (err?: Error) => void): void;
  contentType(type: string): this;
  type(type: string): this;
  format(obj: Record<string, (req: Request, res: Response, next: NextFunction) => void> & { default?: (req: Request, res: Response, next: NextFunction) => void }): this;
  attachment(filename?: string): this;
  append(field: string, val: string | string[]): this;
  set(field: string, val: string | string[]): this;
  set(field: Record<string, string | string[]>): this;
  header(field: string, val: string | string[]): this;
  header(field: Record<string, string | string[]>): this;
  get(field: string): string | string[] | number | undefined;
  clearCookie(name: string, options?: CookieOptions): this;
  cookie(name: string, val: string | object, options?: CookieOptions): this;
  location(url: string): this;
  redirect(url: string): void;
  redirect(status: number, url: string): void;
  vary(field: string | string[]): this;
  render(view: string, callback?: EngineCallback): void;
  render(view: string, options: object, callback?: EngineCallback): void;
}

// ────────────────────────────────────────────────────────────────────────────────
// Middleware / Handler types
// ────────────────────────────────────────────────────────────────────────────────

export type RequestHandler = (req: Request, res: Response, next: NextFunction) => void;
export type ErrorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => void;
export type Handler = RequestHandler | ErrorHandler;

export type PathParams = string | RegExp | (string | RegExp)[];

export interface IRoute {
  path: string;
  stack: unknown[];
  all(...handlers: RequestHandler[]): this;
  get(...handlers: RequestHandler[]): this;
  post(...handlers: RequestHandler[]): this;
  put(...handlers: RequestHandler[]): this;
  delete(...handlers: RequestHandler[]): this;
  patch(...handlers: RequestHandler[]): this;
  options(...handlers: RequestHandler[]): this;
  head(...handlers: RequestHandler[]): this;
  [method: string]: unknown;
}

export interface IRouter {
  params: Record<string, unknown[]>;
  handle(req: Request, res: Response, callback: NextFunction): void;
  use(path: PathParams | RequestHandler, ...handlers: RequestHandler[]): this;
  route(path: PathParams): IRoute;
  param(name: string, handler: (req: Request, res: Response, next: NextFunction, value: string, name: string) => void): this;
  [method: string]: unknown;
}

// ────────────────────────────────────────────────────────────────────────────────
// Application interface
// ────────────────────────────────────────────────────────────────────────────────

export interface Application extends RequestHandler {
  /** Internal router. */
  router: IRouter;
  /** Application settings. */
  settings: AppSettings;
  /** View engine cache. */
  cache: Record<string, IView>;
  /** Template engines. */
  engines: Record<string, EngineRenderFn>;
  /** Application-level locals. */
  locals: Record<string, unknown> & { settings: AppSettings };
  /** Mount path. */
  mountpath: string | string[];
  /** Parent application, if mounted. */
  parent?: Application;
  /** Request prototype used by this app. */
  request: Request;
  /** Response prototype used by this app. */
  response: Response;

  // EventEmitter methods (mixed in at runtime)
  on(event: string | symbol, listener: (...args: unknown[]) => void): this;
  emit(event: string | symbol, ...args: unknown[]): boolean;
  once(event: string | symbol, listener: (...args: unknown[]) => void): this;
  off(event: string | symbol, listener: (...args: unknown[]) => void): this;

  init(): void;
  defaultConfiguration(): void;
  handle(req: http.IncomingMessage, res: http.ServerResponse, callback?: NextFunction): void;
  use(path: PathParams | RequestHandler | Application, ...handlers: (RequestHandler | Application)[]): this;
  route(path: PathParams): IRoute;
  engine(ext: string, fn: EngineRenderFn): this;
  param(name: string | string[], fn: (req: Request, res: Response, next: NextFunction, value: string, name: string) => void): this;
  set(setting: string): unknown;
  set(setting: string, val: unknown): this;
  get(setting: string): unknown;
  get(path: PathParams, ...handlers: RequestHandler[]): this;
  path(): string;
  enabled(setting: string): boolean;
  disabled(setting: string): boolean;
  enable(setting: string): this;
  disable(setting: string): this;
  all(path: PathParams, ...handlers: RequestHandler[]): this;
  render(name: string, options?: object | EngineCallback, callback?: EngineCallback): void;
  listen(port?: number, hostname?: string, backlog?: number, callback?: () => void): http.Server;
  listen(port?: number, hostname?: string, callback?: () => void): http.Server;
  listen(port?: number, callback?: () => void): http.Server;
  listen(path: string, callback?: () => void): http.Server;
  listen(handle: unknown, listeningListener?: () => void): http.Server;
  [method: string]: unknown;
}

// ────────────────────────────────────────────────────────────────────────────────
// Express factory export shape
// ────────────────────────────────────────────────────────────────────────────────

export interface ExpressFactory {
  (): Application;
  application: Omit<Application, keyof RequestHandler>;
  request: Request;
  response: Response;
  Route: new (path: string) => IRoute;
  Router: (new (options?: RouterOptions) => IRouter) & IRouter;
  json: RequestHandler & ((options?: object) => RequestHandler);
  raw: RequestHandler & ((options?: object) => RequestHandler);
  static: (root: string, options?: object) => RequestHandler;
  text: RequestHandler & ((options?: object) => RequestHandler);
  urlencoded: RequestHandler & ((options?: object) => RequestHandler);
}

export interface RouterOptions {
  caseSensitive?: boolean;
  mergeParams?: boolean;
  strict?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────────
// Accept-params helper
// ────────────────────────────────────────────────────────────────────────────────

export interface AcceptParams {
  value: string;
  quality?: number;
  params: Record<string, string>;
}
