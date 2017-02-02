import indent from './util/indent';

export default class Node {
  constructor(keys, children, leaf) {
    this.keys = keys;
    this.children = children;
    this.leaf = leaf;
  }
  inspect(depth = 0) {
    let output = '';
    let i;
    for (i = 0; i < this.keys.length; ++i) {
      if (this.children[i] != null) {
        output += this.children[i].inspect(depth + 1);
      }
      output += indent(depth);
      output += '- ';
      output += this.keys[i];
    }
    if (this.children[i] != null) {
      output += this.children[i].inspect(depth + 1);
    }
    return output;
  }
}
