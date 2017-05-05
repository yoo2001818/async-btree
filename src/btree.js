// @flow
// A asynchronous B-Tree implementation.
import Node from './node';
import type { Tree, IOInterface } from './type';

export default class BTree<Key, Value> implements Tree<Key, Value> {
  nodeSize: number;
  comparator: (a: Key, b: Key) => number;
  root: Node<Key>;
  io: IOInterface<Key, Value>;

  constructor(io: IOInterface<Key, Value>, nodeSize: number,
    comparator: (a: Key, b: Key) => number
  ) {
    this.io = io;
    this.nodeSize = nodeSize;
    this.comparator = comparator;
  }
  readRoot(): Promise<?Node<Key>> {
    return this.io.getRoot().then(id => {
      if (id == null) return null;
      // We're not using async function to use TCO?
      return this.io.read(id);
    });
  }
  async insert(key: Key, data: Value): Promise<Tree<Key, Value>> {
    let node = await this.readRoot();
    if (node == null) {
      // Create root node. If this is the case, just put data into the root
      // node and we're done.
      node = new Node(undefined, 1, [key], [0], [], true);
      node.id = await this.io.allocate(node);
      let dataId = await this.io.allocateData(data);
      node.data[0] = await this.io.writeData(dataId, data);
      await this.io.write(node.id, node);
      await this.io.writeRoot(node.id);
      return this;
    }
    if (node.size >= this.nodeSize * 2 - 1) {
      // Create new root node then separate it.
      let newRoot = new Node(undefined, 0, [], [], [node.id], false);
      newRoot.id = await this.io.allocate(newRoot);
      await this.split(newRoot, 0);
      await this.io.writeRoot(newRoot.id);
      node = newRoot;
    }
    while (node != null) {
      if (node.leaf) {
        // If leaf node, put the key in the right place, while pushing the other
        // ones.
        let i;
        for (i = node.size;
          i >= 1 && this.comparator(node.keys[i - 1], key) > 0; --i
        ) {
          node.keys[i] = node.keys[i - 1];
          node.data[i] = node.data[i - 1];
        }
        node.keys[i] = key;
        let dataId = await this.io.allocateData(data);
        node.data[i] = await this.io.writeData(dataId, data);
        node.size ++;
        await this.io.write(node.id, node);
        // We're done here.
        return this;
      } else {
        // If middle node, Find right offset and insert to there.
        let result = node.locate(key, this.comparator);
        if (result.exact) throw new Error('Duplicate key');
        let pos = result.position;
        let child = await this.io.read(node.children[pos]);
        if (child.keys.length === this.nodeSize * 2 - 1) {
          await this.split(node, pos);
          if (this.comparator(node.keys[pos], key) < 0) {
            child = await this.io.read(node.children[pos + 1]);
          }
        }
        // Go to below node and continue...
        node = child;
      }
    }
    return this;
  }
  async remove(key: Key): Promise<boolean> {
    // Start from the root node, remove entries to match B-Tree criteria.
    let node = await this.readRoot();
    while (node != null) {
      // First, we need to locate where the key would be, and descend while
      // performing rebalancing logic.
      let { position, exact } = node.locate(key, this.comparator);
      if (!exact) {
        // Descending node requires at least `nodeSize` keys, so if descending
        // node doesn't have it - we have to make it have `nodeSize` keys by
        // merging two nodes.
        // Fail if the node is leaf node.
        if (node.leaf) return false;
        let childNode = await this.io.read(node.children[position]);
        if (childNode.size < this.nodeSize) {
          let [leftNode, rightNode] = await Promise.all([
            this.io.read(node.children[position - 1]),
            this.io.read(node.children[position + 1]),
          ]);
          // Search for sibling node with at least `nodeSize` keys, and steal
          // a key from that node.
          if (leftNode && leftNode.size >= this.nodeSize) {
            // Steal a key from left node.
            //   +----C----+
            // A-+-B     D-+-E
            // --->
            //   +----B----+
            //   A       C-D-E
            childNode.keys.unshift(node.keys[position]);
            childNode.data.unshift(node.data[position]);
            childNode.size ++;
            // Since same level of nodes are always same, we can just look for
            // leftNode's validity.
            if (!leftNode.leaf) {
              let childrenAdd = leftNode.children.pop();
              if (childrenAdd != null) childNode.children.unshift(childrenAdd);
            }
            node.keys[position] = leftNode.keys.pop();
            node.data[position] = leftNode.data.pop();
            leftNode.size --;
            // Save all of them.
            await Promise.all([
              this.io.write(node.id, node),
              this.io.write(childNode.id, childNode),
              this.io.write(leftNode.id, leftNode),
            ]);
          } else if (rightNode && rightNode.size >= this.nodeSize) {
            // Steal a key from right node.
            //   +----C----+
            // A-+-B     D-+-E
            // --->
            //   +----D----+
            // A-B-C       E
            childNode.keys.push(node.keys[position]);
            childNode.data.push(node.data[position]);
            childNode.size ++;
            // Since same level of nodes are always same, we can just look for
            // leftNode's validity.
            if (!rightNode.leaf) {
              let childrenAdd = rightNode.children.shift();
              if (childrenAdd != null) childNode.children.push(childrenAdd);
            }
            node.keys[position] = rightNode.keys.shift();
            node.data[position] = rightNode.data.shift();
            rightNode.size --;
            // Save all of them.
            await Promise.all([
              this.io.write(node.id, node),
              this.io.write(childNode.id, childNode),
              this.io.write(rightNode.id, rightNode),
            ]);
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
            mergeLeft.keys.push(node.keys[position + offset]);
            mergeLeft.data.push(node.data[position + offset]);
            mergeRight.keys.forEach(v => mergeLeft.keys.push(v));
            mergeRight.data.forEach(v => mergeLeft.data.push(v));
            mergeRight.children.forEach((v, k) => {
              mergeLeft.children[mergeLeft.size + k + 1] = v;
            });
            mergeLeft.size += mergeRight.size + 1;
            // Remove mergeRight from disk.
            node.keys.splice(position + offset, 1);
            node.children.splice(position + siblingOffset, 1);
            node.size --;
            // If no key is left in current node, it means that root node
            // is now obsolete; shift the root node.
            if (node.keys.length === 0) {
              await Promise.all([
                this.io.remove(node.id),
                this.io.writeRoot(mergeLeft.id),
                this.io.write(mergeLeft.id, mergeLeft),
                this.io.remove(mergeRight.id),
              ]);
            } else {
              await Promise.all([
                this.io.write(node.id, node),
                this.io.write(mergeLeft.id, mergeLeft),
                this.io.remove(mergeRight.id),
              ]);
            }
            node = mergeLeft;
            continue;
          }
        }
        node = childNode;
        continue;
      } else {
        // Exact match was found
        if (node.leaf) {
          // If this is a leaf node, we can safely remove it from the keys.
          // The end.
          let dataId = node.data[position];
          node.keys.splice(position, 1);
          node.data.splice(position, 1);
          node.size --;
          await Promise.all([
            this.io.write(node.id, node),
            this.io.removeData(dataId),
          ]);
        } else {
          // Otherwise, it's a little complicated...
          // Search for sibling node with at least `size` keys, and steal
          // 'most closest to the key value' key in the node.
          // If both sibling nodes don't have insufficient keys, merge sibling
          // nodes to one, while deleteing the key in the process.
          let [leftNode, rightNode] = await Promise.all([
            this.io.read(node.children[position - 1]),
            this.io.read(node.children[position]),
          ]);
          if (leftNode != null && leftNode.size >= this.nodeSize) {
            // Steal biggest node in the left node.
            let biggestNode = await this.biggestNode(leftNode);
            if (biggestNode == null) {
              throw new Error('There is no biggest node available; this is' +
                ' not supposed to happen');
            }
            let biggest = biggestNode.keys.pop();
            let biggestData = biggestNode.data.pop();
            let dataId = node.data[position];
            biggestNode.size --;
            node.keys[position] = biggest;
            node.data[position] = biggestData;
            await Promise.all([
              this.io.write(biggestNode.id, biggestNode),
              this.io.write(node.id, node),
              this.io.removeData(dataId),
            ]);
          } else if (rightNode != null && rightNode.size >= this.nodeSize) {
            // Steal smallest node in the right node.
            let smallestNode = await this.smallestNode(rightNode);
            if (smallestNode == null) {
              throw new Error('There is no smallest node available; this is' +
                ' not supposed to happen');
            }
            let smallest = smallestNode.keys.shift();
            let smallestData = smallestNode.data.shift();
            let dataId = node.data[position];
            smallestNode.size --;
            node.keys[position] = smallest;
            node.data[position] = smallestData;
            await Promise.all([
              this.io.write(smallestNode.id, smallestNode),
              this.io.write(node.id, node),
              this.io.removeData(dataId),
            ]);
          } else if (leftNode != null && rightNode != null) {
            // Merge left and right node.
            rightNode.keys.forEach(v => leftNode.keys.push(v));
            rightNode.data.forEach(v => leftNode.data.push(v));
            rightNode.children.forEach((v, k) => {
              leftNode.children[leftNode.size + k + 1] = v;
            });
            leftNode.size += rightNode.keys.length;
            let dataId = node.data[position];
            node.keys.splice(position, 1);
            node.data.splice(position, 1);
            node.children.splice(position, 1);
            node.size --;
            // Save to disk, while removing right node.
            await Promise.all([
              this.io.write(node.id, node),
              this.io.write(leftNode.id, leftNode),
              this.io.remove(rightNode.id),
              this.io.removeData(dataId),
            ]);
          } else {
            throw new Error('Left and right node is missing while removing');
          }
        }
        return true;
      }
    }
    return false;
  }
  async get(key: Key): Promise<?Value> {
    // Start from the root node, locate the key by descending into the value;
    let node = await this.readRoot();
    while (node != null) {
      // Try to locate where to go.
      let { position, exact } = node.locate(key, this.comparator);
      if (exact) return this.io.readData(node.data[position]);
      // If not matched, go down to right child
      // But this fails in leaf node, so just mark it as a failure
      if (node.leaf) return null;
      node = await this.io.read(node.children[position]);
    }
    // Failed!
    return null;
  }
  async split(node: Node<Key>, pos: number = 0): Promise<Node<Key>> {
    // Split works by slicing the children and putting the splited nodes
    // in right place.
    // A---+---B
    //   C-D-E
    // We slice the node to left / center / right nodes, then insert the center
    // value to parent and insert left / right node next to it.
    // In above image, left'll be 'C', center'll be 'D', right'll be 'E'.
    // Thus it'd be splited into something like this:
    // A-+-D-+-B
    //   C   E
    let child = await this.io.read(node.children[pos]);

    // Push parent's keys / children to right to make a space to insert the
    // nodes.
    for (let i = node.size + 1; i > pos + 1; --i) {
      node.children[i] = node.children[i - 1];
    }
    for (let i = node.size; i > pos; --i) {
      node.keys[i] = node.keys[i - 1];
      node.data[i] = node.data[i - 1];
    }

    // Create right node by slicing the data from the child.
    let right = new Node(undefined, child.size - this.nodeSize,
      child.keys.slice(this.nodeSize),
      child.data.slice(this.nodeSize),
      child.children.slice(this.nodeSize),
      child.leaf
    );
    // Fetch the center key.
    let center = child.keys[this.nodeSize - 1];
    let centerData = child.data[this.nodeSize - 1];
    // Resize the left node.
    child.size = this.nodeSize - 1;
    child.keys.length = this.nodeSize - 1;
    child.data.length = this.nodeSize - 1;
    child.children.length = this.nodeSize;

    // Save the left / right node.
    right.id = await this.io.allocate(right);
    node.children[pos + 1] = right.id;
    node.keys[pos] = center;
    node.data[pos] = centerData;
    node.size = node.size + 1;
    node.leaf = false;
    await Promise.all([
      this.io.write(right.id, right),
      this.io.write(child.id, child),
      this.io.write(node.id, node),
    ]);
    return node;
  }
  async smallestNode(topNode: ?Node<Key>): Promise<?Node<Key>> {
    // Just navigate to smallest node, easy!
    let node = topNode || await this.readRoot();
    while (node != null && !node.leaf) {
      node = await this.io.read(node.children[0]);
    }
    return node;
  }
  async biggestNode(topNode: ?Node<Key>): Promise<?Node<Key>> {
    // Just navigate to biggest node, easy!
    let node = topNode || await this.readRoot();
    while (node != null && !node.leaf) {
      node = await this.io.read(node.children[node.size]);
    }
    return node;
  }
  async smallest(topNode: ?Node<Key>): Promise<?Key> {
    let node = await this.smallestNode(topNode);
    if (node == null) return null;
    return node.keys[0];
  }
  async biggest(topNode: ?Node<Key>): Promise<?Key> {
    let node = await this.biggestNode(topNode);
    if (node == null) return null;
    return node.keys[node.size - 1];
  }
  reverseIterator() {
    // Reverse version of asyncIterator.
    let iter = (async function * () { // eslint-disable-line no-extra-parens
      // This can be greatly simplified in B+Tree, however, this is just a
      // regular B-Tree, so let's just use a stack.
      let rootNode = await this.readRoot();
      if (rootNode == null) return;
      let stack = [[rootNode, rootNode.size]];
      while (stack.length > 0) {
        let stackEntry = stack[stack.length - 1];
        let node = stackEntry[0];
        let pos = stackEntry[1] --;
        if (pos !== node.size) yield await this.io.readData(node.data[pos]);
        // Step into descending node...
        if (!node.leaf && node.children[pos] != null) {
          if (pos === 0) {
            // Do TCO if this node is last children of the node
            let newNode = await this.io.read(node.children[pos]);
            stack[stack.length - 1] = [newNode, newNode.size];
          } else {
            // Otherwise, just push.
            let newNode = await this.io.read(node.children[pos]);
            stack.push([newNode, newNode.size]);
          }
        } else if (pos === 0) {
          // Escape if finished.
          stack.pop();
        }
      }
    }).call(this);
    return iter;
  }
  // $FlowFixMe
  [Symbol.asyncIterator]() {
    // Use IIFE to workaround the lack of class async functions.
    // However, there is no generator arrow functions, we need to workaround
    // around this object too.
    // However again, eslint's error conflicts if we try to call 'call'
    // with IIFE, so use eslint-disable-line to workaround this too.
    // Why so complicated? It's not in the spec yet.
    return (async function * () { // eslint-disable-line no-extra-parens
      // This can be greatly simplified in B+Tree, however, this is just a
      // regular B-Tree, so let's just use a stack.
      let rootNode = await this.readRoot();
      if (rootNode == null) return;
      let stack = [[rootNode, 0]];
      while (stack.length > 0) {
        let stackEntry = stack[stack.length - 1];
        let node = stackEntry[0];
        let pos = stackEntry[1] ++;
        if (pos !== 0) yield await this.io.readData(node.data[pos - 1]);
        // Step into descending node...
        if (!node.leaf && node.children[pos] != null) {
          if (pos >= node.size) {
            // Do TCO if this node is last children of the node
            stack[stack.length - 1] = [
              await this.io.read(node.children[pos]),
              0,
            ];
          } else {
            // Otherwise, just push.
            stack.push([
              await this.io.read(node.children[pos]),
              0,
            ]);
          }
        } else if (pos >= node.size) {
          // Escape if finished.
          stack.pop();
        }
      }
    }).call(this);
  }
  async traverse(callback: Function): Promise<void> {
    // For await loops doesn't work well for now - just call iterator directly.
    // $FlowFixMe
    const iterator = this[Symbol.asyncIterator]();
    while (true) {
      const { value, done } = await iterator.next();
      if (done) break;
      callback(value);
    }
  }
}
