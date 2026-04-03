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
exports.View = void 0;
/**
 * Module dependencies.
 * @private
 */
const debug_1 = __importDefault(require("debug"));
const nodePath = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const debug = (0, debug_1.default)('express:view');
const { dirname, basename, extname, join, resolve } = nodePath;
/**
 * Initialize a new `View` with the given `name`.
 *
 * Options:
 *   - `defaultEngine`  the default template engine name
 *   - `engines`        template engine require() cache
 *   - `root`           root path for view lookup
 *
 * @public
 */
class View {
    defaultEngine;
    ext;
    name;
    root;
    engine;
    path;
    constructor(name, options) {
        this.defaultEngine = options.defaultEngine;
        this.ext = extname(name);
        this.name = name;
        this.root = options.root;
        if (!this.ext && !this.defaultEngine) {
            throw new Error('No default engine was specified and no extension was provided.');
        }
        let fileName = name;
        if (!this.ext) {
            // get extension from default engine name
            this.ext = this.defaultEngine[0] !== '.'
                ? '.' + this.defaultEngine
                : this.defaultEngine;
            fileName += this.ext;
        }
        if (!options.engines[this.ext]) {
            // load engine
            const mod = this.ext.slice(1);
            debug('require "%s"', mod);
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const engineModule = require(mod);
            const fn = engineModule.__express;
            if (typeof fn !== 'function') {
                throw new Error('Module "' + mod + '" does not provide a view engine.');
            }
            options.engines[this.ext] = fn;
        }
        // store loaded engine
        this.engine = options.engines[this.ext];
        // lookup path
        this.path = this.lookup(fileName);
    }
    /**
     * Lookup view by the given `name`.
     * @private
     */
    lookup(name) {
        let path;
        const roots = [].concat(this.root);
        debug('lookup "%s"', name);
        for (let i = 0; i < roots.length && !path; i++) {
            const root = roots[i];
            const loc = resolve(root, name);
            const dir = dirname(loc);
            const file = basename(loc);
            path = this.resolve(dir, file);
        }
        return path;
    }
    /**
     * Render with the given options.
     * @private
     */
    render(options, callback) {
        let sync = true;
        debug('render "%s"', this.path);
        this.engine(this.path, options, function onRender(...args) {
            if (!sync) {
                return callback.apply(this, args);
            }
            // force callback to be async
            const cntx = this;
            return process.nextTick(function renderTick() {
                return callback.apply(cntx, args);
            });
        });
        sync = false;
    }
    /**
     * Resolve the file within the given directory.
     * @private
     */
    resolve(dir, file) {
        const ext = this.ext;
        // <path>.<ext>
        let path = join(dir, file);
        let stat = tryStat(path);
        if (stat && stat.isFile()) {
            return path;
        }
        // <path>/index.<ext>
        path = join(dir, basename(file, ext), 'index' + ext);
        stat = tryStat(path);
        if (stat && stat.isFile()) {
            return path;
        }
        return undefined;
    }
}
exports.View = View;
/**
 * Return a stat, maybe.
 * @private
 */
function tryStat(path) {
    debug('stat "%s"', path);
    try {
        return fs.statSync(path);
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=view.js.map