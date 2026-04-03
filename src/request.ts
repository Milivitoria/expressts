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

import accepts from 'accepts';
import { isIP } from 'node:net';
import typeis from 'type-is';
import * as http from 'node:http';
import fresh from 'fresh';
import parseRange from 'range-parser';
import parse from 'parseurl';
import proxyaddr from 'proxy-addr';

import type { Request, ParsedQs, TrustProxyFn } from './types/index.js';

/**
 * Request prototype — extends Node's IncomingMessage.
 * @public
 */
const req: Request = Object.create(http.IncomingMessage.prototype) as Request;

export default req;

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
function headerFn(this: Request, name: string): string | string[] | undefined {
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
      return (this.headers['referrer'] as string | undefined)
        ?? (this.headers['referer'] as string | undefined);
    default:
      return this.headers[lc] as string | string[] | undefined;
  }
}

req.get = req.header = headerFn as Request['get'];

/**
 * Check if the given `type(s)` is acceptable.
 * @public
 */
(req as unknown as Record<string, unknown>)['accepts'] = function (this: Request, ...args: string[] | [string[]]): string | string[] | false {
  const accept = accepts(this as unknown as http.IncomingMessage);
  if (args.length === 1 && Array.isArray(args[0])) {
    return accept.types(args[0] as string[]) as string | false;
  }
  return accept.types(...(args as string[])) as string | string[] | false;
};

/**
 * Check if the given `encoding`s are accepted.
 * @public
 */
(req as unknown as Record<string, unknown>)['acceptsEncodings'] = function (this: Request, ...args: string[] | [string[]]): string | string[] | false {
  const accept = accepts(this as unknown as http.IncomingMessage);
  if (args.length === 1 && Array.isArray(args[0])) {
    return accept.encodings(args[0] as string[]) as string | false;
  }
  return accept.encodings(...(args as string[])) as string | string[] | false;
};

/**
 * Check if the given `charset`s are acceptable.
 * @public
 */
(req as unknown as Record<string, unknown>)['acceptsCharsets'] = function (this: Request, ...charsets: string[]): string | string[] | false {
  const accept = accepts(this as unknown as http.IncomingMessage);
  return accept.charsets(...charsets) as string | string[] | false;
};

/**
 * Check if the given `lang`s are acceptable.
 * @public
 */
(req as unknown as Record<string, unknown>)['acceptsLanguages'] = function (this: Request, ...languages: string[]): string | string[] | false {
  return (accepts(this as unknown as http.IncomingMessage)).languages(...languages) as string | string[] | false;
};

/**
 * Parse Range header field, capping to the given `size`.
 * @public
 */
(req as unknown as Record<string, unknown>)['range'] = function range(this: Request, size: number, options?: { combine?: boolean }) {
  const rangeHeader = this.get('Range');
  if (!rangeHeader) return undefined;
  return parseRange(size, rangeHeader, options);
};

/**
 * Check if the incoming request contains the "Content-Type" header field
 * and it contains the given mime `type`.
 * @public
 */
(req as unknown as Record<string, unknown>)['is'] = function is(this: Request, ...args: [string | string[]] | string[]): string | false | null {
  let types: string[];
  if (args.length === 1 && Array.isArray(args[0])) {
    types = args[0] as string[];
  } else {
    types = args as string[];
  }
  return typeis(this as unknown as http.IncomingMessage, types) as string | false | null;
};

// ────────────────────────────────────────────────────────────────────────────────
// Getters (defined via Object.defineProperty for lazy evaluation)
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Parsed query string object.
 * @public
 */
defineGetter(req, 'query', function query(this: Request): ParsedQs {
  const queryparse = this.app.get('query parser fn') as ((str: string) => ParsedQs) | undefined;

  if (!queryparse) {
    return Object.create(null) as ParsedQs;
  }

  const querystring = parse(this as unknown as http.IncomingMessage)?.query ?? '';
  return queryparse(querystring as string);
});

/**
 * Return the protocol string "http" or "https" (respects trust proxy).
 * @public
 */
defineGetter(req, 'protocol', function protocol(this: Request): string {
  const socketEncrypted = (this.socket as { encrypted?: boolean }).encrypted;
  const proto: string = socketEncrypted ? 'https' : 'http';
  const trust = this.app.get('trust proxy fn') as TrustProxyFn;

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
defineGetter(req, 'secure', function secure(this: Request): boolean {
  return this.protocol === 'https';
});

/**
 * Return the remote address from the trusted proxy.
 * @public
 */
defineGetter(req, 'ip', function ip(this: Request): string {
  const trust = this.app.get('trust proxy fn') as TrustProxyFn;
  return proxyaddr(this as unknown as http.IncomingMessage, trust);
});

/**
 * When "trust proxy" is set, trusted proxy addresses + client.
 * @public
 */
defineGetter(req, 'ips', function ips(this: Request): string[] {
  const trust = this.app.get('trust proxy fn') as TrustProxyFn;
  const addrs = proxyaddr.all(this as unknown as http.IncomingMessage, trust);
  addrs.reverse().pop();
  return addrs;
});

/**
 * Return subdomains as an array.
 * @public
 */
defineGetter(req, 'subdomains', function subdomains(this: Request): string[] {
  const hostname = this.hostname;

  if (!hostname) return [];

  const offset = this.app.get('subdomain offset') as number;
  const subdomains = !isIP(hostname)
    ? hostname.split('.').reverse()
    : [hostname];

  return subdomains.slice(offset);
});

/**
 * Short-hand for `url.parse(req.url).pathname`.
 * @public
 */
defineGetter(req, 'path', function path(this: Request): string {
  return parse(this as unknown as http.IncomingMessage)?.pathname ?? '/';
});

/**
 * Parse the "Host" header field to a host.
 * @public
 */
defineGetter(req, 'host', function host(this: Request): string | undefined {
  const trust = this.app.get('trust proxy fn') as TrustProxyFn;
  let val = this.get('X-Forwarded-Host');

  if (!val || !trust(this.socket.remoteAddress ?? '', 0)) {
    val = this.get('Host');
  } else if (val.indexOf(',') !== -1) {
    val = val.substring(0, val.indexOf(',')).trimEnd();
  }

  return val || undefined;
});

/**
 * Parse the "Host" header field to a hostname.
 * @public
 */
defineGetter(req, 'hostname', function hostname(this: Request): string | undefined {
  const host = this.host;

  if (!host) return undefined;

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
defineGetter(req, 'fresh', function (this: Request): boolean {
  const method = this.method;
  const res = this.res;
  const status = res.statusCode;

  if (method !== 'GET' && method !== 'HEAD') return false;

  if ((status >= 200 && status < 300) || status === 304) {
    return fresh(this.headers, {
      etag: res.get('ETag') as string | undefined,
      'last-modified': res.get('Last-Modified') as string | undefined,
    });
  }

  return false;
});

/**
 * Check if the request is stale.
 * @public
 */
defineGetter(req, 'stale', function stale(this: Request): boolean {
  return !this.fresh;
});

/**
 * Check if the request was an XMLHttpRequest.
 * @public
 */
defineGetter(req, 'xhr', function xhr(this: Request): boolean {
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
function defineGetter<T extends object>(obj: T, name: string, getter: (this: T) => unknown): void {
  Object.defineProperty(obj, name, {
    configurable: true,
    enumerable: true,
    get: getter,
  });
}
