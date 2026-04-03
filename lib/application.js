"use strict";
/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Module dependencies.
 * @private
 */
const finalhandler_1 = __importDefault(require("finalhandler"));
const debug_1 = __importDefault(require("debug"));
const view_js_1 = require("./view.js");
const http = __importStar(require("node:http"));
const utils_js_1 = require("./utils.js");
const node_path_1 = require("node:path");
const once_1 = __importDefault(require("once"));
const router_1 = __importDefault(require("router"));
const debug = (0, debug_1.default)('express:application');
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
const app = {};
exports.default = app;
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
app.init = function init() {
    let router = null;
    this.cache = Object.create(null);
    this.engines = Object.create(null);
    this.settings = Object.create(null);
    this.defaultConfiguration();
    // Lazily create the base router
    Object.defineProperty(this, 'router', {
        configurable: true,
        enumerable: true,
        get: function getRouter() {
            if (router === null) {
                router = new router_1.default({
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
app.defaultConfiguration = function defaultConfiguration() {
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
    this.on('mount', function onmount(...args) {
        const parent = args[0];
        // inherit trust proxy
        if (this.settings[trustProxyDefaultSymbol] === true &&
            typeof parent.settings['trust proxy fn'] === 'function') {
            delete this.settings['trust proxy'];
            delete this.settings['trust proxy fn'];
        }
        // inherit protos
        Object.setPrototypeOf(this.request, parent.request);
        Object.setPrototypeOf(this.response, parent.response);
        Object.setPrototypeOf(this.engines, parent.engines);
        Object.setPrototypeOf(this.settings, parent.settings);
    });
    this.locals = Object.create(null);
    this.mountpath = '/';
    this.locals['settings'] = this.settings;
    this.set('view', view_js_1.View);
    this.set('views', (0, node_path_1.resolve)('views'));
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
app.handle = function handle(req, res, callback) {
    const done = callback ??
        (0, finalhandler_1.default)(req, res, {
            env: this.get('env'),
            onerror: logerror.bind(this),
        });
    if (this.enabled('x-powered-by')) {
        res.setHeader('X-Powered-By', 'Express');
    }
    req.res = res;
    res.req = req;
    Object.setPrototypeOf(req, this.request);
    Object.setPrototypeOf(res, this.response);
    if (!res.locals) {
        res.locals = Object.create(null);
    }
    this.router.handle(req, res, done);
};
// ────────────────────────────────────────────────────────────────────────────────
// Middleware / routing
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Proxy `Router#use()` to add middleware to the app router.
 * @public
 */
app.use = function use(fn, ...rest) {
    let offset = 0;
    let path = '/';
    // default path to '/', disambiguate app.use([fn])
    if (typeof fn !== 'function') {
        let arg = fn;
        while (Array.isArray(arg) && arg.length !== 0) {
            arg = arg[0];
        }
        if (typeof arg !== 'function') {
            offset = 1;
            path = fn;
        }
    }
    const allArgs = [fn, ...rest];
    const fns = allArgs.slice(offset).flat(Infinity);
    if (fns.length === 0) {
        throw new TypeError('app.use() requires a middleware function');
    }
    const router = this.router;
    fns.forEach((fn) => {
        const fnApp = fn;
        if (!fnApp || !fnApp.handle || !fnApp.set) {
            return router.use(path, fn);
        }
        debug('.use app under %s', path);
        fnApp.mountpath = path;
        fnApp.parent = this;
        router.use(path, function mounted_app(req, res, next) {
            const orig = req.app;
            fnApp.handle(req, res, function (err) {
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
app.route = function route(path) {
    return this.router.route(path);
};
// ────────────────────────────────────────────────────────────────────────────────
// Template engines
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Register the given template engine callback `fn` as `ext`.
 * @public
 */
app.engine = function engine(ext, fn) {
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
app.param = function param(name, fn) {
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
app['set'] = function set(setting, val) {
    if (arguments.length === 1) {
        return this.settings[setting];
    }
    debug('set "%s" to %o', setting, val);
    this.settings[setting] = val;
    switch (setting) {
        case 'etag':
            this.set('etag fn', (0, utils_js_1.compileETag)(val));
            break;
        case 'query parser':
            this.set('query parser fn', (0, utils_js_1.compileQueryParser)(val));
            break;
        case 'trust proxy':
            this.set('trust proxy fn', (0, utils_js_1.compileTrust)(val));
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
app.path = function path() {
    return this.parent ? this.parent.path() + this.mountpath : '';
};
/**
 * Check if `setting` is enabled (truthy).
 * @public
 */
app.enabled = function enabled(setting) {
    return Boolean(this.set(setting));
};
/**
 * Check if `setting` is disabled.
 * @public
 */
app.disabled = function disabled(setting) {
    return !this.set(setting);
};
/**
 * Enable `setting`.
 * @public
 */
app.enable = function enable(setting) {
    return this.set(setting, true);
};
/**
 * Disable `setting`.
 * @public
 */
app.disable = function disable(setting) {
    return this.set(setting, false);
};
// ────────────────────────────────────────────────────────────────────────────────
// HTTP verb methods
// ────────────────────────────────────────────────────────────────────────────────
utils_js_1.methods.forEach((method) => {
    app[method] = function (path, ...handlers) {
        if (method === 'get' && handlers.length === 0) {
            // app.get(setting) — return setting value
            return this.set(path);
        }
        const route = this.route(path);
        route[method](...slice.call(handlers));
        return this;
    };
});
/**
 * Special-cased "all" method — applies to every HTTP method.
 * @public
 */
app.all = function all(path, ...handlers) {
    const route = this.route(path);
    for (const method of utils_js_1.methods) {
        route[method](...slice.call(handlers));
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
app.render = function render(name, optionsOrCallback, callback) {
    const cache = this.cache;
    let done = callback;
    const engines = this.engines;
    let opts = {};
    let view;
    if (typeof optionsOrCallback === 'function') {
        done = optionsOrCallback;
        opts = {};
    }
    else if (optionsOrCallback) {
        opts = optionsOrCallback;
    }
    const renderOptions = {
        ...this.locals,
        ...opts['_locals'],
        ...opts,
    };
    if (renderOptions['cache'] == null) {
        renderOptions['cache'] = this.enabled('view cache');
    }
    if (renderOptions['cache']) {
        view = cache[name];
    }
    if (!view) {
        const ViewClass = this.get('view');
        view = new ViewClass(name, {
            defaultEngine: this.get('view engine'),
            root: this.get('views'),
            engines,
        });
        if (!view.path) {
            const root = view.root;
            const dirs = Array.isArray(root) && root.length > 1
                ? 'directories "' +
                    root.slice(0, -1).join('", "') +
                    '" or "' +
                    root[root.length - 1] +
                    '"'
                : 'directory "' + root + '"';
            const err = Object.assign(new Error('Failed to lookup view "' + name + '" in views ' + dirs), {
                view,
            });
            return done(err, undefined);
        }
        if (renderOptions['cache']) {
            cache[name] = view;
        }
    }
    tryRender(view, renderOptions, done);
};
// ────────────────────────────────────────────────────────────────────────────────
// Listen
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Listen for connections.
 * @public
 */
app.listen = function listen(...args) {
    const server = http.createServer(this);
    if (typeof args[args.length - 1] === 'function') {
        const done = (0, once_1.default)(args[args.length - 1]);
        args[args.length - 1] = done;
        server.once('error', done);
    }
    return server.listen(...args);
};
// ────────────────────────────────────────────────────────────────────────────────
// Private helpers
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Log error using console.error.
 * @private
 */
function logerror(err) {
    /* istanbul ignore next */
    if (this.get('env') !== 'test') {
        console.error(err instanceof Error ? err.stack ?? err.toString() : String(err));
    }
}
/**
 * Try rendering a view.
 * @private
 */
function tryRender(view, options, callback) {
    try {
        view.render(options, callback);
    }
    catch (err) {
        callback(err, undefined);
    }
}
//# sourceMappingURL=application.js.map