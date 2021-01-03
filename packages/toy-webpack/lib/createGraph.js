const path = require('path');
const createAsset = require('./createAsset.js');

function createGraph(entry) {
  const mainAsset = createAsset(path.resolve(__dirname, entry));
  const queue = [mainAsset];

  for (const asset of queue) {
    const dirname = path.dirname(asset.filename);

    asset.mapping = {};
    asset.dependencies.forEach((relativePath) => {
      const absolutePath = path.join(dirname, relativePath);
      const child = createAsset(absolutePath);

      asset.mapping[relativePath] = child.id;
      queue.push(child);
    });
  }

  return queue;
}

module.exports = createGraph;
