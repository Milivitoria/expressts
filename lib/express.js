"use strict";
/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
/**
 * Module dependencies.
 */
const body_parser_1 = __importDefault(require("body-parser"));
const node_events_1 = require("node:events");
const merge_descriptors_1 = __importDefault(require("merge-descriptors"));
const application_js_1 = __importDefault(require("./application.js"));
const router_1 = __importDefault(require("router"));
const request_js_1 = __importDefault(require("./request.js"));
const response_js_1 = __importDefault(require("./response.js"));
const serve_static_1 = __importDefault(require("serve-static"));
// ────────────────────────────────────────────────────────────────────────────────
// Factory
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Create an Express application.
 *
 * @return {Application}
 * @public
 */
function createApplication() {
    const app = function (appReq, appRes, next) {
        app.handle(appReq, appRes, next);
    };
    (0, merge_descriptors_1.default)(app, node_events_1.EventEmitter.prototype, false);
    (0, merge_descriptors_1.default)(app, application_js_1.default, false);
    // expose the prototype that will get set on requests
    app.request = Object.create(request_js_1.default, {
        app: { configurable: true, enumerable: true, writable: true, value: app },
    });
    // expose the prototype that will get set on responses
    app.response = Object.create(response_js_1.default, {
        app: { configurable: true, enumerable: true, writable: true, value: app },
    });
    app.init();
    return app;
}
// ────────────────────────────────────────────────────────────────────────────────
// Module exports
// ────────────────────────────────────────────────────────────────────────────────
const express = createApplication;
// Prototypes
express.application = application_js_1.default;
express.request = request_js_1.default;
express.response = response_js_1.default;
// Constructors
express.Route = router_1.default.Route;
express.Router = router_1.default;
// Middleware
express.json = body_parser_1.default.json;
express.raw = body_parser_1.default.raw;
express.static = serve_static_1.default;
express.text = body_parser_1.default.text;
express.urlencoded = body_parser_1.default.urlencoded;
module.exports = express;
//# sourceMappingURL=express.js.map