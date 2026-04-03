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

import { METHODS } from 'node:http';
import { Buffer } from 'node:buffer';
import * as contentType from 'content-type';
import etag from 'etag';
import * as mime from 'mime-types';
import proxyaddr from 'proxy-addr';
import qs from 'qs';
import * as querystring from 'node:querystring';

import type {
  AcceptParams,
  ETagFn,
  ETagSetting,
  ParsedQs,
  QueryParserFn,
  QueryParserSetting,
  TrustProxyFn,
  TrustProxySetting,
} from './types/index.js';

// ────────────────────────────────────────────────────────────────────────────────
// HTTP methods
// ────────────────────────────────────────────────────────────────────────────────

/**
 * A list of lowercased HTTP methods supported by Node.js.
 * @public
 */
export const methods: string[] = METHODS.map((method) => method.toLowerCase());

// ────────────────────────────────────────────────────────────────────────────────
// ETag helpers
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Return strong ETag for `body`.
 * @public
 */
export const strongEtag: ETagFn = createETagGenerator({ weak: false });

/**
 * Return weak ETag for `body`.
 * @public
 */
export const wetag: ETagFn = createETagGenerator({ weak: true });

// Keep legacy export name used by response.js
export { strongEtag as etag };

// ────────────────────────────────────────────────────────────────────────────────
// MIME / content-type helpers
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Normalize the given `type`, e.g. "html" → "text/html".
 * @public
 */
export function normalizeType(type: string): AcceptParams {
  return type.indexOf('/') !== -1
    ? acceptParams(type)
    : { value: mime.lookup(type) || 'application/octet-stream', params: {} };
}

/**
 * Normalize an array of types.
 * @public
 */
export function normalizeTypes(types: string[]): AcceptParams[] {
  return types.map(normalizeType);
}

// ────────────────────────────────────────────────────────────────────────────────
// Setting compilers
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Compile "etag" setting value to a function.
 * @public
 */
export function compileETag(val: ETagSetting): ETagFn | undefined {
  if (typeof val === 'function') {
    return val;
  }

  switch (val) {
    case true:
    case 'weak':
      return wetag;
    case false:
      return undefined;
    case 'strong':
      return strongEtag;
    default:
      throw new TypeError('unknown value for etag function: ' + String(val));
  }
}

/**
 * Compile "query parser" setting value to a function.
 * @public
 */
export function compileQueryParser(val: QueryParserSetting): QueryParserFn | undefined {
  if (typeof val === 'function') {
    return val;
  }

  switch (val) {
    case true:
    case 'simple':
      return querystring.parse as QueryParserFn;
    case false:
      return undefined;
    case 'extended':
      return parseExtendedQueryString;
    default:
      throw new TypeError('unknown value for query parser function: ' + String(val));
  }
}

/**
 * Compile "trust proxy" setting value to a function.
 * @public
 */
export function compileTrust(val: TrustProxySetting): TrustProxyFn {
  if (typeof val === 'function') return val as TrustProxyFn;

  if (val === true) {
    return () => true;
  }

  if (typeof val === 'number') {
    return (_a: string, i: number) => i < (val as number);
  }

  if (typeof val === 'string') {
    val = val.split(',').map((v) => v.trim());
  }

  return proxyaddr.compile(val || []) as TrustProxyFn;
}

// ────────────────────────────────────────────────────────────────────────────────
// Charset helper
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Set the charset in a given Content-Type string.
 * @public
 */
export function setCharset(type: string, charset: string): string {
  if (!type || !charset) {
    return type;
  }

  const parsed = contentType.parse(type);
  parsed.parameters['charset'] = charset;
  return contentType.format(parsed);
}

// ────────────────────────────────────────────────────────────────────────────────
// Private helpers
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Parse accept params `str` returning an object with
 * `.value`, `.quality` and `.params`.
 */
function acceptParams(str: string): AcceptParams {
  const length = str.length;
  let colonIndex = str.indexOf(';');
  let index = colonIndex === -1 ? length : colonIndex;
  const ret: AcceptParams = { value: str.slice(0, index).trim(), quality: 1, params: {} };

  while (index < length) {
    const splitIndex = str.indexOf('=', index);
    if (splitIndex === -1) break;

    colonIndex = str.indexOf(';', index);
    const endIndex = colonIndex === -1 ? length : colonIndex;

    if (splitIndex > endIndex) {
      index = str.lastIndexOf(';', splitIndex - 1) + 1;
      continue;
    }

    const key = str.slice(index, splitIndex).trim();
    const value = str.slice(splitIndex + 1, endIndex).trim();

    if (key === 'q') {
      ret.quality = parseFloat(value);
    } else {
      ret.params[key] = value;
    }

    index = endIndex + 1;
  }

  return ret;
}

/**
 * Create an ETag generator function with the given options.
 */
function createETagGenerator(options: { weak: boolean }): ETagFn {
  return function generateETag(body: Buffer | string, encoding?: BufferEncoding): string {
    const buf = !Buffer.isBuffer(body)
      ? Buffer.from(body as string, encoding)
      : body;
    return etag(buf, options);
  };
}

/**
 * Parse an extended query string with qs.
 */
function parseExtendedQueryString(str: string): ParsedQs {
  return qs.parse(str, { allowPrototypes: true }) as unknown as ParsedQs;
}
