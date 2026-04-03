/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */
import type { EngineRenderFn, EngineCallback, IView, ViewOptions } from './types/index.js';
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
export declare class View implements IView {
    defaultEngine: string | undefined;
    ext: string;
    name: string;
    root: string | string[];
    engine: EngineRenderFn;
    path: string | undefined;
    constructor(name: string, options: ViewOptions);
    /**
     * Lookup view by the given `name`.
     * @private
     */
    lookup(name: string): string | undefined;
    /**
     * Render with the given options.
     * @private
     */
    render(options: object, callback: EngineCallback): void;
    /**
     * Resolve the file within the given directory.
     * @private
     */
    resolve(dir: string, file: string): string | undefined;
}
//# sourceMappingURL=view.d.ts.map