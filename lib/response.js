"use strict";
/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
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
const content_disposition_1 = __importDefault(require("content-disposition"));
const http_errors_1 = __importDefault(require("http-errors"));
const depd_1 = __importDefault(require("depd"));
const encodeurl_1 = __importDefault(require("encodeurl"));
const escape_html_1 = __importDefault(require("escape-html"));
const http = __importStar(require("node:http"));
const on_finished_1 = __importDefault(require("on-finished"));
const mime = __importStar(require("mime-types"));
const nodePath = __importStar(require("node:path"));
const statuses_1 = __importDefault(require("statuses"));
const cookie_signature_1 = require("cookie-signature");
const utils_js_1 = require("./utils.js");
const cookie = __importStar(require("cookie"));
const send_1 = __importDefault(require("send"));
const vary_1 = __importDefault(require("vary"));
const node_buffer_1 = require("node:buffer");
const deprecate = (0, depd_1.default)('express');
const { extname, resolve, isAbsolute } = nodePath;
/**
 * Response prototype — extends Node's ServerResponse.
 * @public
 */
const res = Object.create(http.ServerResponse.prototype);
exports.default = res;
// ────────────────────────────────────────────────────────────────────────────────
// Status
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Set the HTTP status code for the response.
 *
 * Expects an integer between 100 and 999 inclusive.
 *
 * @public
 */
res.status = function status(code) {
    if (!Number.isInteger(code)) {
        throw new TypeError(`Invalid status code: ${JSON.stringify(code)}. Status code must be an integer.`);
    }
    if (code < 100 || code > 999) {
        throw new RangeError(`Invalid status code: ${JSON.stringify(code)}. Status code must be greater than 99 and less than 1000.`);
    }
    this.statusCode = code;
    return this;
};
// ────────────────────────────────────────────────────────────────────────────────
// Headers
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Set Link header field with the given `links`.
 * @public
 */
res.links = function links(links) {
    let link = this.get('Link') ?? '';
    if (link)
        link += ', ';
    return this.set('Link', link + Object.keys(links).map((rel) => {
        const val = links[rel];
        if (Array.isArray(val)) {
            return val.map((singleLink) => `<${singleLink}>; rel="${rel}"`).join(', ');
        }
        return `<${val}>; rel="${rel}"`;
    }).join(', '));
};
/**
 * Append additional header `field` with value `val`.
 * @public
 */
res.append = function append(field, val) {
    const prev = this.get(field);
    let value = val;
    if (prev) {
        value = Array.isArray(prev)
            ? prev.concat(val)
            : Array.isArray(val)
                ? [prev].concat(val)
                : [prev, val];
    }
    return this.set(field, value);
};
/**
 * Set header `field` to `val`, or pass an object of header fields.
 * Aliased as `res.header()`.
 * @public
 */
res.set = res.header = function header(field, val) {
    if (arguments.length === 2) {
        const value = Array.isArray(val)
            ? val.map(String)
            : String(val);
        // add charset to content-type
        if (field.toLowerCase() === 'content-type') {
            if (Array.isArray(value)) {
                throw new TypeError('Content-Type cannot be set to an Array');
            }
            this.setHeader(field, mime.contentType(value) || value);
        }
        else {
            this.setHeader(field, value);
        }
    }
    else {
        for (const key of Object.keys(field)) {
            this.set(key, field[key]);
        }
    }
    return this;
};
/**
 * Get value for header `field`.
 * @public
 */
res.get = function (field) {
    return this.getHeader(field);
};
// ────────────────────────────────────────────────────────────────────────────────
// Body
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Send a response.
 * @public
 */
res.send = function send(body) {
    let chunk = body;
    let encoding;
    const req = this.req;
    const app = this.app;
    switch (typeof chunk) {
        case 'string':
            encoding = 'utf8';
            {
                const type = this.get('Content-Type');
                if (typeof type === 'string') {
                    this.set('Content-Type', (0, utils_js_1.setCharset)(type, 'utf-8'));
                }
                else {
                    this.type('html');
                }
            }
            break;
        case 'boolean':
        case 'number':
        case 'object':
            if (chunk === null) {
                chunk = '';
            }
            else if (ArrayBuffer.isView(chunk)) {
                if (!this.get('Content-Type')) {
                    this.type('bin');
                }
            }
            else {
                return this.json(chunk);
            }
            break;
    }
    // determine if ETag should be generated
    const etagFn = app.get('etag fn');
    const generateETag = !this.get('ETag') && typeof etagFn === 'function';
    // populate Content-Length
    let len;
    if (chunk !== undefined) {
        if (node_buffer_1.Buffer.isBuffer(chunk)) {
            len = chunk.length;
        }
        else if (!generateETag && chunk.length < 1000) {
            len = node_buffer_1.Buffer.byteLength(chunk, encoding);
        }
        else {
            chunk = node_buffer_1.Buffer.from(chunk, encoding);
            encoding = undefined;
            len = chunk.length;
        }
        this.set('Content-Length', String(len));
    }
    // populate ETag
    if (generateETag && len !== undefined) {
        const etag = etagFn(chunk, encoding);
        if (etag) {
            this.set('ETag', etag);
        }
    }
    // freshness
    if (req.fresh)
        this.status(304);
    // strip irrelevant headers
    if (this.statusCode === 204 || this.statusCode === 304) {
        this.removeHeader('Content-Type');
        this.removeHeader('Content-Length');
        this.removeHeader('Transfer-Encoding');
        chunk = '';
    }
    // alter headers for 205
    if (this.statusCode === 205) {
        this.set('Content-Length', '0');
        this.removeHeader('Transfer-Encoding');
        chunk = '';
    }
    if (req.method === 'HEAD') {
        this.end();
    }
    else {
        this.end(chunk, encoding);
    }
    return this;
};
/**
 * Send JSON response.
 * @public
 */
res.json = function json(obj) {
    const app = this.app;
    const escape = app.get('json escape');
    const replacer = app.get('json replacer');
    const spaces = app.get('json spaces');
    const body = stringify(obj, replacer, spaces, escape);
    if (!this.get('Content-Type')) {
        this.set('Content-Type', 'application/json');
    }
    return this.send(body);
};
/**
 * Send JSON response with JSONP callback support.
 * @public
 */
res.jsonp = function jsonp(obj) {
    const app = this.app;
    const escape = app.get('json escape');
    const replacer = app.get('json replacer');
    const spaces = app.get('json spaces');
    let body = stringify(obj, replacer, spaces, escape);
    let callback = this.req.query[app.get('jsonp callback name')];
    if (!this.get('Content-Type')) {
        this.set('X-Content-Type-Options', 'nosniff');
        this.set('Content-Type', 'application/json');
    }
    if (Array.isArray(callback)) {
        callback = callback[0];
    }
    if (typeof callback === 'string' && callback.length !== 0) {
        this.set('X-Content-Type-Options', 'nosniff');
        this.set('Content-Type', 'text/javascript');
        callback = callback.replace(/[^\[\]\w$.]/g, '');
        if (body === undefined) {
            body = '';
        }
        else if (typeof body === 'string') {
            body = body
                .replace(/\u2028/g, '\\u2028')
                .replace(/\u2029/g, '\\u2029');
        }
        body =
            '/**/ typeof ' +
                callback +
                " === 'function' && " +
                callback +
                '(' +
                body +
                ');';
    }
    return this.send(body);
};
/**
 * Send given HTTP status code.
 * @public
 */
res.sendStatus = function sendStatus(statusCode) {
    const body = statuses_1.default.message[statusCode] ?? String(statusCode);
    this.status(statusCode);
    this.type('txt');
    return this.send(body);
};
// ────────────────────────────────────────────────────────────────────────────────
// File sending
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Transfer the file at the given `path`.
 * @public
 */
res.sendFile = function sendFile(path, optionsOrCallback, callback) {
    let done = callback;
    const req = this.req;
    const self = this;
    const next = req.next;
    let opts = {};
    if (!path) {
        throw new TypeError('path argument is required to res.sendFile');
    }
    if (typeof path !== 'string') {
        throw new TypeError('path must be a string to res.sendFile');
    }
    if (typeof optionsOrCallback === 'function') {
        done = optionsOrCallback;
        opts = {};
    }
    else if (optionsOrCallback) {
        opts = optionsOrCallback;
    }
    if (!opts.root && !isAbsolute(path)) {
        throw new TypeError('path must be absolute or specify root to res.sendFile');
    }
    const pathname = encodeURI(path);
    opts.etag = this.app.enabled('etag');
    const file = (0, send_1.default)(req, pathname, opts);
    sendfile(self, file, opts, function (err) {
        if (done)
            return done(err);
        if (err && err.code === 'EISDIR')
            return next();
        if (err &&
            err.code !== 'ECONNABORTED' &&
            err.syscall !== 'write') {
            next(err);
        }
    });
};
/**
 * Transfer the file at the given `path` as an attachment.
 * @public
 */
res.download = function download(path, filenameOrOptions, optionsOrCallback, callback) {
    let done = callback;
    let name = null;
    let opts = null;
    if (typeof filenameOrOptions === 'function') {
        done = filenameOrOptions;
        name = null;
        opts = null;
    }
    else if (typeof filenameOrOptions === 'string') {
        name = filenameOrOptions;
        if (typeof optionsOrCallback === 'function') {
            done = optionsOrCallback;
            opts = null;
        }
        else if (optionsOrCallback) {
            opts = optionsOrCallback;
        }
    }
    else if (filenameOrOptions && typeof filenameOrOptions === 'object') {
        opts = filenameOrOptions;
        if (typeof optionsOrCallback === 'function') {
            done = optionsOrCallback;
        }
    }
    const headers = {
        'Content-Disposition': (0, content_disposition_1.default)(name ?? path),
    };
    if (opts?.headers) {
        for (const key of Object.keys(opts.headers)) {
            if (key.toLowerCase() !== 'content-disposition') {
                headers[key] = opts.headers[key];
            }
        }
    }
    const mergedOpts = Object.create(opts);
    mergedOpts.headers = headers;
    const fullPath = !mergedOpts.root ? resolve(path) : path;
    return this.sendFile(fullPath, mergedOpts, done);
};
// ────────────────────────────────────────────────────────────────────────────────
// Content-Type
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Set Content-Type response header.
 * @public
 */
res.contentType = res.type = function contentType(type) {
    const ct = type.indexOf('/') === -1
        ? mime.contentType(type) || 'application/octet-stream'
        : type;
    return this.set('Content-Type', ct);
};
// ────────────────────────────────────────────────────────────────────────────────
// Content negotiation
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Respond to the Acceptable formats using an `obj` of mime-type callbacks.
 * @public
 */
res.format = function format(obj) {
    const req = this.req;
    const next = req.next;
    const keys = Object.keys(obj).filter((v) => v !== 'default');
    const key = keys.length > 0 ? req.accepts(keys) : false;
    this.vary('Accept');
    if (key) {
        this.set('Content-Type', (0, utils_js_1.normalizeType)(key).value);
        obj[key](req, this, next);
    }
    else if (obj['default']) {
        obj['default'](req, this, next);
    }
    else {
        next((0, http_errors_1.default)(406, {
            types: (0, utils_js_1.normalizeTypes)(keys).map((o) => o.value),
        }));
    }
    return this;
};
// ────────────────────────────────────────────────────────────────────────────────
// Attachment
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Set Content-Disposition header to attachment with optional `filename`.
 * @public
 */
res.attachment = function attachment(filename) {
    if (filename) {
        this.type(extname(filename));
    }
    this.set('Content-Disposition', (0, content_disposition_1.default)(filename));
    return this;
};
// ────────────────────────────────────────────────────────────────────────────────
// Cookies
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Clear cookie `name`.
 * @public
 */
res.clearCookie = function clearCookie(name, options) {
    const opts = { path: '/', ...options, expires: new Date(1) };
    delete opts.maxAge;
    return this.cookie(name, '', opts);
};
/**
 * Set cookie `name` to `value` with the given `options`.
 * @public
 */
res.cookie = function (name, value, options) {
    const opts = { ...options };
    const secret = this.req.secret;
    const signed = opts.signed;
    if (signed && !secret) {
        throw new Error('cookieParser("secret") required for signed cookies');
    }
    let val = typeof value === 'object'
        ? 'j:' + JSON.stringify(value)
        : String(value);
    if (signed) {
        const secrets = Array.isArray(secret) ? secret : [secret];
        val = 's:' + (0, cookie_signature_1.sign)(val, secrets[0]);
    }
    if (opts.maxAge != null) {
        const maxAge = opts.maxAge - 0;
        if (!isNaN(maxAge)) {
            opts.expires = new Date(Date.now() + maxAge);
            opts.maxAge = Math.floor(maxAge / 1000);
        }
    }
    if (opts.path == null) {
        opts.path = '/';
    }
    this.append('Set-Cookie', cookie.serialize(name, String(val), opts));
    return this;
};
// ────────────────────────────────────────────────────────────────────────────────
// Redirect / Location
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Set the location header to `url`.
 * @public
 */
res.location = function location(url) {
    return this.set('Location', (0, encodeurl_1.default)(url));
};
/**
 * Redirect to the given `url` with optional `status`, defaulting to 302.
 * @public
 */
res.redirect = function redirect(urlOrStatus, url) {
    let address;
    let body;
    let status = 302;
    if (arguments.length === 2) {
        status = urlOrStatus;
        address = url;
    }
    else {
        address = urlOrStatus;
    }
    if (!address) {
        deprecate('Provide a url argument');
    }
    if (typeof address !== 'string') {
        deprecate('Url must be a string');
    }
    if (typeof status !== 'number') {
        deprecate('Status must be a number');
    }
    address = this.location(address).get('Location');
    this.format({
        text: () => {
            body = (statuses_1.default.message[status] ?? '') + '. Redirecting to ' + address;
        },
        html: () => {
            const u = (0, escape_html_1.default)(address);
            body =
                '<!DOCTYPE html><head><title>' +
                    (statuses_1.default.message[status] ?? '') +
                    '</title></head>' +
                    '<body><p>' +
                    (statuses_1.default.message[status] ?? '') +
                    '. Redirecting to ' +
                    u +
                    '</p></body>';
        },
        default: () => {
            body = '';
        },
    });
    this.status(status);
    this.set('Content-Length', String(node_buffer_1.Buffer.byteLength(body)));
    if (this.req.method === 'HEAD') {
        this.end();
    }
    else {
        this.end(body);
    }
};
// ────────────────────────────────────────────────────────────────────────────────
// Vary
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Add `field` to Vary. If already present in the Vary set, this call is ignored.
 * @public
 */
res.vary = function (field) {
    (0, vary_1.default)(this, field);
    return this;
};
// ────────────────────────────────────────────────────────────────────────────────
// Render
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Render `view` with the given `options` and optional callback `fn`.
 * @public
 */
res.render = function render(view, optionsOrCallback, callback) {
    const app = this.req.app;
    let done = callback;
    let opts = {};
    const req = this.req;
    const self = this;
    if (typeof optionsOrCallback === 'function') {
        done = optionsOrCallback;
        opts = {};
    }
    else if (optionsOrCallback) {
        opts = optionsOrCallback;
    }
    opts['_locals'] = self.locals;
    done =
        done ??
            function (err, str) {
                if (err)
                    return req.next(err);
                self.send(str);
            };
    app.render(view, opts, done);
};
// ────────────────────────────────────────────────────────────────────────────────
// Private helpers
// ────────────────────────────────────────────────────────────────────────────────
/** Pipe the send file stream. */
function sendfile(res, file, options, callback) {
    let done = false;
    let streaming;
    function onaborted() {
        if (done)
            return;
        done = true;
        const err = Object.assign(new Error('Request aborted'), { code: 'ECONNABORTED' });
        callback(err);
    }
    function ondirectory() {
        if (done)
            return;
        done = true;
        const err = Object.assign(new Error('EISDIR, read'), { code: 'EISDIR' });
        callback(err);
    }
    function onerror(err) {
        if (done)
            return;
        done = true;
        callback(err);
    }
    function onend() {
        if (done)
            return;
        done = true;
        callback();
    }
    function onfile() {
        streaming = false;
    }
    function onfinish(err) {
        if (err && err.code === 'ECONNRESET')
            return onaborted();
        if (err)
            return onerror(err);
        if (done)
            return;
        setImmediate(function () {
            if (streaming !== false && !done) {
                onaborted();
                return;
            }
            if (done)
                return;
            done = true;
            callback();
        });
    }
    function onstream() {
        streaming = true;
    }
    file.on('directory', ondirectory);
    file.on('end', onend);
    file.on('error', onerror);
    file.on('file', onfile);
    file.on('stream', onstream);
    (0, on_finished_1.default)(res, onfinish);
    if (options.headers) {
        file.on('headers', function (fileRes) {
            const obj = options.headers;
            for (const key of Object.keys(obj)) {
                fileRes.setHeader(key, obj[key]);
            }
        });
    }
    file.pipe(res);
}
/**
 * Stringify JSON, with ability to escape characters that can trigger HTML sniffing.
 * @private
 */
function stringify(value, replacer, spaces, escape) {
    let json = replacer || spaces
        ? JSON.stringify(value, replacer, spaces)
        : JSON.stringify(value);
    if (escape && typeof json === 'string') {
        json = json.replace(/[<>&]/g, function (c) {
            switch (c.charCodeAt(0)) {
                case 0x3c:
                    return '\\u003c';
                case 0x3e:
                    return '\\u003e';
                case 0x26:
                    return '\\u0026';
                default:
                    return c;
            }
        });
    }
    return json;
}
//# sourceMappingURL=response.js.map