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
const accepts_1 = __importDefault(require("accepts"));
const node_net_1 = require("node:net");
const type_is_1 = __importDefault(require("type-is"));
const http = __importStar(require("node:http"));
const fresh_1 = __importDefault(require("fresh"));
const range_parser_1 = __importDefault(require("range-parser"));
const parseurl_1 = __importDefault(require("parseurl"));
const proxy_addr_1 = __importDefault(require("proxy-addr"));
/**
 * Request prototype — extends Node's IncomingMessage.
 * @public
 */
const req = Object.create(http.IncomingMessage.prototype);
exports.default = req;
// ────────────────────────────────────────────────────────────────────────────────
// Methods
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Return request header.
 *
 * The `Referrer` header field is special-cased;
 * both `Referrer` and `Referer` are interchangeable.
 *
 * @public
 */
function headerFn(name) {
    if (!name) {
        throw new TypeError('name argument is required to req.get');
    }
    if (typeof name !== 'string') {
        throw new TypeError('name must be a string to req.get');
    }
    const lc = name.toLowerCase();
    switch (lc) {
        case 'referer':
        case 'referrer':
            return this.headers['referrer']
                ?? this.headers['referer'];
        default:
            return this.headers[lc];
    }
}
req.get = req.header = headerFn;
/**
 * Check if the given `type(s)` is acceptable.
 * @public
 */
req['accepts'] = function (...args) {
    const accept = (0, accepts_1.default)(this);
    if (args.length === 1 && Array.isArray(args[0])) {
        return accept.types(args[0]);
    }
    return accept.types(...args);
};
/**
 * Check if the given `encoding`s are accepted.
 * @public
 */
req['acceptsEncodings'] = function (...args) {
    const accept = (0, accepts_1.default)(this);
    if (args.length === 1 && Array.isArray(args[0])) {
        return accept.encodings(args[0]);
    }
    return accept.encodings(...args);
};
/**
 * Check if the given `charset`s are acceptable.
 * @public
 */
req['acceptsCharsets'] = function (...charsets) {
    const accept = (0, accepts_1.default)(this);
    return accept.charsets(...charsets);
};
/**
 * Check if the given `lang`s are acceptable.
 * @public
 */
req['acceptsLanguages'] = function (...languages) {
    return ((0, accepts_1.default)(this)).languages(...languages);
};
/**
 * Parse Range header field, capping to the given `size`.
 * @public
 */
req['range'] = function range(size, options) {
    const rangeHeader = this.get('Range');
    if (!rangeHeader)
        return undefined;
    return (0, range_parser_1.default)(size, rangeHeader, options);
};
/**
 * Check if the incoming request contains the "Content-Type" header field
 * and it contains the given mime `type`.
 * @public
 */
req['is'] = function is(...args) {
    let types;
    if (args.length === 1 && Array.isArray(args[0])) {
        types = args[0];
    }
    else {
        types = args;
    }
    return (0, type_is_1.default)(this, types);
};
// ────────────────────────────────────────────────────────────────────────────────
// Getters (defined via Object.defineProperty for lazy evaluation)
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Parsed query string object.
 * @public
 */
defineGetter(req, 'query', function query() {
    const queryparse = this.app.get('query parser fn');
    if (!queryparse) {
        return Object.create(null);
    }
    const querystring = (0, parseurl_1.default)(this)?.query ?? '';
    return queryparse(querystring);
});
/**
 * Return the protocol string "http" or "https" (respects trust proxy).
 * @public
 */
defineGetter(req, 'protocol', function protocol() {
    const socketEncrypted = this.socket.encrypted;
    const proto = socketEncrypted ? 'https' : 'http';
    const trust = this.app.get('trust proxy fn');
    if (!trust(this.socket.remoteAddress ?? '', 0)) {
        return proto;
    }
    const header = this.get('X-Forwarded-Proto') ?? proto;
    const index = header.indexOf(',');
    return index !== -1
        ? header.substring(0, index).trim()
        : header.trim();
});
/**
 * Short-hand for `req.protocol === 'https'`.
 * @public
 */
defineGetter(req, 'secure', function secure() {
    return this.protocol === 'https';
});
/**
 * Return the remote address from the trusted proxy.
 * @public
 */
defineGetter(req, 'ip', function ip() {
    const trust = this.app.get('trust proxy fn');
    return (0, proxy_addr_1.default)(this, trust);
});
/**
 * When "trust proxy" is set, trusted proxy addresses + client.
 * @public
 */
defineGetter(req, 'ips', function ips() {
    const trust = this.app.get('trust proxy fn');
    const addrs = proxy_addr_1.default.all(this, trust);
    addrs.reverse().pop();
    return addrs;
});
/**
 * Return subdomains as an array.
 * @public
 */
defineGetter(req, 'subdomains', function subdomains() {
    const hostname = this.hostname;
    if (!hostname)
        return [];
    const offset = this.app.get('subdomain offset');
    const subdomains = !(0, node_net_1.isIP)(hostname)
        ? hostname.split('.').reverse()
        : [hostname];
    return subdomains.slice(offset);
});
/**
 * Short-hand for `url.parse(req.url).pathname`.
 * @public
 */
defineGetter(req, 'path', function path() {
    return (0, parseurl_1.default)(this)?.pathname ?? '/';
});
/**
 * Parse the "Host" header field to a host.
 * @public
 */
defineGetter(req, 'host', function host() {
    const trust = this.app.get('trust proxy fn');
    let val = this.get('X-Forwarded-Host');
    if (!val || !trust(this.socket.remoteAddress ?? '', 0)) {
        val = this.get('Host');
    }
    else if (val.indexOf(',') !== -1) {
        val = val.substring(0, val.indexOf(',')).trimEnd();
    }
    return val || undefined;
});
/**
 * Parse the "Host" header field to a hostname.
 * @public
 */
defineGetter(req, 'hostname', function hostname() {
    const host = this.host;
    if (!host)
        return undefined;
    // IPv6 literal support
    const offset = host[0] === '[' ? host.indexOf(']') + 1 : 0;
    const index = host.indexOf(':', offset);
    return index !== -1
        ? host.substring(0, index)
        : host;
});
/**
 * Check if the request is fresh (Last-Modified / ETag still match).
 * @public
 */
defineGetter(req, 'fresh', function () {
    const method = this.method;
    const res = this.res;
    const status = res.statusCode;
    if (method !== 'GET' && method !== 'HEAD')
        return false;
    if ((status >= 200 && status < 300) || status === 304) {
        return (0, fresh_1.default)(this.headers, {
            etag: res.get('ETag'),
            'last-modified': res.get('Last-Modified'),
        });
    }
    return false;
});
/**
 * Check if the request is stale.
 * @public
 */
defineGetter(req, 'stale', function stale() {
    return !this.fresh;
});
/**
 * Check if the request was an XMLHttpRequest.
 * @public
 */
defineGetter(req, 'xhr', function xhr() {
    const val = this.get('X-Requested-With') ?? '';
    return val.toLowerCase() === 'xmlhttprequest';
});
// ────────────────────────────────────────────────────────────────────────────────
// Private helpers
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Helper for defining a configurable, enumerable getter on an object.
 * @private
 */
function defineGetter(obj, name, getter) {
    Object.defineProperty(obj, name, {
        configurable: true,
        enumerable: true,
        get: getter,
    });
}
//# sourceMappingURL=request.js.map