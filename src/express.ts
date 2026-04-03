/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

import bodyParser from 'body-parser';
import { EventEmitter } from 'node:events';
import mixin from 'merge-descriptors';
import proto from './application.js';
import Router from 'router';
import req from './request.js';
import res from './response.js';
import serveStatic from 'serve-static';

import type {
  Application,
  ExpressFactory,
  RequestHandler,
} from './types/index.js';

// ────────────────────────────────────────────────────────────────────────────────
// Factory
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Create an Express application.
 *
 * @return {Application}
 * @public
 */
function createApplication(): Application {
  const app = function (
    appReq: Parameters<Application>[0],
    appRes: Parameters<Application>[1],
    next: Parameters<Application>[2]
  ) {
    app.handle(appReq, appRes, next);
  } as unknown as Application;

  mixin(app, EventEmitter.prototype, false);
  mixin(app, proto, false);

  // expose the prototype that will get set on requests
  app.request = Object.create(req, {
    app: { configurable: true, enumerable: true, writable: true, value: app },
  });

  // expose the prototype that will get set on responses
  app.response = Object.create(res, {
    app: { configurable: true, enumerable: true, writable: true, value: app },
  });

  app.init();
  return app;
}

// ────────────────────────────────────────────────────────────────────────────────
// Module exports
// ────────────────────────────────────────────────────────────────────────────────

const express = createApplication as unknown as ExpressFactory;

// Prototypes
express.application = proto as unknown as ExpressFactory['application'];
express.request = req;
express.response = res;

// Constructors
express.Route = (Router as unknown as { Route: ExpressFactory['Route'] }).Route;
express.Router = Router as unknown as ExpressFactory['Router'];

// Middleware
express.json = bodyParser.json as unknown as ExpressFactory['json'];
express.raw = bodyParser.raw as unknown as ExpressFactory['raw'];
express.static = serveStatic as unknown as ExpressFactory['static'];
express.text = bodyParser.text as unknown as ExpressFactory['text'];
express.urlencoded = bodyParser.urlencoded as unknown as ExpressFactory['urlencoded'];

export = express;
