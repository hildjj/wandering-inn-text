#!/usr/bin/env node

import * as fs from 'fs/promises'
import * as path from 'path'
import {Buffer} from 'buffer'
import {Command} from 'commander'
import {HtmlToMarkdown} from '../lib/html.js'
import diagnostics_channel from 'diagnostics_channel'
import {fileURLToPath} from 'url'
import {parseHTML} from 'linkedom'
import {setTimeout} from 'timers/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const html = path.resolve(__dirname, '..', 'html')
const text = path.resolve(__dirname, '..', 'text')

const prog = new Command()
  .option('-f, --force', 'Force processing. May be specified multiple times.  First time forces .md file generation.', (_, prev) => prev + 1, 0)
  .option('-O, --offline', 'Do not try to update existing docs')
  .option('-s, --style', 'Inline style information with {{{style}}}')
  .option('-t, --timeout <ms>', 'Pause between fetches, in milliseconds', 500)
  .option('-v, --verbose', 'Enable verbose logging')

const opts = prog.parse().opts()

let log = () => {
  // No-op
}

if (opts.verbose) {
  // eslint-disable-next-line no-console
  log = (...args) => console.log(...args)

  diagnostics_channel.channel('undici:request:create').subscribe(({request}) => {
    log('origin', request.origin)
    log('completed', request.completed)
    log('method', request.method)
    log('path', request.path)
    log('headers')
    log(request
      .headers
      .toString()
      .replace(/^/gm, '  ')
      .trim())
  })
}

const hm = new HtmlToMarkdown(opts)

const DIRS = new Set()
async function mkdir(nm) {
  if (!DIRS.has(nm)) {
    await fs.mkdir(nm, {recursive: true})
    DIRS.add(nm)
  }
}
function slug(s) {
  return escape(s.trim().replace(/ /g, '_'))
}

function trimURL(url) {
  const u = new URL(url)
  return `${u.pathname.replace(/\/$/, '')}.html`
}

async function getHTML(url, filename) {
  let handle = undefined
  const headers = {}
  let file = filename ?
    path.join(html, filename) :
    path.join(html, trimURL(url))

  if (!file.endsWith('.html')) {
    file = `${file}.html`
  }
  const dir = `html/${path.basename(path.dirname(file))}/${path.basename(file)}`
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
      log(`Refresh file: "${dir}"\n`)
      await handle.write(resAB)
      await handle.close()
      mtime = new Date()
    } else {
      log(`New file: "${dir}"\n`)
      await mkdir(path.dirname(file))
      await fs.writeFile(file, resAB)
    }
    await setTimeout(opts.timeout)
    return [resAB.toString('utf-8'), mtime]
  }
  if (r.status === 304) {
    log(`Cache hit, reading: "${dir}"`)
    const res = await handle.readFile('utf8')
    await handle.close()
    return [res, mtime]
  }
  throw new Error(`Unknown HTTP Status code: "${r.status}"`)
}

async function processChapter(chap, count, title, url) {
  const fn = `${chap}/${(count).toString().padStart(3, 0)}-${slug(title)}`
  const fnt = `${path.join(text, fn)}.md`
  let handle = undefined
  let mtime = null
  try {
    // Want this to fail on file not found
    handle = await fs.open(fnt, 'r+')
    ;({mtime} = await handle.stat())
  } catch {
    // Ignored
  }

  const [src, smtime] = await getHTML(url, fn)
  if ((opts.force === 0) && mtime && (mtime > smtime)) {
    log(`Up-to-date: "text/${fn}.md"`)
    await handle.close()
    return
  }
  if (!handle) {
    await mkdir(path.join(text, chap))
    handle = await fs.open(fnt, 'w')
  }

  log(`Writing: "text/${fn}.md"`)
  const {document} = parseHTML(src)

  await handle.write('# ')
  await handle.write(hm.md(document.querySelector('.entry-title')))
  await handle.write('\n\n')

  for (const p of document.querySelector('.entry-content').children) {
    if (p.nodeName === 'FOOTER') {
      break
    }
    await handle.write(hm.md(p))
    await handle.write('\n\n')
  }
  await handle.close()
}

async function main(argv) {
  const [toc] = (await getHTML('https://wanderinginn.com/table-of-contents/'))
  const {document} = parseHTML(toc)
  const parent = document.querySelector('.entry-content')
  let chap = null
  for (const p of parent.children) {
    const title = p.querySelector('strong')
    if (title) {
      chap = slug(title.innerText)
      log(chap)
    } else if (chap) {
      let count = 0
      for (const a of p.querySelectorAll('a')) {
        await processChapter(chap, count++, a.innerText, a.href)
      }
    }
  }
}

// eslint-disable-next-line no-console
main(process.argv.slice(2)).catch(console.error)
