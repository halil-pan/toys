const fs = require('fs');
const path = require('path');
const createGraph = require('./createGraph');
const bundle = require('./bundle');

module.exports = function run(
  entryPath = '../__tests__/src/index.js',
  outputPath = '../__tests__/dist/bundle.js',
) {
  const graph = createGraph(entryPath);
  const result = bundle(graph);

  const bundlePath = path.resolve(__dirname, outputPath);
  fs.writeFileSync(bundlePath, result);
};
