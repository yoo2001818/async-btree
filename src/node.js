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
  search(key: any, comparator: (a: any, b: any) => number) {
    // Since ES6 supports tail call optimization, it's designed to use TCO,
    // however, since B-tree's depth is not that deep, so it won't matter
    // at all.
    let high = this.keys.length - 1;
    let low = 0;
    do {
      let mid = (high + low) >> 1;
      let compared = comparator(this.keys[mid], key);
      if (compared === 0) {
        return this.keys[mid];
      } else if (compared < 0) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    } while (high >= low);
    let child = this.children[low];
    if (child) return child.search(key, comparator);
    else return null;
  }
  traverse(callback: Function) {
    let i;
    for (i = 0; i < this.keys.length; ++i) {
      if (this.children[i] != null) this.children[i].traverse(callback);
      callback(this.keys[i]);
    }
    if (this.children[i] != null) this.children[i].traverse(callback);
  }
  *[Symbol.iterator]() {
    let i;
    for (i = 0; i < this.keys.length; ++i) {
      if (this.children[i] != null) yield * this.children[i];
      yield this.keys[i];
    }
    if (this.children[i] != null) yield * this.children[i];
  }
  split(pos: number = 0, size: number = 2): Node {
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
      child.children.slice(size));
    // Fetch the center key...
    let center = child.keys[size - 1];
    // Alter left node to resize the length.
    child.keys.length = size - 1;
    child.children.length = child.children.length && size;

    // And put them into the parent.
    this.children[pos + 1] = right;
    this.keys[pos] = center;

    return this;
  }
  insert(key: any, comparator: (a: any, b: any) => number, size: number = 2,
    isRoot: boolean = false
  ): void | Node {
    if (isRoot && this.keys.length === size * 2 - 1) {
      // Create new node, then separate it.
      let newRoot = new Node([], [this]);
      newRoot.split(0, size);
      newRoot.insert(key, comparator, size);
      return newRoot;
    }
    // console.log(this);
    if (this.children.length === 0) {
      // If leaf node, put the key in the right place, while pushing the other
      // ones.
      let i;
      for (i = this.keys.length;
        i >= 1 && comparator(this.keys[i - 1], key) > 0; --i
      ) {
        this.keys[i] = this.keys[i - 1];
      }
      this.keys[i] = key;
      // We're done here.
      return this;
    } else {
      // If middle node, Find right offset and insert to there.
      // TODO It could do binary search in here too, but we'll change that
      // later.
      let i;
      for (i = this.keys.length;
        i >= 1 && comparator(this.keys[i - 1], key) > 0; --i
      );
      let child = this.children[i];
      if (child.keys.length === size * 2 - 1) {
        this.split(i, size);
        if (comparator(this.keys[i], key) < 0) child = this.children[i + 1];
      }
      if (!isRoot) return child.insert(key, comparator, size);
      child.insert(key, comparator, size);
      return this;
    }
  }
}
