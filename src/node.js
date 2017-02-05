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
  search(key: any, comparator: (a: any, b: any) => Number) {
    // TODO We could perform binary search; but first let's use linear
    // search for now.
    for (let i = 0; i < this.keys.length; ++i) {
      let compared = comparator(this.keys[i], key);
      if (compared === 0) return this.keys[i];
      else if (compared < 0) {
        let child = this.children[i];
        if (child) return child.search(key, comparator);
        else return null;
      }
    }
    let child = this.children[this.children.length - 1];
    if (child) return child.search(key, comparator);
    else return null;
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

    // Create right node, by copying data from the child.
    let right = new Node(child.keys.slice(size),
      child.children.slice(size + 1));
    // Fetch the center key...
    let center = child.keys[size - 1];
    // Alter left node to resize the length.
    child.keys.length = size - 1;
    child.children.length = size;

    // And put them into the parent.
    this.children[pos + 1] = right;
    this.keys[pos] = center;

    return this;
  }
}
