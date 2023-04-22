// Force Turndown to use linkedom as its DOM Parser through trickery
import {DOMParser} from 'linkedom'

if (globalThis.window) {
  globalThis.window.DOMParser = DOMParser
} else {
  globalThis.window = {
    DOMParser,
  }
}
