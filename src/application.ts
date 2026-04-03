/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */

import finalhandler from 'finalhandler';
import debugLib from 'debug';
import { View } from './view.js';
import * as http from 'node:http';
import { methods, compileETag, compileQueryParser, compileTrust } from './utils.js';
import { resolve } from 'node:path';
import once from 'once';
import Router from 'router';

import type {
  Application,
  Request,
  Response,
  NextFunction,
  PathParams,
  RequestHandler,
  IRoute,
  IRouter,
  EngineRenderFn,
  EngineCallback,
  RouterOptions,
  AppSettings,
  IView,
  ViewOptions,
  ETagSetting,
  QueryParserSetting,
  TrustProxySetting,
} from './types/index.js';

const debug = debugLib('express:application');

const slice = Array.prototype.slice;

/**
 * Variable for trust proxy inheritance back-compat.
 * @private
 */
const trustProxyDefaultSymbol = '@@symbol:trust_proxy_default';

/**
 * Application prototype — mixed into the express app function at runtime.
 * @public
 */
const app: Application = {} as Application;

export default app;

// ────────────────────────────────────────────────────────────────────────────────
// Initialisation
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Initialize the server.
 *
 *   - setup default configuration
 *   - setup default middleware
 *   - setup route reflection methods
 *
 * @private
 */
app.init = function init(this: Application): void {
  let router: IRouter | null = null;

  this.cache = Object.create(null) as Record<string, IView>;
  this.engines = Object.create(null) as Record<string, EngineRenderFn>;
  this.settings = Object.create(null) as AppSettings;

  this.defaultConfiguration();

  // Lazily create the base router
  Object.defineProperty(this, 'router', {
    configurable: true,
    enumerable: true,
    get: function getRouter(this: Application): IRouter {
      if (router === null) {
        router = new (Router as unknown as new (opts: RouterOptions) => IRouter)({
          caseSensitive: this.enabled('case sensitive routing'),
          strict: this.enabled('strict routing'),
        });
      }
      return router;
    },
  });
};

/**
 * Initialize application configuration.
 * @private
 */
app.defaultConfiguration = function defaultConfiguration(this: Application): void {
  const env = process.env['NODE_ENV'] || 'development';

  this.enable('x-powered-by');
  this.set('etag', 'weak');
  this.set('env', env);
  this.set('query parser', 'simple');
  this.set('subdomain offset', 2);
  this.set('trust proxy', false);

  // trust proxy inherit back-compat
  Object.defineProperty(this.settings, trustProxyDefaultSymbol, {
    configurable: true,
    value: true,
  });

  debug('booting in %s mode', env);

  this.on('mount', function onmount(this: Application, ...args: unknown[]) {
    const parent = args[0] as Application;
    // inherit trust proxy
    if (
      (this.settings as Record<string, unknown>)[trustProxyDefaultSymbol] === true &&
      typeof parent.settings['trust proxy fn'] === 'function'
    ) {
      delete (this.settings as Record<string, unknown>)['trust proxy'];
      delete (this.settings as Record<string, unknown>)['trust proxy fn'];
    }

    // inherit protos
    Object.setPrototypeOf(this.request, parent.request);
    Object.setPrototypeOf(this.response, parent.response);
    Object.setPrototypeOf(this.engines, parent.engines);
    Object.setPrototypeOf(this.settings, parent.settings);
  });

  this.locals = Object.create(null) as Application['locals'];

  this.mountpath = '/';

  this.locals['settings'] = this.settings;

  this.set('view', View as unknown as new (name: string, options: ViewOptions) => IView);
  this.set('views', resolve('views'));
  this.set('jsonp callback name', 'callback');

  if (env === 'production') {
    this.enable('view cache');
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// Request handling
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Dispatch a req, res pair into the application. Starts pipeline processing.
 * @private
 */
app.handle = function handle(
  this: Application,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  callback?: NextFunction
): void {
  const done =
    callback ??
    finalhandler(req, res, {
      env: this.get('env') as string,
      onerror: logerror.bind(this),
    });

  if (this.enabled('x-powered-by')) {
    res.setHeader('X-Powered-By', 'Express');
  }

  (req as Request).res = res as Response;
  (res as Response).req = req as Request;

  Object.setPrototypeOf(req, this.request);
  Object.setPrototypeOf(res, this.response);

  if (!(res as Response).locals) {
    (res as Response).locals = Object.create(null) as Record<string, unknown>;
  }

  this.router.handle(req as Request, res as Response, done);
};

// ────────────────────────────────────────────────────────────────────────────────
// Middleware / routing
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Proxy `Router#use()` to add middleware to the app router.
 * @public
 */
app.use = function use(
  this: Application,
  fn: PathParams | RequestHandler | Application,
  ...rest: (RequestHandler | Application)[]
): Application {
  let offset = 0;
  let path = '/';

  // default path to '/', disambiguate app.use([fn])
  if (typeof fn !== 'function') {
    let arg: unknown = fn;

    while (Array.isArray(arg) && arg.length !== 0) {
      arg = (arg as unknown[])[0];
    }

    if (typeof arg !== 'function') {
      offset = 1;
      path = fn as string;
    }
  }

  const allArgs = [fn, ...rest] as unknown[];
  const fns = (allArgs.slice(offset) as unknown[]).flat(Infinity) as RequestHandler[];

  if (fns.length === 0) {
    throw new TypeError('app.use() requires a middleware function');
  }

  const router = this.router;

  fns.forEach((fn) => {
    const fnApp = fn as Application;
    if (!fnApp || !fnApp.handle || !fnApp.set) {
      return router.use(path as PathParams, fn);
    }

    debug('.use app under %s', path);
    fnApp.mountpath = path;
    fnApp.parent = this;

    router.use(path as PathParams, function mounted_app(
      req: Request,
      res: Response,
      next: NextFunction
    ) {
      const orig = req.app;
      fnApp.handle(req, res, function (err?: unknown) {
        Object.setPrototypeOf(req, orig.request);
        Object.setPrototypeOf(res, orig.response);
        next(err);
      });
    });

    fnApp.emit('mount', this);
  });

  return this;
};

/**
 * Proxy to the app `Router#route()`.
 * Returns a new `Route` instance for the _path_.
 * @public
 */
app.route = function route(this: Application, path: PathParams): IRoute {
  return this.router.route(path);
};

// ────────────────────────────────────────────────────────────────────────────────
// Template engines
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Register the given template engine callback `fn` as `ext`.
 * @public
 */
app.engine = function engine(
  this: Application,
  ext: string,
  fn: EngineRenderFn
): Application {
  if (typeof fn !== 'function') {
    throw new Error('callback function required');
  }

  const extension = ext[0] !== '.' ? '.' + ext : ext;
  this.engines[extension] = fn;

  return this;
};

// ────────────────────────────────────────────────────────────────────────────────
// Route params
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Proxy to `Router#param()` with one added api feature.
 * The _name_ parameter can be an array of names.
 * @public
 */
app.param = function param(
  this: Application,
  name: string | string[],
  fn: (req: Request, res: Response, next: NextFunction, value: string, name: string) => void
): Application {
  if (Array.isArray(name)) {
    for (const n of name) {
      this.param(n, fn);
    }
    return this;
  }

  this.router.param(name, fn);

  return this;
};

// ────────────────────────────────────────────────────────────────────────────────
// Settings
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Assign `setting` to `val`, or return `setting`'s value.
 * @public
 */
(app as Record<string, unknown>)['set'] = function set(this: Application, setting: string, val?: unknown): unknown {
  if (arguments.length === 1) {
    return this.settings[setting];
  }

  debug('set "%s" to %o', setting, val);

  this.settings[setting] = val;

  switch (setting) {
    case 'etag':
      this.set('etag fn', compileETag(val as ETagSetting));
      break;
    case 'query parser':
      this.set('query parser fn', compileQueryParser(val as QueryParserSetting));
      break;
    case 'trust proxy':
      this.set('trust proxy fn', compileTrust(val as TrustProxySetting));

      Object.defineProperty(this.settings, trustProxyDefaultSymbol, {
        configurable: true,
        value: false,
      });
      break;
  }

  return this;
};

/**
 * Return the app's absolute pathname based on the parent(s) it has been mounted to.
 * @private
 */
app.path = function path(this: Application): string {
  return this.parent ? this.parent.path() + this.mountpath : '';
};

/**
 * Check if `setting` is enabled (truthy).
 * @public
 */
app.enabled = function enabled(this: Application, setting: string): boolean {
  return Boolean(this.set(setting));
};

/**
 * Check if `setting` is disabled.
 * @public
 */
app.disabled = function disabled(this: Application, setting: string): boolean {
  return !this.set(setting);
};

/**
 * Enable `setting`.
 * @public
 */
app.enable = function enable(this: Application, setting: string): Application {
  return this.set(setting, true) as Application;
};

/**
 * Disable `setting`.
 * @public
 */
app.disable = function disable(this: Application, setting: string): Application {
  return this.set(setting, false) as Application;
};

// ────────────────────────────────────────────────────────────────────────────────
// HTTP verb methods
// ────────────────────────────────────────────────────────────────────────────────

methods.forEach((method) => {
  (app as unknown as Record<string, unknown>)[method] = function (
    this: Application,
    path: PathParams,
    ...handlers: RequestHandler[]
  ): Application | unknown {
    if (method === 'get' && handlers.length === 0) {
      // app.get(setting) — return setting value
      return this.set(path as string);
    }

    const route = this.route(path);
    (route as unknown as Record<string, (...a: unknown[]) => unknown>)[method]!(
      ...slice.call(handlers)
    );
    return this;
  };
});

/**
 * Special-cased "all" method — applies to every HTTP method.
 * @public
 */
app.all = function all(
  this: Application,
  path: PathParams,
  ...handlers: RequestHandler[]
): Application {
  const route = this.route(path);

  for (const method of methods) {
    (route as unknown as Record<string, (...a: unknown[]) => unknown>)[method]!(
      ...slice.call(handlers)
    );
  }

  return this;
};

// ────────────────────────────────────────────────────────────────────────────────
// Render
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Render the given view `name` with `options` and a callback.
 * @public
 */
app.render = function render(
  this: Application,
  name: string,
  optionsOrCallback?: object | EngineCallback,
  callback?: EngineCallback
): void {
  const cache = this.cache;
  let done = callback;
  const engines = this.engines;
  let opts: Record<string, unknown> = {};
  let view: IView | undefined;

  if (typeof optionsOrCallback === 'function') {
    done = optionsOrCallback as EngineCallback;
    opts = {};
  } else if (optionsOrCallback) {
    opts = optionsOrCallback as Record<string, unknown>;
  }

  const renderOptions: Record<string, unknown> = {
    ...this.locals,
    ...(opts['_locals'] as Record<string, unknown>),
    ...opts,
  };

  if (renderOptions['cache'] == null) {
    renderOptions['cache'] = this.enabled('view cache');
  }

  if (renderOptions['cache']) {
    view = cache[name];
  }

  if (!view) {
    const ViewClass = this.get('view') as new (name: string, options: ViewOptions) => IView;

    view = new ViewClass(name, {
      defaultEngine: this.get('view engine') as string | undefined,
      root: this.get('views') as string | string[],
      engines,
    });

    if (!view.path) {
      const root = view.root;
      const dirs =
        Array.isArray(root) && root.length > 1
          ? 'directories "' +
            root.slice(0, -1).join('", "') +
            '" or "' +
            root[root.length - 1] +
            '"'
          : 'directory "' + root + '"';
      const err = Object.assign(new Error('Failed to lookup view "' + name + '" in views ' + dirs), {
        view,
      });
      return done!(err, undefined);
    }

    if (renderOptions['cache']) {
      cache[name] = view;
    }
  }

  tryRender(view, renderOptions, done!);
};

// ────────────────────────────────────────────────────────────────────────────────
// Listen
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Listen for connections.
 * @public
 */
app.listen = function listen(this: Application, ...args: unknown[]): http.Server {
  const server = http.createServer(this as unknown as http.RequestListener);
  if (typeof args[args.length - 1] === 'function') {
    const done = once(args[args.length - 1] as () => void);
    args[args.length - 1] = done;
    server.once('error', done);
  }
  return server.listen(...(args as Parameters<typeof server.listen>));
};

// ────────────────────────────────────────────────────────────────────────────────
// Private helpers
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Log error using console.error.
 * @private
 */
function logerror(this: Application, err: unknown): void {
  /* istanbul ignore next */
  if (this.get('env') !== 'test') {
    console.error(err instanceof Error ? err.stack ?? err.toString() : String(err));
  }
}

/**
 * Try rendering a view.
 * @private
 */
function tryRender(
  view: IView,
  options: Record<string, unknown>,
  callback: EngineCallback
): void {
  try {
    view.render(options, callback);
  } catch (err) {
    callback(err as Error, undefined);
  }
}
