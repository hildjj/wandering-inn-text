import './force.js'
import {describe, it} from 'node:test'
import {HtmlToMarkdown} from '../lib/html.js'
import assert from 'node:assert/strict'

const hm = new HtmlToMarkdown()
const hms = new HtmlToMarkdown({style: true})

function md(strings, ...values) {
  return hm.md(String.raw({raw: strings}, ...values))
}

function mds(strings, ...values) {
  return hms.md(String.raw({raw: strings}, ...values))
}

describe('htmlToMarkdown', () => {
  it('comment', () => {
    // I wanted to preserve comments but there's no good way in Turndown.
    // See: https://github.com/mixmark-io/turndown/issues/234
    assert.equal(md`<!--foo-->`, '')
  })
  it('ul', () => {
    // Checking bulletListMarker
    // three spaces is overkill, but whatever
    assert.equal(md`<ul><li>one</li><li>two</li></ul>`, '-   one\n-   two')
  })
  it('hr', () => {
    assert.equal(md`<hr>`, '---')
  })
  it('code', () => {
    // Check codeBlockStyle and fence.
    assert.equal(
      md`<pre><code>let foo = "&amp;";\nfoo += "amp;";\n</code></pre>`,
      '```\nlet foo = "&";\nfoo += "amp;";\n```'
    )
  })
  it('em', () => {
    assert.equal(md`<em>foo</em>`, '*foo*')
    assert.equal(md`<i>foo</i>`, '*foo*')
  })
  it('headings', () => {
    assert.equal(md`<h1>foo</h1>`, '# foo')
    assert.equal(md`<h2>foo</h2>`, '## foo')
    assert.equal(md`<h3>foo</h3>`, '### foo')
  })
  it('remove', () => {
    assert.equal(md`<audio>foo</audio>`, '')
    assert.equal(md`<iframe>foo</iframe>`, '')
    assert.equal(md`<script>foo</script>`, '')
    assert.equal(md`<style>foo</style>`, '')
  })
  it('u', () => {
    assert.equal(md`<u>foo bar\tbaz</u>`, '_foo_bar_baz_')
  })
  it('sub', () => {
    assert.equal(md`<sub>foo</sub>`, '~foo~')
  })
  it('sup', () => {
    assert.equal(md`<sup>foo</sup>`, '^foo^')
  })
  it('chapters', () => {
    assert.equal(md`<a href="bar">Next Chapter</a>`, '')
    assert.equal(md`<a href="bar">Previous   \t Chapter</a>`, '')
    assert.equal(md`<span style="float: right;">Next Chapter</span>`, '')
    assert.equal(mds`<span style="float: right;">Next Chapter</span>`, '')
  })
  it('style', () => {
    assert.equal(mds`<span style='color:green'>Unique</span>`, '{{{color:green}}}\nUnique')
    assert.equal(mds`<p style='color:green'>Unique</p>`, '{{{color:green}}}\nUnique')
    assert.equal(mds`<div style='color:green' class='boo'>Unique</div>`, '{{{color:green boo}}}\nUnique')
  })
})
