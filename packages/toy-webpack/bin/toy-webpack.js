#!/usr/bin/env node

const run = require('../lib/index');
const [, , ...args] = process.argv;

run(...args);
