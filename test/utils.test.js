import {describe, it} from 'node:test'
import {mkdir, slug, trimURL} from '../lib/utils.js'
import {rmdir, stat} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

const tmp = tmpdir()

describe('utils', () => {
  it('mkdir', async() => {
    const fb = join(tmp, String(process.pid), 'foo', 'bar')
    await mkdir(fb)
    await stat(fb)
    await mkdir(fb)
    await rmdir(fb)
  })

  it('slug', () => {
    assert.equal(slug('foo'), 'foo')
    assert.equal(slug('foo bar'), 'foo bar')
    assert.equal(slug('<>:"/\\|?*"'), '_')
  })

  it('trimURL', () => {
    assert.equal(
      trimURL('https://wanderinginn.com/table-of-contents/'),
      '/table-of-contents.html'
    )
  })
})
