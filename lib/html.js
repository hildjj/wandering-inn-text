import Turndown from 'turndown'
import {gfm} from 'turndown-plugin-gfm'
import wrap from 'wrap-text'

const CHAPTER = /^\s*(?:next|previous)\s+chapter\s*$/i

/**
 * Convert HTML to Markdown using an opinionated slice of Turndown.
 */
export class HtmlToMarkdown {
  #turndown = null

  /**
   * Create an instance.
   *
   * @param {object} [opts] Options
   * @property {boolean} [opts.style] Whether to inject style information from
   *   p, div, and span tags.  Style info will be wrapped as `{{{style}}}`
   */
  constructor(opts = {}) {
    this.#turndown = new Turndown({
      bulletListMarker: '-',
      hr: '---',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      headingStyle: 'atx',
    })
    this.#turndown.remove(['audio', 'iframe', 'script', 'style'])
    this.#turndown.use(gfm)

    // Faking an underline is better than ignoring the tag or letting it pass
    // through, imo, even though it's not markdown syntax.
    this.#turndown.addRule('underline', {
      filter: 'u',
      replacement(content) {
        return `_${content.replace(/[ \t]/g, '_')}_`
      },
    })

    // See: https://www.markdownguide.org/extended-syntax/#subscript
    this.#turndown.addRule('sub', {
      filter: 'sub',
      replacement(content) {
        return `~${content}~`
      },
    })

    // See: https://www.markdownguide.org/extended-syntax/#superscript
    this.#turndown.addRule('sup', {
      filter: 'sup',
      replacement(content) {
        return `^${content}^`
      },
    })

    this.#turndown.addRule('remove chapter links', {
      filter(node) {
        // Will fail if string passed in to md() and
        // globalThis.window.DOMParser not set correctly.
        return (node.nodeName === 'A') && CHAPTER.test(node.innerText)
      },
      replacement() {
        return ''
      },
    })

    if (opts.style) {
      this.#turndown.addRule('style', {
        filter: ['span', 'p', 'div'],
        replacement(content, node) {
          if ((node.tagName === 'SPAN') && CHAPTER.test(content)) {
            return ''
          }
          const suffix = (node.tagName === 'SPAN') ? '' : '\n'
          let prefix = ''
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
          return prefix + content + suffix
        },
      })
    } else {
      this.#turndown.addRule('last chapter', {
        filter(node) {
          return (node.nodeName === 'SPAN') && CHAPTER.test(node.innerText)
        },
        replacement(content, node) {
          return ''
        },
      })
    }
  }

  /**
   * Convert HTML to markdown according to the current ruleset.
   *
   * @param {string|Turndown.Node} html The HTML to convert.
   * @returns {string} Markdown as string
   */
  md(html) {
    return wrap(this.#turndown.turndown(html))
  }
}
