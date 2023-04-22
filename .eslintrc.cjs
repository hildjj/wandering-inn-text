'use strict'

module.exports = {
  root: true,
  extends: ['@cto.af/eslint-config/modules'],
  ignorePatterns: [
    'node_modules/',
  ],
  env: {
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 13,
  },
}
