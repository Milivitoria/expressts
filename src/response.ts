/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */

import contentDisposition from 'content-disposition';
import createError from 'http-errors';
import depd from 'depd';
import encodeUrl from 'encodeurl';
import escapeHtml from 'escape-html';
import * as http from 'node:http';
import onFinished from 'on-finished';
import * as mime from 'mime-types';
import * as nodePath from 'node:path';
import statuses from 'statuses';
import { sign } from 'cookie-signature';
import { normalizeType, normalizeTypes, setCharset } from './utils.js';
import * as cookie from 'cookie';
import send from 'send';
import vary from 'vary';
import { Buffer } from 'node:buffer';

import type {
  Request,
  Response,
  NextFunction,
  CookieOptions,
  SendFileOptions,
  DownloadOptions,
  EngineCallback,
  ETagFn,
} from './types/index.js';

const deprecate = depd('express');
const { extname, resolve, isAbsolute } = nodePath;

/**
 * Response prototype — extends Node's ServerResponse.
 * @public
 */
const res: Response = Object.create(http.ServerResponse.prototype) as Response;

export default res;

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
res.status = function status(this: Response, code: number): Response {
  if (!Number.isInteger(code)) {
    throw new TypeError(
      `Invalid status code: ${JSON.stringify(code)}. Status code must be an integer.`
    );
  }
  if (code < 100 || code > 999) {
    throw new RangeError(
      `Invalid status code: ${JSON.stringify(code)}. Status code must be greater than 99 and less than 1000.`
    );
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
res.links = function links(this: Response, links: Record<string, string | string[]>): Response {
  let link = (this.get('Link') as string | undefined) ?? '';
  if (link) link += ', ';

  return this.set('Link', link + Object.keys(links).map((rel) => {
    const val = links[rel]!;
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
res.append = function append(this: Response, field: string, val: string | string[]): Response {
  const prev = this.get(field) as string | string[] | undefined;
  let value: string | string[] = val;

  if (prev) {
    value = Array.isArray(prev)
      ? prev.concat(val)
      : Array.isArray(val)
        ? ([prev] as string[]).concat(val)
        : [prev, val];
  }

  return this.set(field, value);
};

/**
 * Set header `field` to `val`, or pass an object of header fields.
 * Aliased as `res.header()`.
 * @public
 */
res.set = res.header = function header(
  this: Response,
  field: string | Record<string, string | string[]>,
  val?: string | string[]
): Response {
  if (arguments.length === 2) {
    const value: string | string[] = Array.isArray(val)
      ? (val as string[]).map(String)
      : String(val);

    // add charset to content-type
    if ((field as string).toLowerCase() === 'content-type') {
      if (Array.isArray(value)) {
        throw new TypeError('Content-Type cannot be set to an Array');
      }
      this.setHeader(field as string, mime.contentType(value) || value);
    } else {
      this.setHeader(field as string, value);
    }
  } else {
    for (const key of Object.keys(field as Record<string, string | string[]>)) {
      this.set(key, (field as Record<string, string | string[]>)[key]!);
    }
  }

  return this;
};

/**
 * Get value for header `field`.
 * @public
 */
res.get = function (this: Response, field: string): string | string[] | number | undefined {
  return this.getHeader(field) as string | string[] | number | undefined;
};

// ────────────────────────────────────────────────────────────────────────────────
// Body
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Send a response.
 * @public
 */
res.send = function send(this: Response, body?: string | Buffer | object | boolean | null): Response {
  let chunk: unknown = body;
  let encoding: BufferEncoding | undefined;
  const req = this.req;
  const app = this.app;

  switch (typeof chunk) {
    case 'string':
      encoding = 'utf8';
      {
        const type = this.get('Content-Type') as string | undefined;
        if (typeof type === 'string') {
          this.set('Content-Type', setCharset(type, 'utf-8'));
        } else {
          this.type('html');
        }
      }
      break;
    case 'boolean':
    case 'number':
    case 'object':
      if (chunk === null) {
        chunk = '';
      } else if (ArrayBuffer.isView(chunk)) {
        if (!this.get('Content-Type')) {
          this.type('bin');
        }
      } else {
        return this.json(chunk);
      }
      break;
  }

  // determine if ETag should be generated
  const etagFn = app.get('etag fn') as ETagFn | undefined;
  const generateETag = !this.get('ETag') && typeof etagFn === 'function';

  // populate Content-Length
  let len: number | undefined;
  if (chunk !== undefined) {
    if (Buffer.isBuffer(chunk)) {
      len = (chunk as Buffer).length;
    } else if (!generateETag && (chunk as string).length < 1000) {
      len = Buffer.byteLength(chunk as string, encoding);
    } else {
      chunk = Buffer.from(chunk as string, encoding);
      encoding = undefined;
      len = (chunk as Buffer).length;
    }

    this.set('Content-Length', String(len));
  }

  // populate ETag
  if (generateETag && len !== undefined) {
    const etag = etagFn!(chunk as Buffer | string, encoding);
    if (etag) {
      this.set('ETag', etag);
    }
  }

  // freshness
  if (req.fresh) this.status(304);

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
  } else {
    this.end(chunk as string | Buffer, encoding!);
  }

  return this;
};

/**
 * Send JSON response.
 * @public
 */
res.json = function json(this: Response, obj: unknown): Response {
  const app = this.app;
  const escape = app.get('json escape') as boolean | undefined;
  const replacer = app.get('json replacer') as ((key: string, value: unknown) => unknown) | null | undefined;
  const spaces = app.get('json spaces') as number | string | undefined;
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
res.jsonp = function jsonp(this: Response, obj: unknown): Response {
  const app = this.app;
  const escape = app.get('json escape') as boolean | undefined;
  const replacer = app.get('json replacer') as ((key: string, value: unknown) => unknown) | null | undefined;
  const spaces = app.get('json spaces') as number | string | undefined;
  let body: string | undefined = stringify(obj, replacer, spaces, escape);
  let callback = this.req.query[app.get('jsonp callback name') as string];

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
    } else if (typeof body === 'string') {
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
res.sendStatus = function sendStatus(this: Response, statusCode: number): Response {
  const body = statuses.message[statusCode] ?? String(statusCode);

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
res.sendFile = function sendFile(
  this: Response,
  path: string,
  optionsOrCallback?: SendFileOptions | ((err?: Error) => void),
  callback?: (err?: Error) => void
): void {
  let done = callback;
  const req = this.req;
  const self = this;
  const next = req.next;
  let opts: SendFileOptions = {};

  if (!path) {
    throw new TypeError('path argument is required to res.sendFile');
  }

  if (typeof path !== 'string') {
    throw new TypeError('path must be a string to res.sendFile');
  }

  if (typeof optionsOrCallback === 'function') {
    done = optionsOrCallback as (err?: Error) => void;
    opts = {};
  } else if (optionsOrCallback) {
    opts = optionsOrCallback;
  }

  if (!opts.root && !isAbsolute(path)) {
    throw new TypeError('path must be absolute or specify root to res.sendFile');
  }

  const pathname = encodeURI(path);
  opts.etag = this.app.enabled('etag');

  const file = send(req as unknown as http.IncomingMessage, pathname, opts as Parameters<typeof send>[2]);

  sendfile(self, file, opts, function (err?: Error) {
    if (done) return done(err);
    if (err && (err as NodeJS.ErrnoException).code === 'EISDIR') return next();
    if (
      err &&
      (err as NodeJS.ErrnoException).code !== 'ECONNABORTED' &&
      (err as NodeJS.ErrnoException).syscall !== 'write'
    ) {
      next(err);
    }
  });
};

/**
 * Transfer the file at the given `path` as an attachment.
 * @public
 */
res.download = function download(
  this: Response,
  path: string,
  filenameOrOptions?: string | DownloadOptions | ((err?: Error) => void),
  optionsOrCallback?: DownloadOptions | ((err?: Error) => void),
  callback?: (err?: Error) => void
): void {
  let done = callback;
  let name: string | null = null;
  let opts: DownloadOptions | null = null;

  if (typeof filenameOrOptions === 'function') {
    done = filenameOrOptions;
    name = null;
    opts = null;
  } else if (typeof filenameOrOptions === 'string') {
    name = filenameOrOptions;
    if (typeof optionsOrCallback === 'function') {
      done = optionsOrCallback;
      opts = null;
    } else if (optionsOrCallback) {
      opts = optionsOrCallback as DownloadOptions;
    }
  } else if (filenameOrOptions && typeof filenameOrOptions === 'object') {
    opts = filenameOrOptions as DownloadOptions;
    if (typeof optionsOrCallback === 'function') {
      done = optionsOrCallback;
    }
  }

  const headers: Record<string, string | string[]> = {
    'Content-Disposition': contentDisposition(name ?? path),
  };

  if (opts?.headers) {
    for (const key of Object.keys(opts.headers)) {
      if (key.toLowerCase() !== 'content-disposition') {
        headers[key] = opts.headers[key]!;
      }
    }
  }

  const mergedOpts: DownloadOptions = Object.create(opts) as DownloadOptions;
  mergedOpts.headers = headers as Record<string, string | string[]>;

  const fullPath = !mergedOpts.root ? resolve(path) : path;

  return this.sendFile(fullPath, mergedOpts as SendFileOptions, done);
};

// ────────────────────────────────────────────────────────────────────────────────
// Content-Type
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Set Content-Type response header.
 * @public
 */
res.contentType = res.type = function contentType(this: Response, type: string): Response {
  const ct =
    type.indexOf('/') === -1
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
res.format = function format(
  this: Response,
  obj: Record<string, (req: Request, res: Response, next: NextFunction) => void> & {
    default?: (req: Request, res: Response, next: NextFunction) => void;
  }
): Response {
  const req = this.req;
  const next = req.next;

  const keys = Object.keys(obj).filter((v) => v !== 'default');

  const key = keys.length > 0 ? (req.accepts(keys) as string | false) : false;

  this.vary('Accept');

  if (key) {
    this.set('Content-Type', normalizeType(key).value);
    obj[key]!(req, this, next);
  } else if (obj['default']) {
    obj['default'](req, this, next);
  } else {
    next(
      createError(406, {
        types: normalizeTypes(keys).map((o) => o.value),
      })
    );
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
res.attachment = function attachment(this: Response, filename?: string): Response {
  if (filename) {
    this.type(extname(filename));
  }

  this.set('Content-Disposition', contentDisposition(filename));

  return this;
};

// ────────────────────────────────────────────────────────────────────────────────
// Cookies
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Clear cookie `name`.
 * @public
 */
res.clearCookie = function clearCookie(
  this: Response,
  name: string,
  options?: CookieOptions
): Response {
  const opts: CookieOptions = { path: '/', ...options, expires: new Date(1) };
  delete opts.maxAge;

  return this.cookie(name, '', opts);
};

/**
 * Set cookie `name` to `value` with the given `options`.
 * @public
 */
res.cookie = function (
  this: Response,
  name: string,
  value: string | object,
  options?: CookieOptions
): Response {
  const opts: CookieOptions = { ...options };
  const secret = this.req.secret;
  const signed = opts.signed;

  if (signed && !secret) {
    throw new Error('cookieParser("secret") required for signed cookies');
  }

  let val: string =
    typeof value === 'object'
      ? 'j:' + JSON.stringify(value)
      : String(value);

  if (signed) {
    const secrets = Array.isArray(secret) ? secret : [secret!];
    val = 's:' + sign(val, secrets[0]!);
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

  this.append('Set-Cookie', cookie.serialize(name, String(val), opts as cookie.CookieSerializeOptions));

  return this;
};

// ────────────────────────────────────────────────────────────────────────────────
// Redirect / Location
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Set the location header to `url`.
 * @public
 */
res.location = function location(this: Response, url: string): Response {
  return this.set('Location', encodeUrl(url));
};

/**
 * Redirect to the given `url` with optional `status`, defaulting to 302.
 * @public
 */
res.redirect = function redirect(this: Response, urlOrStatus: string | number, url?: string): void {
  let address: string;
  let body: string;
  let status = 302;

  if (arguments.length === 2) {
    status = urlOrStatus as number;
    address = url!;
  } else {
    address = urlOrStatus as string;
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

  address = this.location(address).get('Location') as string;

  this.format({
    text: () => {
      body = (statuses.message[status] ?? '') + '. Redirecting to ' + address;
    },
    html: () => {
      const u = escapeHtml(address);
      body =
        '<!DOCTYPE html><head><title>' +
        (statuses.message[status] ?? '') +
        '</title></head>' +
        '<body><p>' +
        (statuses.message[status] ?? '') +
        '. Redirecting to ' +
        u +
        '</p></body>';
    },
    default: () => {
      body = '';
    },
  });

  this.status(status);
  this.set('Content-Length', String(Buffer.byteLength(body!)));

  if (this.req.method === 'HEAD') {
    this.end();
  } else {
    this.end(body!);
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// Vary
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Add `field` to Vary. If already present in the Vary set, this call is ignored.
 * @public
 */
res.vary = function (this: Response, field: string | string[]): Response {
  vary(this, field);
  return this;
};

// ────────────────────────────────────────────────────────────────────────────────
// Render
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Render `view` with the given `options` and optional callback `fn`.
 * @public
 */
res.render = function render(
  this: Response,
  view: string,
  optionsOrCallback?: object | EngineCallback,
  callback?: EngineCallback
): void {
  const app = this.req.app;
  let done = callback;
  let opts: Record<string, unknown> = {};
  const req = this.req;
  const self = this;

  if (typeof optionsOrCallback === 'function') {
    done = optionsOrCallback as EngineCallback;
    opts = {};
  } else if (optionsOrCallback) {
    opts = optionsOrCallback as Record<string, unknown>;
  }

  opts['_locals'] = self.locals;

  done =
    done ??
    function (err: Error | null, str?: string) {
      if (err) return req.next(err);
      self.send(str);
    };

  app.render(view, opts, done!);
};

// ────────────────────────────────────────────────────────────────────────────────
// Private helpers
// ────────────────────────────────────────────────────────────────────────────────

/** Pipe the send file stream. */
function sendfile(
  res: Response,
  file: ReturnType<typeof send>,
  options: SendFileOptions,
  callback: (err?: Error) => void
): void {
  let done = false;
  let streaming: boolean | undefined;

  function onaborted() {
    if (done) return;
    done = true;
    const err = Object.assign(new Error('Request aborted'), { code: 'ECONNABORTED' });
    callback(err);
  }

  function ondirectory() {
    if (done) return;
    done = true;
    const err = Object.assign(new Error('EISDIR, read'), { code: 'EISDIR' });
    callback(err);
  }

  function onerror(err: Error) {
    if (done) return;
    done = true;
    callback(err);
  }

  function onend() {
    if (done) return;
    done = true;
    callback();
  }

  function onfile() {
    streaming = false;
  }

  function onfinish(err: Error | null) {
    if (err && (err as NodeJS.ErrnoException).code === 'ECONNRESET') return onaborted();
    if (err) return onerror(err);
    if (done) return;

    setImmediate(function () {
      if (streaming !== false && !done) {
        onaborted();
        return;
      }

      if (done) return;
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
  onFinished(res, onfinish);

  if (options.headers) {
    file.on('headers', function (fileRes: http.ServerResponse) {
      const obj = options.headers!;
      for (const key of Object.keys(obj)) {
        fileRes.setHeader(key, obj[key]!);
      }
    });
  }

  file.pipe(res);
}

/**
 * Stringify JSON, with ability to escape characters that can trigger HTML sniffing.
 * @private
 */
function stringify(
  value: unknown,
  replacer: ((key: string, value: unknown) => unknown) | null | undefined,
  spaces: number | string | undefined,
  escape: boolean | undefined
): string {
  let json =
    replacer || spaces
      ? JSON.stringify(value, replacer as Parameters<typeof JSON.stringify>[1], spaces)
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
