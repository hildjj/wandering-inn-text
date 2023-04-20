#!/usr/bin/env node

import * as fs from 'fs/promises'
import * as ofs from 'fs'
import * as path from 'path'
import {Buffer} from 'buffer'
import {Command} from 'commander'
import diagnostics_channel from 'diagnostics_channel'
import {fileURLToPath} from 'url'
import {parseHTML} from 'linkedom'
import {setTimeout} from 'timers/promises'
// eslint-disable-next-line node/no-extraneous-import
import wrap from 'wrap-text'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const html = path.resolve(__dirname, '..', 'html')
const text = path.resolve(__dirname, '..', 'text')

const {
  COMMENT_NODE,
  ELEMENT_NODE,
  TEXT_NODE,
} = parseHTML('').Node

const prog = new Command()
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
  const dir = `${path.basename(path.dirname(file))}/${path.basename(file)}`

  try {
    handle = await fs.open(file, 'r+')
    const stats = await handle.stat()
    headers['If-Modified-Since'] = stats.mtime.toUTCString()
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
    } else {
      log(`New file: "${dir}"\n`)
      await fs.mkdir(path.dirname(file), {recursive: true})
      await fs.writeFile(file, resAB)
    }
    await setTimeout(opts.timeout)
    return resAB.toString('utf-8')
  }
  if (r.status === 304) {
    log(`Cache hit, reading: "${dir}"`)
    const res = handle.readFile('utf8')
    await handle.close()
    return res
  }
  throw new Error(`Unknown HTTP Status code: "${r.status}"`)
}

function htmlToText(node) {
  switch (node.nodeType) {
    case TEXT_NODE:
      return node.wholeText.replace(/[ \t\r\n]+/g, ' ')
    case COMMENT_NODE:
      return `<!--${node.nodeValue}-->`
    case ELEMENT_NODE:
      switch (node.tagName) {
        case 'DIV':
        case 'P':
        case 'SPAN': {
          let prefix = ''
          const suffix = (node.tagName === 'SPAN') ? '' : '\n'
          if (opts.style) {
            if (node.style.length > 0) {
              prefix = node.style.toString()
            }
            if (node.classList.length > 0) {
              if (prefix) {
                prefix += ' '
              }
              prefix += [...node.classList].join(' ')
            }
            if (prefix) {
              prefix = `{{{${prefix}}}}\n`
            }
          }
          return prefix + node.childNodes.map(htmlToText).join('') + suffix
        }
        case 'OL': {
          let count = 1
          return node.childNodes.map(child => {
            if (child.nodeName === 'LI') {
              return `${count++}. ${htmlToText(child)}`
            }
            return htmlToText(child)
          }).join('')
        }
        case 'UL': {
          return node.childNodes.map(child => {
            if (child.nodeName === 'LI') {
              return `- ${htmlToText(child)}`
            }
            return htmlToText(child)
          }).join('')
        }
        case 'DL':
        case 'DT':
        case 'LI':
          return `${node.childNodes.map(htmlToText).join('')}\n`
        case 'EM':
          return `*${node.innerText}*`
        case 'B':
        case 'STRONG':
          return `**${node.innerText}**`
        case 'DEL':
          return `~~${node.innerText}~~`
        case 'U':
        case 'SUP':
        case 'SUB':
          return `<${node.localName}>${node.innerText}</${node.localName}>`
        case 'BLOCKQUOTE':
          return `\`\`\`\n${node.innerText.trim()}\n\`\`\``
        case 'H1':
          return `# ${node.innerText.trim()}`
        case 'H2':
          return `## ${node.innerText.trim()}`
        case 'H3':
          return `### ${node.innerText.trim()}`
        case 'I':
          return `/${node.innerText}/`
        case 'A': {
          const txt = node.innerText.trim()
          if (/(?:next|previous)\s+chapter/i.test(txt)) {
            return ''
          }
          return `[${txt}](${node.href})`
        }
        case 'BR':
          return '\n'
        case 'HR':
          return '---\n'
        case 'TIME':
          return node.innerText
        case 'AUDIO':
        case 'IFRAME':
        case 'IMG':
        case 'SCRIPT':
        case 'STYLE':
          return ''
        default:
          throw new Error(`Unknown tag: "${node.tagName}"`)
      }
    default:
      throw new Error(`Unknown nodeType: ${node.nodeType}`)
  }
}

async function processChapter(chap, count, title, url) {
  const fn = `${chap}/${(count).toString().padStart(3, 0)}-${slug(title)}`
  const src = await getHTML(url, fn)
  const {document} = parseHTML(src)
  await fs.mkdir(path.join(text, chap), {recursive: true})
  const out = ofs.createWriteStream(`${path.join(text, fn)}.txt`)
  out.write(wrap(document.querySelector('.entry-title').innerText))
  out.write('\n\n')

  for (const p of document.querySelector('.entry-content').children) {
    out.write(wrap(htmlToText(p)))
    out.write('\n')
  }
  out.close()
}

async function main(argv) {
  const toc = await getHTML('https://wanderinginn.com/table-of-contents/')
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
