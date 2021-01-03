const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');

let id = 0;

function createAsset(filename) {
  const content = fs.readFileSync(filename, 'utf-8');
  const ast = parser.parse(content, {
    sourceType: 'module',
  });
  const dependencies = [];

  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value);
    },
  });

  const { code } = babel.transformFromAstSync(ast, null, {
    presets: ['@babel/preset-env'],
  });

  return {
    id: id++,
    filename,
    code,
    dependencies,
  };
}

module.exports = createAsset;
