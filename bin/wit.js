#!/usr/bin/env node

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {Command, Option} from 'commander'
import {defaultOpts, options} from '../lib/opts.js'
import {mkdir, slug} from '../lib/utils.js'
import {HtmlToMarkdown} from '../lib/html.js'
import {SingleBar} from 'cli-progress'
import {getHTML} from '../lib/net.js'
import {parseHTML} from 'linkedom'

const prog = new Command()
  .option('-f, --force', 'Force processing. May be specified multiple times.  First time forces .md file generation.', (_, prev) => prev + 1, 0)
  .addOption(
    new Option('--html-dir <directory>', 'Directory in which to save HTML')
      .default(defaultOpts.htmlDir, './html')
      .env('WIT_HTML')
  )
  .addOption(
    new Option('--text-dir <directory>', 'Directory in which to save markdown')
      .default(defaultOpts.textDir, './text')
      .env('WIT_TEXT')
  )
  .option('-O, --offline', 'Do not try to update existing docs')
  .option('-s, --style', 'Inline style information with {{{style}}}')
  .option('-t, --timeout <ms>', 'Pause between fetches, in milliseconds', defaultOpts.timeout)
  .option('-v, --verbose', 'Enable verbose logging', (_, prev) => prev + 1, 0)

const opts = options(prog.parse().opts())
opts.debug('%O', opts)

const hm = new HtmlToMarkdown(opts)

async function processChapter(chap, count, title, url) {
  const fn = `${chap}/${(count).toString().padStart(3, 0)}-${slug(title)}`
  const fnt = `${path.join(opts.textDir, fn)}.md`
  let handle = undefined
  let mtime = null
  try {
    // Want this to fail on file not found
    handle = await fs.open(fnt, 'r+')
    ;({mtime} = await handle.stat())
  } catch {
    // Ignored
  }

  const [src, smtime] = await getHTML(url, fn, opts)
  if ((opts.force === 0) && mtime && (mtime > smtime)) {
    opts.log(`Up-to-date: "text/${fn}.md"`)
    await handle.close()
    return
  }
  if (!handle) {
    await mkdir(path.join(opts.textDir, chap))
    handle = await fs.open(fnt, 'w')
  }

  opts.log(`Writing: "text/${fn}.md"`)
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
  const [toc] = (await getHTML('https://wanderinginn.com/table-of-contents/', undefined, opts))
  const {document} = parseHTML(toc)
  const parent = document.querySelector('.entry-content')
  const total = parent.querySelectorAll('p > a').length
  let statusBar = null
  if (opts.verbose === 0) {
    statusBar = new SingleBar({
      hideCursor: true,
      clearOnComplete: true,
    })
    statusBar.start(total, 0)
  }
  try {
    let chap = null
    for (const p of parent.children) {
      const title = p.querySelector('strong')
      if (title) {
        chap = slug(title.innerText)
        opts.log(chap)
      } else if (chap) {
        let count = 0
        for (const a of p.querySelectorAll('a')) {
          await processChapter(chap, count++, a.innerText, a.href)
          statusBar.increment()
        }
      }
    }
  } finally {
    statusBar?.stop()
  }
}

// eslint-disable-next-line no-console
main(process.argv.slice(2)).catch(console.error)
