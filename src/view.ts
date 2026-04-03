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

import debugLib from 'debug';
import * as nodePath from 'node:path';
import * as fs from 'node:fs';

import type { EngineRenderFn, EngineCallback, IView, ViewOptions } from './types/index.js';

const debug = debugLib('express:view');

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
export class View implements IView {
  defaultEngine: string | undefined;
  ext: string;
  name: string;
  root: string | string[];
  engine!: EngineRenderFn;
  path: string | undefined;

  constructor(name: string, options: ViewOptions) {
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
      this.ext = this.defaultEngine![0] !== '.'
        ? '.' + this.defaultEngine!
        : this.defaultEngine!;

      fileName += this.ext;
    }

    if (!options.engines[this.ext]) {
      // load engine
      const mod = this.ext.slice(1);
      debug('require "%s"', mod);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const engineModule = require(mod) as { __express?: EngineRenderFn };
      const fn = engineModule.__express;

      if (typeof fn !== 'function') {
        throw new Error('Module "' + mod + '" does not provide a view engine.');
      }

      options.engines[this.ext] = fn;
    }

    // store loaded engine
    this.engine = options.engines[this.ext]!;

    // lookup path
    this.path = this.lookup(fileName);
  }

  /**
   * Lookup view by the given `name`.
   * @private
   */
  lookup(name: string): string | undefined {
    let path: string | undefined;
    const roots = ([] as string[]).concat(this.root as string | string[]);

    debug('lookup "%s"', name);

    for (let i = 0; i < roots.length && !path; i++) {
      const root = roots[i]!;

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
  render(options: object, callback: EngineCallback): void {
    let sync = true;

    debug('render "%s"', this.path);

    this.engine(this.path!, options, function onRender(this: unknown, ...args: Parameters<EngineCallback>) {
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
  resolve(dir: string, file: string): string | undefined {
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

/**
 * Return a stat, maybe.
 * @private
 */
function tryStat(path: string): fs.Stats | undefined {
  debug('stat "%s"', path);

  try {
    return fs.statSync(path);
  } catch {
    return undefined;
  }
}
