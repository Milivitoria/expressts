/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */
import type { AcceptParams, ETagFn, ETagSetting, QueryParserFn, QueryParserSetting, TrustProxyFn, TrustProxySetting } from './types/index.js';
/**
 * A list of lowercased HTTP methods supported by Node.js.
 * @public
 */
export declare const methods: string[];
/**
 * Return strong ETag for `body`.
 * @public
 */
export declare const strongEtag: ETagFn;
/**
 * Return weak ETag for `body`.
 * @public
 */
export declare const wetag: ETagFn;
export { strongEtag as etag };
/**
 * Normalize the given `type`, e.g. "html" → "text/html".
 * @public
 */
export declare function normalizeType(type: string): AcceptParams;
/**
 * Normalize an array of types.
 * @public
 */
export declare function normalizeTypes(types: string[]): AcceptParams[];
/**
 * Compile "etag" setting value to a function.
 * @public
 */
export declare function compileETag(val: ETagSetting): ETagFn | undefined;
/**
 * Compile "query parser" setting value to a function.
 * @public
 */
export declare function compileQueryParser(val: QueryParserSetting): QueryParserFn | undefined;
/**
 * Compile "trust proxy" setting value to a function.
 * @public
 */
export declare function compileTrust(val: TrustProxySetting): TrustProxyFn;
/**
 * Set the charset in a given Content-Type string.
 * @public
 */
export declare function setCharset(type: string, charset: string): string;
//# sourceMappingURL=utils.d.ts.map