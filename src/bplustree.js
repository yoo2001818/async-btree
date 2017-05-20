// @flow
// An implementation of PO-B+Tree.

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
    // PO-insert. Unlike B-Tree, it checks for 2n or 2n + 1 keys instead of
    // 2n - 1 or 2n keys.
    if (node.size >= this.nodeSize * 2) {
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
        // TODO PO-B+-Tree specifies that the split should be invoked
        // **whenever** a 2n or 2n + 1 key node is encountered, including leaf
        // node.
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
        if (child.keys.length >= this.nodeSize * 2) {
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
    let node = await this.readRoot();
    // No more than N keys and son of the root of one key:
    //  Other son of the root has more than n keys:
    //    Shift key without catenation
    //  No more than N keys:
    //    Merge the sons to make new root with 2n-1 - 2n+1 keys
    // N or N-1 key non-root node is encountered:
    //   Catenate with neighbor if the neighbor has n or n-1 keys
    //   If it has more than N keys, transfer keys from neighbor without
    //   catenation
    // After reaching the leaf node, remove the key from the node.
    while (node != null) {
      // First, we need to locate where the key would be, and descend while
      // performing rebalancing logic.
      let { position, exact } = node.locate(key, this.comparator);
      if (node.leaf) {
        if (!exact) return false;
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
        return true;
      } else {
        // Locate the children...
        if (exact) position += 1;
        let childNode = await this.io.read(node.children[position]);
        if (childNode.size <= this.nodeSize) {
          // Find the neighbor with more than n keys...
          let [leftNode, rightNode] = await Promise.all([
            this.io.read(node.children[position - 1]),
            this.io.read(node.children[position + 1]),
          ]);
          if (leftNode && leftNode.size > this.nodeSize) {
            // Steal two keys from the left node.
            //    +----D----+
            //  A-B-C       E
            // 1 2 3 4     5 6
            //  --->
            //    +----B----+
            //    A       C-D-E
            //   1 2     3 4 5 6
            childNode.keys.unshift(leftNode.keys.pop());
            childNode.data.unshift(leftNode.data.pop());
            childNode.size ++;
            // Since same level of nodes are always same, we can just look for
            // leftNode's validity.
            if (!leftNode.leaf) {
              let childrenAdd = leftNode.children.pop();
              if (childrenAdd != null) childNode.children.unshift(childrenAdd);
            }
            leftNode.size --;
            node.keys[position] = leftNode.keys[leftNode.size];
            node.data[position] = leftNode.data[leftNode.size];
            // Save all of them.
            await Promise.all([
              this.io.write(node.id, node),
              this.io.write(childNode.id, childNode),
              this.io.write(leftNode.id, leftNode),
            ]);
          } else if (rightNode && rightNode.size > this.nodeSize) {
            // Steal a key from right node, while overwritting root node.
            //    +----B----+
            //    A       C-D-E
            //   1 2     3 4 5 6
            //             <---
            //    +----D----+
            //   A-C       D-E
            //  1 2 3     4 5 6
            childNode.keys.push(rightNode.keys.shift());
            childNode.data.push(rightNode.data.shift());
            childNode.size ++;
            // Since same level of nodes are always same, we can just look for
            // rightNode's validity.
            if (!rightNode.leaf) {
              let childrenAdd = rightNode.children.shift();
              if (childrenAdd != null) childNode.children.push(childrenAdd);
            }
            node.keys[position] = rightNode.keys[0];
            node.data[position] = rightNode.data[0];
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
            if (!mergeLeft.leaf) {
              mergeLeft.keys.push(node.keys[position + offset]);
              mergeLeft.data.push(node.data[position + offset]);
              mergeLeft.size ++;
            }
            mergeRight.keys.forEach(v => mergeLeft.keys.push(v));
            mergeRight.data.forEach(v => mergeLeft.data.push(v));
            mergeRight.children.forEach((v, k) => {
              mergeLeft.children[mergeLeft.size + k] = v;
            });
            mergeLeft.size += mergeRight.size;
            mergeLeft.right = mergeRight.right;
            // Remove mergeRight from disk.
            node.keys.splice(position + offset, 1);
            node.data.splice(position + offset, 1);
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
      }
    }
    // This'll never happen though
    return false;
  }
  async get(key: Key): Promise<?Value> {
    // Start from the root node, locate the key by descending into the value;
    let node = await this.readRoot();
    while (node != null) {
      // Try to locate where to go.
      let { position, exact } = node.locate(key, this.comparator);
      if (node.leaf) {
        if (exact) return this.io.readData(node.data[position]);
        else return null;
      } else {
        node = await this.io.read(node.children[position + (exact ? 1 : 0)]);
      }
    }
    // Failed!
    return null;
  }
  async getNode(key: Key): Promise<?Node<Key>> {
    let node = await this.readRoot();
    while (node != null && !node.leaf) {
      // Try to locate where to go.
      let { position, exact } = node.locate(key, this.comparator);
      node = await this.io.read(node.children[position + (exact ? 1 : 0)]);
    }
    return node;
  }
  async split(node: Node<Key>, pos: number = 0): Promise<Node<Key>> {
    // Split works by slicing the children and putting the splited nodes
    // in right place.
    // A---+---B
    //   C-D-E
    // The procedure is similar to B-Tree, however, B+Tree doesn't remove
    // values from children. Instead, it copies smallest key from right child.
    // Thus it'd be splited into something like this:
    // A-+-E-+-B
    //  C-D  E
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
    // If leaf node, duplicate middle node. But non-leaf node should perform
    // exactly like B-Tree.
    let right;
    if (child.leaf) {
      right = new Node(undefined, child.size - this.nodeSize + 1,
        child.keys.slice(this.nodeSize - 1),
        child.data.slice(this.nodeSize - 1),
        child.children.slice(this.nodeSize - 1),
        child.leaf
      );
    } else {
      right = new Node(undefined, child.size - this.nodeSize,
        child.keys.slice(this.nodeSize),
        child.data.slice(this.nodeSize),
        child.children.slice(this.nodeSize),
        child.leaf
      );
    }
    // Fetch the center key.
    let center = child.keys[this.nodeSize - 1];
    let centerData = child.data[this.nodeSize - 1];
    // Resize the left node.
    child.size = this.nodeSize - 1;
    child.keys.length = this.nodeSize - 1;
    child.data.length = this.nodeSize - 1;
    child.children.length = this.nodeSize;
    // Assign the right node's ID.
    right.id = await this.io.allocate(right);
    // If the child node is leaf node, set up left / right to link each other.
    if (child.leaf) {
      right.left = child.id;
      right.right = child.right;
      child.right = right.id;
    }

    // Save the left / right node.
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
  reverseIterator(key: ?Key) {
    // Reversed version of asyncIterator.
    return (async function * () { // eslint-disable-line no-extra-parens
      // If the key is provided, scan and locate the position;
      let node;
      let locateKey = false;
      if (key != null) {
        node = await this.getNode(key);
        locateKey = true;
      } else {
        node = await this.biggestNode();
      }
      while (node != null) {
        // Unlike B-Tree traversal, B+Tree traversal doesn't need any stack.
        // Simply get the smallest node and traverse using left/right links.
        let getNext;
        if (node.left != null) {
          getNext = this.io.read(node.left);
        } else {
          getNext = Promise.resolve(null);
        }
        // Then, load all the data at once.
        let getDatas = node.data.map(v => this.io.readData(v));
        let i;
        if (locateKey && key != null) {
          i = node.locate(key, this.comparator).position;
          locateKey = false;
        } else {
          i = getDatas.length - 1;
        }
        while (i >= 0) {
          yield await getDatas[i];
          --i;
        }
        node = await getNext;
      }
    }).call(this);
  }
  // $FlowFixMe
  [Symbol.asyncIterator](key) {
    // Use IIFE to workaround the lack of class async functions.
    // However, there is no generator arrow functions, we need to workaround
    // around this object too.
    // However again, eslint's error conflicts if we try to call 'call'
    // with IIFE, so use eslint-disable-line to workaround this too.
    // Why so complicated? It's not in the spec yet.
    return (async function * () { // eslint-disable-line no-extra-parens
      let node;
      let locateKey = false;
      if (key != null) {
        node = await this.getNode(key);
        locateKey = true;
      } else {
        node = await this.smallestNode();
      }
      while (node != null) {
        // Unlike B-Tree traversal, B+Tree traversal doesn't need any stack.
        // Simply get the smallest node and traverse using left/right links.
        let getNext;
        if (node.right != null) {
          getNext = this.io.read(node.right);
        } else {
          getNext = Promise.resolve(null);
        }
        // Then, load all the data at once.
        let getDatas = node.data.map(v => this.io.readData(v));
        let i;
        if (locateKey && key != null) {
          i = node.locate(key, this.comparator).position;
          locateKey = false;
        } else {
          i = 0;
        }
        while (i < getDatas.length) {
          yield await getDatas[i];
          ++i;
        }
        node = await getNext;
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
