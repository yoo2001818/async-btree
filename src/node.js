// import indent from './util/indent';

export type Comparator<Key> = (a: Key, b: Key) => number;

// Although it's not necessary at all - it reduces some overhead since it
// doesn't have to store length information.
export class LocateResult {
  position: number;
  exact: boolean;
  constructor(position, exact) {
    // Again, we're using | and !! to make the JIT compiler aware of its types.
    this.position = position | 0;
    this.exact = !!exact;
  }
}

export default class Node<Key> {
  size: number;
  keys: Key[];
  data: any[];
  // Childrens usually store filesystem's key - however - direct values can
  // be stored too. IOInterface should handle this then.
  children: any[];
  leaf: boolean;
  constructor(size, keys, data, children, leaf) {
    this.size = size;
    this.keys = keys;
    this.data = data;
    this.children = children;
    this.leaf = leaf;
  }
  locate(key: Key, comparator: Comparator): [number, boolean] {
    let high = this.keys.length - 1;
    let low = 0;
    do {
      let mid = (high + low) >> 1;
      let compared = comparator(this.keys[mid], key);
      if (compared === 0) {
        return new LocateResult(mid, true);
      } else if (compared < 0) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    } while (high >= low);
    return new LocateResult(low, false);
  }
}

/*
export default class Node {
  keys: any[];
  children: Node[];
  constructor(keys = [], children = []) {
    this.keys = keys;
    this.children = children;
  }
  static fromArray(array: Array,
    comparator: (a: any, b: any) => number, size: number = 2
  ): Node {
    // Builds a tree from the array.
    let rootNode = new Node();
    array.forEach(v => {
      rootNode = rootNode.insert(v, comparator, size, true);
    });
    return rootNode;
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
  isLeaf(): boolean {
    return this.children.length === 0;
  }
  // Locate the position of certain value. This returns the position that
  // (should) contain the node, and whether if the exact match was found.
  locate(key: any, comparator: (a: any, b: any) => number
  ): void | [number, boolean] {
    // Since ES6 supports tail call optimization, it's designed to use TCO,
    // however, since B-tree's depth is not that deep, so it won't matter
    // at all.
    let high = this.keys.length - 1;
    let low = 0;
    do {
      let mid = (high + low) >> 1;
      let compared = comparator(this.keys[mid], key);
      if (compared === 0) {
        return [mid, true];
      } else if (compared < 0) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    } while (high >= low);
    return [low, false];
  }
  // Search and return the position and the containing node, recursively.
  searchNode(key: any, comparator: (a: any, b: any) => number
  ): void | [Node, number] {
    let [position, exact] = this.locate(key, comparator);
    if (exact) return [this, position];
    let child = this.children[position];
    if (child) return child.searchNode(key, comparator);
    else return null;
  }
  search(key: any, comparator: (a: any, b: any) => number): any {
    let output = this.searchNode(key, comparator);
    if (output == null) return null;
    let [node, pos] = output;
    return node.keys[pos];
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
  size(): Number {
    // Returns the total size of the tree. This operation is expensive -
    // it has to iterate all the array O(n). TODO Perhaps we could do caching?
    return this.children.reduce((prev, current) => prev + current.size(), 0) +
      this.keys.length;
  }
  height(level: number = 1): Number {
    // Returns the max height of the tree. This operation is expensive -
    // but it'd be for debugging purposes, so it won't be used anyway.
    return this.children.reduce((prev, current) =>
      Math.max(prev, current.height(level + 1)), level);
  }
  smallestNode(): Node {
    // Returns smallest node of the tree.
    let smallestChild = this.children[0];
    if (smallestChild) return smallestChild.smallestNode();
    return this;
  }
  smallest(): any {
    let node = this.smallestNode();
    return node.keys[0];
  }
  biggestNode(): Node {
    // Returns the position of biggest node of the tree.
    let biggestChild = this.children[this.keys.length];
    if (biggestChild) return biggestChild.biggestNode();
    return this;
  }
  biggest(): any {
    let node = this.biggestNode();
    return node.keys[node.keys.length - 1];
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
  ): Node {
    if (isRoot && this.keys.length === size * 2 - 1) {
      // Create new node, then separate it.
      let newRoot = new Node([], [this]);
      newRoot.split(0, size);
      newRoot.insert(key, comparator, size);
      return newRoot;
    }
    if (this.isLeaf()) {
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
      let [i] = this.locate(key, comparator);
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
  remove(key: any, comparator: (a: any, b: any) => number, size: number = 2,
  rootNode: Node = this): void | Node {
    // We could remove the key and rebalance the tree, but that'd be expensive.
    // Instead, there's a single pass algorithm for removing an entry from the
    // tree. Some databases like PostgreSQL instead marks the entry 'deleted'
    // and vacuum the database frequently, but, since this doesn't use any
    // disk access at all, that isn't required.

    // First, we need to locate where the key would be, and descend while
    // performing rebalancing logic.
    let [position, exact] = this.locate(key, comparator);
    if (!exact) {
      // Descending node requires at least `size` keys, so if descending
      // node doesn't have it - we have to make it have `size` keys by
      // merging two nodes, etc.
      let childNode = this.children[position];
      if (childNode.keys.length < size) {
        let leftNode = this.children[position - 1];
        let rightNode = this.children[position + 1];
        // Search for sibling node with at least `size` keys, and steal
        // a key from that node.
        if (leftNode && leftNode.keys.length >= size) {
          // Steal a key from left node.
          childNode.keys.unshift(this.keys[position]);
          let childrenAdd = leftNode.children.pop();
          if (childrenAdd) childNode.children.unshift(childrenAdd);
          this.keys[position] = leftNode.keys.pop();
        } else if (rightNode && rightNode.keys.length >= size) {
          // Steal a key from right node.
          childNode.keys.push(this.keys[position]);
          let childrenAdd = rightNode.children.shift();
          if (childrenAdd) childNode.children.push(childrenAdd);
          this.keys[position] = rightNode.keys.shift();
        } else {
          // If both sibling nodes don't have insufficient keys, merge the
          // child node with one of the sibling node.
          let mergeLeft, mergeRight, offset, siblingOffset;
          if (leftNode) {
            mergeLeft = leftNode;
            mergeRight = childNode;
            offset = -1;
            siblingOffset = 0;
          } else if (rightNode) {
            mergeLeft = childNode;
            mergeRight = rightNode;
            offset = 0;
            siblingOffset = 1;
          } else {
            throw new Error('There is no left / right node while removing.');
          }
          let leftSize = mergeLeft.keys.length;
          mergeLeft.keys.push(this.keys[position + offset]);
          mergeRight.keys.forEach(v => mergeLeft.keys.push(v));
          mergeRight.children.forEach((v, k) => {
            mergeLeft.children[leftSize + k + 1] = v;
          });
          this.keys.splice(position + offset, 1);
          this.children.splice(position + siblingOffset, 1);
          // If no key is left in current node, it means that root node
          // is now obsolete; shift the root node.
          let newRoot = rootNode;
          if (this.keys.length === 0) newRoot = mergeLeft;
          return mergeLeft.remove(key, comparator, size, newRoot);
        }
      }
      return childNode.remove(key, comparator, size, rootNode);
    }
    if (this.isLeaf()) {
      // If the node is leaf node, we can simply remove the key from the node,
      // the end.
      this.keys.splice(position, 1);
    } else {
      // Otherwise, it's a little complicated...
      // Search for sibling node with at least `size` keys, and steal
      // 'most closest to the key value' key in the node.
      // If both sibling nodes don't have insufficient keys, merge sibling nodes
      // to one, while deleteing the key in the process.
      let leftNode = this.children[position - 1];
      let rightNode = this.children[position];
      if (leftNode && leftNode.keys.length >= size) {
        // Steal biggest node in the left node.
        let biggestNode = leftNode.biggestNode();
        let biggest = biggestNode.keys.pop();
        this.keys[position] = biggest;
      } else if (rightNode && rightNode.keys.length >= size) {
        // Steal smallest node in the right node.
        let smallestNode = rightNode.smallestNode();
        let smallest = smallestNode.keys.shift();
        this.keys[position] = smallest;
      } else if (leftNode && rightNode) {
        // Merge left and right node.
        let leftSize = leftNode.keys.length;
        rightNode.keys.forEach(v => leftNode.keys.push(v));
        rightNode.children.forEach((v, k) => {
          leftNode.children[leftSize + k + 1] = v;
        });
        this.keys.splice(position, 1);
        this.children.splice(position, 1);
      } else {
        throw new Error('Left and right node is missing while removing');
      }
    }
    return rootNode;
  }
}
*/
