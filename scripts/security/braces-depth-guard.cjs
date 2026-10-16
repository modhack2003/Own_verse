'use strict';

// GHSA-vfj7-8cjw-p6xm: bound recursive walkers, including caller-supplied ASTs.
// Only child nodes are followed; parser parent/prev links are intentionally ignored.
module.exports = function assertDepth(ast) {
  const pending = [[ast, 0]];
  const seen = new WeakSet();
  let count = 0;
  while (pending.length) {
    const [node, depth] = pending.pop();
    if (!node || typeof node !== 'object') throw new TypeError('Invalid braces AST');
    if (depth > 100 || ++count > 20000 || seen.has(node)) {
      throw new SyntaxError('Brace pattern exceeds safe nesting or AST size');
    }
    seen.add(node);
    if (Array.isArray(node.nodes)) {
      if (node.nodes.length > 20000 - count) throw new SyntaxError('Brace AST exceeds safe size');
      for (const child of node.nodes) pending.push([child, depth + 1]);
    }
  }
};
