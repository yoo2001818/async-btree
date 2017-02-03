import indent from './util/indent';

export default class Node {
  keys: any[];
  children: Node[];
  constructor(keys = [], children = []) {
    this.keys = keys;
    this.children = children;
  }
  inspect(depth = 0): String {
    let output = '';
    let i;
    let written = false;
    for (i = 0; i < this.keys.length; ++i) {
      if (this.children[i] != null) {
        if (!written) written = true;
        else output += '\n';
        output += this.children[i].inspect(depth + 1);
      }
      if (!written) written = true;
      else output += '\n';
      output += indent(depth + 1, '- ');
      output += this.keys[i];
    }
    if (this.children[i] != null) {
      if (!written) written = true;
      else output += '\n';
      output += this.children[i].inspect(depth + 1);
    }
    return output;
  }
  split(pos: Number = 0, size: Number = 2): Node {
    // Split works by slicing the children and putting the splited nodes
    // in right place.
    // A---+---B
    //   C-D-E
    // We slice the node to left / center / right nodes, then insert the center
    // value to parent and insert left / right node next to it.
    // In leftious image, left'll be 'C', center'll be 'D', right'll be 'E'.
    // Thus it'd be splited into something like this:
    // A-+-D-+-B
    //   C   E
    let child = this.children[pos];

    // Push parent's keys / children to right to make a space to insert the
    // nodes.
    for (let i = this.children.length; i > pos + 1; --i) {
      this.children[i] = this.children[i - 1];
    }
    for (let i = this.keys.length; i > pos; --i) {
      this.keys[i] = this.keys[i - 1];
    }
    console.log(this);

    // Create right node, by copying data from the child.
    let right = new Node(child.keys.slice(size),
      child.children.slice(size + 1));
    // Create left node. This could be done using mutation, too.
    let left = new Node(child.keys.slice(0, size - 1),
      child.children.slice(0, size));
    // Fetch the center key...
    let center = child.keys[size - 1];

    // And put them into the parent.
    this.children[pos] = left;
    this.children[pos + 1] = right;
    this.keys[pos] = center;

    console.log(this);
    return this;
  }
}
