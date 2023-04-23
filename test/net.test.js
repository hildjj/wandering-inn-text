import {MockAgent, setGlobalDispatcher} from 'undici'
import {after, it} from 'node:test'
import assert from 'node:assert/strict'
import {getHTML} from '../lib/net.js'
import {join} from 'node:path'
import {options} from '../lib/opts.js'
import {rm} from 'fs/promises'
import {tmpdir} from 'node:os'

const mockAgent = new MockAgent()
// This works through `globalThis[Symbol.for('undici.globalDispatcher.1')]`
// so this will eventually fail when node moves away from undici.
setGlobalDispatcher(mockAgent)

const mockPool = mockAgent.get('http://localhost:3000')

mockPool.intercept({
  path: '/foo',
  method: 'GET',
  headers: {
    'if-modified-since': str => str?.length > 1,
  },
}).reply(304, 'Not modified')

function nowHtml() {
  return {
    statusCode: 200,
    data: `<html><body>${new Date().toISOString()}</body></html>`,
    headers: {
      'content-type': 'text/html',
      'last-modified': new Date().toUTCString(),
    },
  }
}
mockPool.intercept({
  path: '/foo',
  method: 'GET',
}).reply(nowHtml)

mockPool.intercept({path: '/boo', method: 'GET'})
  .reply(nowHtml)
  .times(2)

mockPool.intercept({
  path: '/bad',
  method: 'GET',
}).reply(500, 'Mistake')

await it('getHTML', async() => {
  const pidDir = join(tmpdir(), `wandering-inn-text-${String(process.pid)}`)
  const htmlDir = join(pidDir, 'html')
  after(async() => {
    await rm(pidDir, {recursive: true})
    mockAgent.assertNoPendingInterceptors()
  })

  const opts = options({
    htmlDir,
    timeout: 10,
  })

  let html1 = null
  let mod1 = null
  await it('gets a new file', async() => {
    [html1, mod1] = await getHTML('http://localhost:3000/foo', undefined, opts)
    assert.match(html1, /<html><body>/)
  })

  await it('gets a cached file', async() => {
    const [html2, mod2] = await getHTML('http://localhost:3000/foo', 'foo', opts)
    assert.match(html2, /<html><body>/)
    assert.equal(html2, html1)
    assert(mod1 < mod2)
  })

  await it('Catches bad status codes', () => {
    assert.rejects(() => getHTML('http://localhost:3000/bad', undefined, opts))
  })

  await it('refreshes cache when needed', async() => {
    function debug(...args) {
      // No-op
    }
    const o = options({
      ...opts,
      verbose: 2,
      log: debug,
      debug,
    })

    const [html3] = await getHTML('http://localhost:3000/boo', undefined, o)
    const [html4] = await getHTML('http://localhost:3000/boo', undefined, o)
    assert.notEqual(html3, html4)
  })

  it('avoids the network if offline mode', async() => {
    // Would otherwise fail because we didnt do .times() on foo
    const [html5] = await getHTML('http://localhost:3000/foo', undefined, {
      ...opts,
      offline: true,
    })
    assert.match(html5, /<body>/)
  })
})
