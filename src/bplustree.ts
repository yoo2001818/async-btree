// An implementation of PO-B+Tree.

import BTree from './btree';
import Node, { locateNode, LocateResult } from './node';
import { Tree } from './type';

export default class BPlusTree<Key, Value> extends BTree<Key, Value> {
  async insert(
    key: Key, data: Value, overwrite?: boolean,
  ): Promise<Value | null> {
    let node = await this.readRoot();
    if (node == null) {
      // Create root node. If this is the case, just put data into the root
      // node and we're done.
      node = new Node(undefined, 1, [key], [0], [], true);
      node.id = await this.io.allocate(node);
      const dataId = await this.io.allocateData(data);
      node.data[0] = await this.io.writeData(dataId, data);
      await this.io.write(node.id, node);
      await this.io.writeRoot(node.id);
      return null;
    }
    // PO-insert. Unlike B-Tree, it checks for 2n or 2n + 1 keys instead of
    // 2n - 1 or 2n keys.
    if (node.keys.length >= this.nodeSize * 2) {
      // Create new root node then separate it.
      const newRoot = new Node(undefined, 0, [], [], [node.id], false);
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
        // First, locate where the node should be.
        const result: LocateResult = locateNode(node, key, this.comparator);
        const pos = result.position;
        if (result.exact) {
          if (!overwrite) throw new Error('Duplicate key');
          const beforeData: Value = await this.io.readData(node.data[pos]);
          node.data[pos] = await this.io.writeData(node.data[pos], data);
          await this.io.write(node.id, node);
          return beforeData;
        }
        // Then, shift the array until there.
        let i;
        for (i = node.keys.length; i > pos; --i) {
          node.keys[i] = node.keys[i - 1];
          node.data[i] = node.data[i - 1];
        }
        node.keys[i] = key;
        const dataId = await this.io.allocateData(data);
        node.data[i] = await this.io.writeData(dataId, data);
        await this.io.write(node.id, node);
        // We're done here.
        return null;
      } else {
        // If middle node, Find right offset and insert to there.
        const result: LocateResult = locateNode(node, key, this.comparator);
        let pos = result.position;
        if (result.exact) {
          if (!overwrite) throw new Error('Duplicate key');
          pos += 1;
        }
        let child: Node<any, Key> = await this.io.read(node.children[pos]);
        if (child.keys.length >= this.nodeSize * 2) {
          await this.split(node, pos);
          if (this.comparator(node.keys[pos], key) <= 0) {
            child = await this.io.read(node.children[pos + 1]);
          }
        }
        // Go to below node and continue...
        node = child;
      }
    }
    return null;
  }
  async remove(key: Key): Promise<Value | null> {
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
      const located = locateNode(node, key, this.comparator);
      const { exact } = located;
      let { position } = located;
      if (node.leaf) {
        if (!exact) return null;
        // If this is a leaf node, we can safely remove it from the keys.
        // The end.
        const dataId = node.data[position];
        node.keys.splice(position, 1);
        node.data.splice(position, 1);
        const [prevData] = await Promise.all([
          this.io.readData(dataId),
          this.io.write(node.id, node),
        ]);
        await this.io.removeData(dataId);
        return prevData;
      } else {
        // Locate the children...
        if (exact) position += 1;
        const childNode = await this.io.read(node.children[position]);
        if (childNode.keys.length <= this.nodeSize) {
          // Find the neighbor with more than n keys...
          const [leftNode, rightNode] = await Promise.all([
            this.io.read(node.children[position - 1]),
            this.io.read(node.children[position + 1]),
          ]);
          if (leftNode && leftNode.keys.length > this.nodeSize) {
            // Steal two keys from the left node.
            //    +----D----+
            //  A-B-C       E
            // 1 2 3 4     5 6
            //  --->
            //    +----B----+
            //    A       C-D-E
            //   1 2     3 4 5 6
            const leftPop = leftNode.keys.pop();
            if (leftPop == null) throw new Error('node is unexpectedly empty');
            childNode.keys.unshift(leftPop);
            childNode.data.unshift(leftNode.data.pop());
            // Since same level of nodes are always same, we can just look for
            // leftNode's validity.
            if (!leftNode.leaf) {
              const childrenAdd = leftNode.children.pop();
              if (childrenAdd != null) childNode.children.unshift(childrenAdd);
            }
            node.keys[position] = leftNode.keys[leftNode.keys.length];
            // node.data[position] = leftNode.data[leftNode.keys.length];
            node.data[position] = null;
            // Save all of them.
            await Promise.all([
              this.io.write(node.id, node),
              this.io.write(childNode.id, childNode),
              this.io.write(leftNode.id, leftNode),
            ]);
          } else if (rightNode && rightNode.keys.length > this.nodeSize) {
            // Steal a key from right node, while overwritting root node.
            //    +----B----+
            //    A       C-D-E
            //   1 2     3 4 5 6
            //             <---
            //    +----D----+
            //   A-C       D-E
            //  1 2 3     4 5 6
            const rightPop = rightNode.keys.shift();
            if (rightPop == null) throw new Error('node is unexpectedly empty');
            childNode.keys.push(rightPop);
            childNode.data.push(rightNode.data.shift());
            // Since same level of nodes are always same, we can just look for
            // rightNode's validity.
            if (!rightNode.leaf) {
              const childrenAdd = rightNode.children.shift();
              if (childrenAdd != null) childNode.children.push(childrenAdd);
            }
            node.keys[position] = rightNode.keys[0];
            // node.data[position] = rightNode.data[0];
            node.data[position] = null;
            // Save all of them.
            await Promise.all([
              this.io.write(node.id, node),
              this.io.write(childNode.id, childNode),
              this.io.write(rightNode.id, rightNode),
            ]);
          } else {
            // If both sibling nodes don't have insufficient keys, merge the
            // child node with one of the sibling node.
            let mergeLeft: Node<any, Key>;
            let mergeRight: Node<any, Key>;
            let offset, siblingOffset;
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
            }
            const prevSize = mergeLeft.keys.length;
            mergeRight.keys.forEach((v) => mergeLeft.keys.push(v));
            mergeRight.data.forEach((v) => mergeLeft.data.push(v));
            mergeRight.children.forEach((v, k) => {
              mergeLeft.children[prevSize + k] = v;
            });
            mergeLeft.right = mergeRight.right;
            // Remove mergeRight from disk.
            node.keys.splice(position + offset, 1);
            node.data.splice(position + offset, 1);
            node.children.splice(position + siblingOffset, 1);
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
    return null;
  }
  async get(key: Key): Promise<Value | null> {
    // Start from the root node, locate the key by descending into the value;
    let node = await this.readRoot();
    while (node != null) {
      // Try to locate where to go.
      const { position, exact } = locateNode(node, key, this.comparator);
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
  async getNode(key: Key): Promise<Node<any, Key> | null> {
    let node = await this.readRoot();
    while (node != null && !node.leaf) {
      // Try to locate where to go.
      const { position, exact } = locateNode(node, key, this.comparator);
      node = await this.io.read(node.children[position + (exact ? 1 : 0)]);
    }
    return node;
  }
  async split(node: Node<any, Key>, pos: number = 0): Promise<Node<any, Key>> {
    // Split works by slicing the children and putting the splited nodes
    // in right place.
    // A---+---B
    //   C-D-E
    // The procedure is similar to B-Tree, however, B+Tree doesn't remove
    // values from children. Instead, it copies smallest key from right child.
    // Thus it'd be splited into something like this:
    // A-+-E-+-B
    //  C-D  E
    const child = await this.io.read(node.children[pos]);

    // Push parent's keys / children to right to make a space to insert the
    // nodes.
    for (let i = node.keys.length + 1; i > pos + 1; --i) {
      node.children[i] = node.children[i - 1];
    }
    for (let i = node.keys.length; i > pos; --i) {
      node.keys[i] = node.keys[i - 1];
      node.data[i] = node.data[i - 1];
    }

    // Create right node by slicing the data from the child.
    // If leaf node, duplicate middle node. But non-leaf node should perform
    // exactly like B-Tree.
    let right;
    if (child.leaf) {
      right = new Node(undefined, child.keys.length - this.nodeSize + 1,
        child.keys.slice(this.nodeSize - 1),
        child.data.slice(this.nodeSize - 1),
        child.children.slice(this.nodeSize - 1),
        child.leaf,
      );
    } else {
      right = new Node(undefined, child.keys.length - this.nodeSize,
        child.keys.slice(this.nodeSize),
        child.data.slice(this.nodeSize),
        child.children.slice(this.nodeSize),
        child.leaf,
      );
    }
    // Fetch the center key.
    const center = child.keys[this.nodeSize - 1];
    const centerData = child.data[this.nodeSize - 1];
    // Resize the left node.
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
    node.data[pos] = null;
    // node.data[pos] = centerData;
    node.leaf = false;
    await Promise.all([
      this.io.write(right.id, right),
      this.io.write(child.id, child),
      this.io.write(node.id, node),
    ]);
    return node;
  }
  // Note that iteratorNodes can't be implemented in B-Tree, due to its
  // in-order nature.
  reverseIteratorNodes(key?: Key) {
    // Reversed version of asyncIterator.
    return (async function *(this: BPlusTree<Key, Value>) {
      // If the key is provided, scan and locate the position;
      let node;
      if (key != null) {
        node = await this.getNode(key);
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
        yield node;
        node = await getNext;
      }
    }).call(this);
  }
  iteratorNodes(key?: Key) {
    // Use IIFE to workaround the lack of class async functions.
    // However, there is no generator arrow functions, we need to workaround
    // around this object too.
    return (async function *(this: BPlusTree<Key, Value>) {
      let node;
      if (key != null) {
        node = await this.getNode(key);
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
        yield node;
        node = await getNext;
      }
    }).call(this);
  }
  // TODO Clean this mess up
  reverseIteratorEntries(key?: Key) {
    return (async function *(this: BPlusTree<Key, Value>) {
      let locateKey = key != null;
      const iterator = this.reverseIteratorNodes(key);
      while (true) {
        const { value: node, done } = await iterator.next();
        if (node == null || done) break;
        let i;
        if (locateKey && key != null) {
          i = locateNode(node, key, this.comparator).position;
          locateKey = false;
        } else {
          i = node.keys.length - 1;
        }
        while (i >= 0) {
          yield [node.keys[i], node.data[i]];
          --i;
        }
      }
    }).call(this);
  }
  iteratorEntries(key?: Key) {
    return (async function *(this: BPlusTree<Key, Value>) {
      let locateKey = key != null;
      const iterator = this.iteratorNodes(key);
      while (true) {
        const { value: node, done } = await iterator.next();
        if (node == null || done) break;
        let i = 0;
        if (locateKey && key != null) {
          i = locateNode(node, key, this.comparator).position;
          locateKey = false;
        }
        while (i < node.keys.length) {
          yield [node.keys[i], node.data[i]];
          ++i;
        }
      }
    }).call(this);
  }
  reverseIterator(key?: Key) {
    return (async function *(this: BPlusTree<Key, Value>) {
      let locateKey = key != null;
      const iterator = this.reverseIteratorNodes(key);
      while (true) {
        const { value: node, done } = await iterator.next();
        if (node == null || done) break;
        const getDatas = node.data.map((v: any) => this.io.readData(v));
        let i;
        if (locateKey && key != null) {
          i = locateNode(node, key, this.comparator).position;
          locateKey = false;
        } else {
          i = getDatas.length - 1;
        }
        while (i >= 0) {
          yield await getDatas[i];
          --i;
        }
      }
    }).call(this);
  }
  iterator(key?: Key) {
    return (async function *(this: BPlusTree<Key, Value>) {
      let locateKey = key != null;
      const iterator = this.iteratorNodes(key);
      while (true) {
        const { value: node, done } = await iterator.next();
        if (node == null || done) break;
        const getDatas = node.data.map((v: any) => this.io.readData(v));
        let i = 0;
        if (locateKey && key != null) {
          i = locateNode(node, key, this.comparator).position;
          locateKey = false;
        }
        while (i < getDatas.length) {
          yield await getDatas[i];
          ++i;
        }
      }
    }).call(this);
  }
  reverseIteratorKeys(key?: Key) {
    return (async function *(this: BPlusTree<Key, Value>) {
      let locateKey = key != null;
      const iterator = this.reverseIteratorNodes(key);
      while (true) {
        const { value: node, done } = await iterator.next();
        if (node == null || done) break;
        let i;
        if (locateKey && key != null) {
          i = locateNode(node, key, this.comparator).position;
          locateKey = false;
        } else {
          i = node.keys.length - 1;
        }
        while (i >= 0) {
          yield node.keys[i];
          --i;
        }
      }
    }).call(this);
  }
  iteratorKeys(key?: Key) {
    return (async function *(this: BPlusTree<Key, Value>) {
      let locateKey = key != null;
      const iterator = this.iteratorNodes(key);
      while (true) {
        const { value: node, done } = await iterator.next();
        if (node == null || done) break;
        let i = 0;
        if (locateKey && key != null) {
          i = locateNode(node, key, this.comparator).position;
          locateKey = false;
        }
        while (i < node.keys.length) {
          yield node.keys[i];
          ++i;
        }
      }
    }).call(this);
  }
}
