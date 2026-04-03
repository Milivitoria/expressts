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
exports.etag = exports.wetag = exports.strongEtag = exports.methods = void 0;
exports.normalizeType = normalizeType;
exports.normalizeTypes = normalizeTypes;
exports.compileETag = compileETag;
exports.compileQueryParser = compileQueryParser;
exports.compileTrust = compileTrust;
exports.setCharset = setCharset;
/**
 * Module dependencies.
 * @private
 */
const node_http_1 = require("node:http");
const node_buffer_1 = require("node:buffer");
const contentType = __importStar(require("content-type"));
const etag_1 = __importDefault(require("etag"));
const mime = __importStar(require("mime-types"));
const proxy_addr_1 = __importDefault(require("proxy-addr"));
const qs_1 = __importDefault(require("qs"));
const querystring = __importStar(require("node:querystring"));
// ────────────────────────────────────────────────────────────────────────────────
// HTTP methods
// ────────────────────────────────────────────────────────────────────────────────
/**
 * A list of lowercased HTTP methods supported by Node.js.
 * @public
 */
exports.methods = node_http_1.METHODS.map((method) => method.toLowerCase());
// ────────────────────────────────────────────────────────────────────────────────
// ETag helpers
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Return strong ETag for `body`.
 * @public
 */
exports.strongEtag = createETagGenerator({ weak: false });
exports.etag = exports.strongEtag;
/**
 * Return weak ETag for `body`.
 * @public
 */
exports.wetag = createETagGenerator({ weak: true });
// ────────────────────────────────────────────────────────────────────────────────
// MIME / content-type helpers
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Normalize the given `type`, e.g. "html" → "text/html".
 * @public
 */
function normalizeType(type) {
    return type.indexOf('/') !== -1
        ? acceptParams(type)
        : { value: mime.lookup(type) || 'application/octet-stream', params: {} };
}
/**
 * Normalize an array of types.
 * @public
 */
function normalizeTypes(types) {
    return types.map(normalizeType);
}
// ────────────────────────────────────────────────────────────────────────────────
// Setting compilers
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Compile "etag" setting value to a function.
 * @public
 */
function compileETag(val) {
    if (typeof val === 'function') {
        return val;
    }
    switch (val) {
        case true:
        case 'weak':
            return exports.wetag;
        case false:
            return undefined;
        case 'strong':
            return exports.strongEtag;
        default:
            throw new TypeError('unknown value for etag function: ' + String(val));
    }
}
/**
 * Compile "query parser" setting value to a function.
 * @public
 */
function compileQueryParser(val) {
    if (typeof val === 'function') {
        return val;
    }
    switch (val) {
        case true:
        case 'simple':
            return querystring.parse;
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
function compileTrust(val) {
    if (typeof val === 'function')
        return val;
    if (val === true) {
        return () => true;
    }
    if (typeof val === 'number') {
        return (_a, i) => i < val;
    }
    if (typeof val === 'string') {
        val = val.split(',').map((v) => v.trim());
    }
    return proxy_addr_1.default.compile(val || []);
}
// ────────────────────────────────────────────────────────────────────────────────
// Charset helper
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Set the charset in a given Content-Type string.
 * @public
 */
function setCharset(type, charset) {
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
function acceptParams(str) {
    const length = str.length;
    let colonIndex = str.indexOf(';');
    let index = colonIndex === -1 ? length : colonIndex;
    const ret = { value: str.slice(0, index).trim(), quality: 1, params: {} };
    while (index < length) {
        const splitIndex = str.indexOf('=', index);
        if (splitIndex === -1)
            break;
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
        }
        else {
            ret.params[key] = value;
        }
        index = endIndex + 1;
    }
    return ret;
}
/**
 * Create an ETag generator function with the given options.
 */
function createETagGenerator(options) {
    return function generateETag(body, encoding) {
        const buf = !node_buffer_1.Buffer.isBuffer(body)
            ? node_buffer_1.Buffer.from(body, encoding)
            : body;
        return (0, etag_1.default)(buf, options);
    };
}
/**
 * Parse an extended query string with qs.
 */
function parseExtendedQueryString(str) {
    return qs_1.default.parse(str, { allowPrototypes: true });
}
//# sourceMappingURL=utils.js.map