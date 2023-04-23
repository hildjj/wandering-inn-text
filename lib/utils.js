import * as fs from 'node:fs/promises'
import filenamify from 'filenamify'

// Avoid I/O for directories we already made sure exist
const DIRS = new Set()

/**
 * Create a directory, ensuring the entire path exists.  Fast to call
 * on the same directory more than once.  Will not deal with directories
 * that were deleted while the program was running.
 *
 * @param {string} nm Directory name
 * @returns {Promise<void>}
 */
export async function mkdir(nm) {
  if (!DIRS.has(nm)) {
    await fs.mkdir(nm, {recursive: true})
    DIRS.add(nm)
  }
}

/**
 * Make a string safe as a file or directory name, maintaining some amount
 * of readability.
 *
 * @param {string} s
 * @returns {string} The escaped string.
 */
export function slug(s) {
  return filenamify(s.trim(), {
    replacement: '_',
    maxLength: 250,
  })
}

export function trimURL(url) {
  const u = new URL(url)
  return `${u.pathname.replace(/\/$/, '')}.html`
}
