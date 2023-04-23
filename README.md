# Wandering Inn Text

Download all of the text to date from
[The Wandering Inn](https://wanderinginn.com/).
Chapters are downloaded as HTML and translated locally to Markdown.

## Installation

Ensure you have [Node.js](https://nodejs.org/) locally, then:

```sh
npm install -g wandering-inn-text
```

## Usage

Create a directory to hold all of the output:

```sh
mkdir WanderingInn
cd WanderingInn
```

From that directory, run `wit`:

```sh
wit
```

This will create `html/` and `text/` directories, containing one directory per
chapter.

## Command Line options

```txt
Usage: wit [options]

Options:
  -f, --force             Force processing. May be specified multiple times.
                          First time forces .md file generation.
  --html-dir <directory>  Directory in which to save HTML (default: ./html,
                          env: WIT_HTML)
  --text-dir <directory>  Directory in which to save markdown (default: ./text,
                          env: WIT_TEXT)
  -O, --offline           Do not try to update existing docs
  -s, --style             Inline style information with {{{style}}}
  -t, --timeout <ms>      Pause between fetches, in milliseconds (default:
                          1000)
  -v, --verbose           Enable verbose logging
  -h, --help              display help for command
```

## Styles

Pirateaba often uses HTML styles to convey information about the text.  In
order to not miss those clues, style information (including inline styles and
class names) can be inserted into the output using the `--style` command line
option.  Markdown doesn't have a good way of showing this information, so the syntax that was used is to wrap it in `{{{ }}}`. For example:

```md
{{{color:#99ccff}}}
[Some Fancy Thing Happened]
```

---
[![Tests](https://github.com/hildjj/wandering-inn-text/actions/workflows/node.js.yml/badge.svg)](https://github.com/hildjj/wandering-inn-text/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/hildjj/wandering-inn-text/branch/main/graph/badge.svg?token=D558VKJMU1)](https://codecov.io/gh/hildjj/wandering-inn-text)
