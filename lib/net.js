import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {mkdir, trimURL} from './utils.js'
import {Buffer} from 'node:buffer'
import {defaultOpts} from './opts.js'
import {setTimeout} from 'timers/promises'

/**
 *
 * @param {string|URL} url
 * @param {string} filename
 * @param {import('./opts.js').Options} opts
 * @returns {Promise<[string, Date]>}
 */
export async function getHTML(url, filename, opts) {
  opts = {
    ...defaultOpts,
    ...opts,
  }
  let handle = undefined
  const headers = {}
  let file = filename ?
    path.join(opts.htmlDir, filename) :
    path.join(opts.htmlDir, trimURL(url))

  if (!file.endsWith('.html')) {
    file = `${file}.html`
  }
  const dir = `${path.basename(path.dirname(file))}/${path.basename(file)}`
  let mtime = new Date()
  try {
    handle = await fs.open(file, 'r+')
    const stats = await handle.stat()
    ;({mtime} = stats)
    headers['If-Modified-Since'] = mtime.toUTCString()
  } catch {
    // Ignored
  }

  const r = (handle && opts.offline) ?
    {status: 304} :
    await fetch(url, {
      headers,
    })
  if (r.status === 200) {
    const resAB = Buffer.from(await r.arrayBuffer())
    if (handle) {
      opts.log(`Refresh file: "${dir}"\n`)
      await handle.write(resAB)
      await handle.close()
      mtime = new Date()
    } else {
      opts.log(`New file: "${dir}"\n`)
      await mkdir(path.dirname(file))
      await fs.writeFile(file, resAB)
    }
    await setTimeout(opts.timeout)
    return [resAB.toString('utf-8'), mtime]
  }
  if (r.status === 304) {
    opts.log(`Cache hit, reading: "${dir}"`)
    const res = await handle.readFile('utf8')
    await handle.close()
    return [res, mtime]
  }
  throw new Error(`Unknown HTTP Status code: "${r.status}"`)
}
