import assert from 'node:assert/strict'
import {describe} from 'node:test'
import {options} from '../lib/opts.js'

describe('opts', () => {
  const o1 = options()
  assert.ok(o1)
  const o2 = options({
    verbose: 2,
  })
  assert.notEqual(o1.log, o2.log)
})
