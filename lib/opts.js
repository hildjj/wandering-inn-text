import * as path from 'node:path'
import diagnostics_channel from 'node:diagnostics_channel'

function noOp() {
  // No-op
}

/**
 * @typedef {object} Options
 * @property {(message?: any, ...optionalParams: any[]) => void;} [log=NoOp]
 * @property {(message?: any, ...optionalParams: any[]) => void;} [debug=NoOp]
 * @property {string} [htmlDir='./html']
 * @property {string} [textDir='./text']
 * @property {boolean} [offline=false]
 * @property {number} [timeoout=500]
 */

/** @type {Options} */
export const defaultOpts = {
  log: noOp,
  debug: noOp,
  htmlDir: path.resolve('html'),
  textDir: path.resolve('text'),
  offline: false,
  timeout: 1000,
}

/**
 * @param {Options} opts
 */
function verbosify(opts) {
  if (opts.verbose > 0) {
    if (opts.log === noOp) {
      // eslint-disable-next-line no-console
      opts.log = console.log.bind(console)
    }

    if (opts.verbose > 1) {
      if (opts.debug === noOp) {
        // eslint-disable-next-line no-console
        opts.debug = console.log.bind(console)
      }

      diagnostics_channel.channel('undici:request:create').subscribe(({request}) => {
        opts.debug('origin', request.origin)
        opts.debug('completed', request.completed)
        opts.debug('method', request.method)
        opts.debug('path', request.path)
        opts.debug('headers')
        opts.debug(request
          .headers
          .toString()
          .replace(/^/gm, '  ')
          .trim())
      })
    }
  }
}

/**
 * Combine any given options with the default options, then normalize
 * filenames and logging functions.
 *
 * @param {Options} [opts]
 * @returns {Options}
 */
export function options(opts) {
  opts = {
    ...defaultOpts,
    ...opts,
  }
  verbosify(opts)
  opts.htmlDir = path.resolve(opts.htmlDir)
  opts.textDir = path.resolve(opts.textDir)
  return opts
}
