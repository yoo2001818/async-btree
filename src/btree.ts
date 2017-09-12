// A asynchronous B-Tree implementation.
import Node, { locateNode, LocateResult } from './node';
import { IOInterface, Nullable, Tree } from './type';

export default class BTree<Key, Value> implements Tree<Key, Value> {
  nodeSize: number;
  comparator: (a: Key, b: Key) => number;
  root: Node<any, Key>;
  io: IOInterface<any, Key, Value>;

  constructor(
    io: IOInterface<any, Key, Value>,
    nodeSize: number,
    comparator: (a: Key, b: Key) => number,
  ) {
    this.io = io;
    this.nodeSize = nodeSize;
    this.comparator = comparator;
  }
  async readRoot(): Promise<Node<any, Key> | null> {
    const id = await this.io.getRoot();
    if (id == null) return null;
    return await this.io.read(id);
  }
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
    if (node.keys.length >= this.nodeSize * 2 - 1) {
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
        const pos = result.position;
        if (result.exact) {
          if (!overwrite) throw new Error('Duplicate key');
          const beforeData: Value = await this.io.readData(node.data[pos]);
          node.data[pos] = await this.io.writeData(node.data[pos], data);
          await this.io.write(node.id, node);
          return beforeData;
        }
        let child: Node<any, Key> = await this.io.read(node.children[pos]);
        if (child.keys.length === this.nodeSize * 2 - 1) {
          await this.split(node, pos);
          const compResult = this.comparator(node.keys[pos], key);
          if (compResult === 0) {
            if (!overwrite) throw new Error('Duplicate key');
            const beforeData: Value = await this.io.readData(node.data[pos]);
            node.data[pos] = await this.io.writeData(node.data[pos], data);
            await this.io.write(node.id, node);
            return beforeData;
          } else if (compResult < 0) {
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
    // Start from the root node, remove entries to match B-Tree criteria.
    let node = await this.readRoot();
    while (node != null) {
      // First, we need to locate where the key would be, and descend while
      // performing rebalancing logic.
      const { position, exact } = locateNode(node, key, this.comparator);
      if (!exact) {
        // Descending node requires at least `nodeSize` keys, so if descending
        // node doesn't have it - we have to make it have `nodeSize` keys by
        // merging two nodes.
        // Fail if the node is leaf node.
        if (node.leaf) return null;
        const childNode = await this.io.read(node.children[position]);
        if (childNode.keys.length < this.nodeSize) {
          const [leftNode, rightNode] = await Promise.all([
            this.io.read(node.children[position - 1]),
            this.io.read(node.children[position + 1]),
          ]);
          // Search for sibling node with at least `nodeSize` keys, and steal
          // a key from that node.
          if (leftNode && leftNode.keys.length >= this.nodeSize) {
            // Steal a key from left node.
            //   +----C----+
            // A-+-B     D-+-E
            // --->
            //   +----B----+
            //   A       C-D-E
            childNode.keys.unshift(node.keys[position]);
            childNode.data.unshift(node.data[position]);
            // Since same level of nodes are always same, we can just look for
            // leftNode's validity.
            if (!leftNode.leaf) {
              const childrenAdd = leftNode.children.pop();
              if (childrenAdd != null) childNode.children.unshift(childrenAdd);
            }
            const leftPop = leftNode.keys.pop();
            if (leftPop == null) throw new Error('node is unexpectedly empty');
            node.keys[position] = leftPop;
            node.data[position] = leftNode.data.pop();
            // Save all of them.
            await Promise.all([
              this.io.write(node.id, node),
              this.io.write(childNode.id, childNode),
              this.io.write(leftNode.id, leftNode),
            ]);
          } else if (rightNode && rightNode.keys.length >= this.nodeSize) {
            // Steal a key from right node.
            //   +----C----+
            // A-+-B     D-+-E
            // --->
            //   +----D----+
            // A-B-C       E
            childNode.keys.push(node.keys[position]);
            childNode.data.push(node.data[position]);
            // Since same level of nodes are always same, we can just look for
            // leftNode's validity.
            if (!rightNode.leaf) {
              const childrenAdd = rightNode.children.shift();
              if (childrenAdd != null) childNode.children.push(childrenAdd);
            }
            const rightPop = rightNode.keys.shift();
            if (rightPop == null) throw new Error('node is unexpectedly empty');
            node.keys[position] = rightPop;
            node.data[position] = rightNode.data.shift();
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
            const prevSize = mergeLeft.keys.length;
            mergeLeft.keys.push(node.keys[position + offset]);
            mergeLeft.data.push(node.data[position + offset]);
            mergeRight.keys.forEach((v) => mergeLeft.keys.push(v));
            mergeRight.data.forEach((v) => mergeLeft.data.push(v));
            mergeRight.children.forEach((v, k) => {
              mergeLeft.children[prevSize + k + 1] = v;
            });
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
      } else {
        let prevData;
        // Exact match was found
        if (node.leaf) {
          // If this is a leaf node, we can safely remove it from the keys.
          // The end.
          const dataId = node.data[position];
          node.keys.splice(position, 1);
          node.data.splice(position, 1);
          [prevData] = await Promise.all([
            this.io.readData(dataId),
            this.io.write(node.id, node),
          ]);
          await this.io.removeData(dataId);
        } else {
          // Otherwise, it's a little complicated...
          // Search for sibling node with at least `size` keys, and steal
          // 'most closest to the key value' key in the node.
          // If both sibling nodes don't have insufficient keys, merge sibling
          // nodes to one, while deleteing the key in the process.
          const [leftNode, rightNode] = await Promise.all([
            this.io.read(node.children[position - 1]),
            this.io.read(node.children[position]),
          ]);
          if (leftNode != null && leftNode.keys.length >= this.nodeSize) {
            // Steal biggest node in the left node.
            const biggestNode = await this.biggestNode(leftNode);
            if (biggestNode == null) {
              throw new Error('There is no biggest node available; this is' +
                ' not supposed to happen');
            }
            const biggest = biggestNode.keys.pop();
            const biggestData = biggestNode.data.pop();
            const dataId = node.data[position];
            if (biggest == null) throw new Error('node is unexpectedly empty');
            node.keys[position] = biggest;
            node.data[position] = biggestData;
            [prevData] = await Promise.all([
              this.io.readData(dataId),
              this.io.write(biggestNode.id, biggestNode),
              this.io.write(node.id, node),
            ]);
            await this.io.removeData(dataId);
          } else if (rightNode != null && rightNode.keys.length >= this.nodeSize
          ) {
            // Steal smallest node in the right node.
            const smallestNode = await this.smallestNode(rightNode);
            if (smallestNode == null) {
              throw new Error('There is no smallest node available; this is' +
                ' not supposed to happen');
            }
            const smallest = smallestNode.keys.shift();
            const smallestData = smallestNode.data.shift();
            const dataId = node.data[position];
            if (smallest == null) throw new Error('node is unexpectedly empty');
            node.keys[position] = smallest;
            node.data[position] = smallestData;
            [prevData] = await Promise.all([
              this.io.readData(dataId),
              this.io.write(smallestNode.id, smallestNode),
              this.io.write(node.id, node),
            ]);
            await this.io.removeData(dataId);
          } else if (leftNode != null && rightNode != null) {
            // Merge left and right node.
            const prevSize = leftNode.keys.length;
            rightNode.keys.forEach((v) => leftNode.keys.push(v));
            rightNode.data.forEach((v) => leftNode.data.push(v));
            rightNode.children.forEach((v, k) => {
              leftNode.children[prevSize + k + 1] = v;
            });
            const dataId = node.data[position];
            node.keys.splice(position, 1);
            node.data.splice(position, 1);
            node.children.splice(position, 1);
            // Save to disk, while removing right node.
            [prevData] = await Promise.all([
              this.io.readData(dataId),
              this.io.write(node.id, node),
              this.io.write(leftNode.id, leftNode),
              this.io.remove(rightNode.id),
            ]);
            await this.io.removeData(dataId);
          } else {
            throw new Error('Left and right node is missing while removing');
          }
        }
        return prevData;
      }
    }
    return null;
  }
  async get(
    key: Key, nearest?: boolean, reverse?: boolean,
  ): Promise<Value | null> {
    // Start from the root node, locate the key by descending into the value;
    let node = await this.readRoot();
    let stack;
    if (nearest) {
      stack = [];
    }
    while (node != null) {
      // Try to locate where to go.
      const { position, exact } = locateNode(node, key, this.comparator);
      if (exact) return this.io.readData(node.data[position]);
      // If not matched, go down to right child
      // But this fails in leaf node, so just mark it as a failure
      if (node.leaf) {
        if (nearest) {
          // If the position is out of range, we need to go up until
          // parent's values are larger than the provided key...
          // Hopefully, we only have to go up, so we don't have to read other
          // nodes.
          while (stack.length > 0 && (!reverse ? position >= node.data.length
            : position <= 0)) {
            const popped = stack.pop();
            position = popped.position;
            node = popped.node;
          }
          if (!reverse && position < node.data.length) {
            return this.io.readData(node.data[position]);
          }
          if (reverse && position > 0) {
            return this.io.readData(node.data[position - 1]);
          }
        }
        return null;
      }
      if (nearest) {
        // Save current position and node, since that's necessary get next
        // value, unlike B+Tree.
        stack.push({ node, position });
      }
      node = await this.io.read(node.children[position]);
    }
    // Failed!
    return null;
  }
  async split(node: Node<any, Key>, pos: number = 0): Promise<Node<any, Key>> {
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
    const right = new Node(undefined, child.keys.length - this.nodeSize,
      child.keys.slice(this.nodeSize),
      child.data.slice(this.nodeSize),
      child.children.slice(this.nodeSize),
      child.leaf,
    );
    // Fetch the center key.
    const center = child.keys[this.nodeSize - 1];
    const centerData = child.data[this.nodeSize - 1];
    // Resize the left node.
    child.keys.length = this.nodeSize - 1;
    child.data.length = this.nodeSize - 1;
    child.children.length = this.nodeSize;

    // Save the left / right node.
    right.id = await this.io.allocate(right);
    node.children[pos + 1] = right.id;
    node.keys[pos] = center;
    node.data[pos] = centerData;
    node.leaf = false;
    await Promise.all([
      this.io.write(right.id, right),
      this.io.write(child.id, child),
      this.io.write(node.id, node),
    ]);
    return node;
  }
  async smallestNode(topNode?: Node<any, Key>): Promise<Node<any, Key> | null> {
    // Just navigate to smallest node, easy!
    let node = topNode || await this.readRoot();
    while (node != null && !node.leaf) {
      node = await this.io.read(node.children[0]);
    }
    return node;
  }
  async biggestNode(topNode?: Node<any, Key>): Promise<Node<any, Key> | null> {
    // Just navigate to biggest node, easy!
    let node = topNode || await this.readRoot();
    while (node != null && !node.leaf) {
      node = await this.io.read(node.children[node.keys.length]);
    }
    return node;
  }
  async smallest(topNode?: Node<any, Key>): Promise<Key | null> {
    const node = await this.smallestNode(topNode);
    if (node == null) return null;
    return node.keys[0];
  }
  async biggest(topNode?: Node<any, Key>): Promise<Key | null> {
    const node = await this.biggestNode(topNode);
    if (node == null) return null;
    return node.keys[node.keys.length - 1];
  }
  reverseIteratorEntries(key?: Key): AsyncIterator<[Key, Value]> {
    // Reverse version of asyncIterator.
    return (async function *(this: BTree<Key, Value>) {
      // This can be greatly simplified in B+Tree, however, this is just a
      // regular B-Tree, so let's just use a stack.
      // If a key is provided, we need to traverse to the node where the key is
      // located while reconstructing the stack.
      // Sounds quite complicated...
      let rootNode = await this.readRoot();
      const stack: Array<[Node<any, Key>, number]> = [];
      if (key != null) {
        while (rootNode != null) {
          // Try to locate where to go.
          const { position, exact } =
            locateNode(rootNode, key, this.comparator);
          if (rootNode.leaf || exact) {
            if (!exact && position !== 0) {
              stack.push([rootNode, position - 1]);
            } else if (exact) {
              stack.push([rootNode, position]);
            }
            break;
          } else {
            if (position !== 0) {
              stack.push([rootNode, position - 1]);
            }
          }
          rootNode = await this.io.read(rootNode.children[position]);
        }
        if (rootNode == null) return;
      } else {
        if (rootNode == null) return;
        stack.push([rootNode, rootNode.keys.length]);
      }
      while (stack.length > 0) {
        const stackEntry = stack[stack.length - 1];
        const node = stackEntry[0];
        const pos = stackEntry[1]--;
        if (pos !== node.keys.length) {
          yield [node.keys[pos], node.data[pos]];
        }
        // Step into descending node...
        if (!node.leaf && node.children[pos] != null) {
          if (pos === 0) {
            // Do TCO if this node is last children of the node
            const newNode = await this.io.read(node.children[pos]);
            stack[stack.length - 1] = [newNode, newNode.keys.length];
          } else {
            // Otherwise, just push.
            const newNode = await this.io.read(node.children[pos]);
            stack.push([newNode, newNode.keys.length]);
          }
        } else if (pos === 0) {
          // Escape if finished.
          stack.pop();
        }
      }
    }).call(this);
  }
  iteratorEntries(key?: Key): AsyncIterator<[Key, Value]> {
    // Reverse version of asyncIterator.
    // Use IIFE to workaround the lack of class async functions.
    // However, there is no generator arrow functions, we need to workaround
    // around this object too.
    return (async function *(this: BTree<Key, Value>) {
      // This can be greatly simplified in B+Tree, however, this is just a
      // regular B-Tree, so let's just use a stack.
      // If a key is provided, we need to traverse to the node where the key is
      // located while reconstructing the stack.
      // Sounds quite complicated...
      let rootNode = await this.readRoot();
      const stack: Array<[Node<any, Key>, number]> = [];
      if (key != null) {
        while (rootNode != null) {
          // Try to locate where to go.
          const { position, exact } =
            locateNode(rootNode, key, this.comparator);
          if (rootNode.leaf || exact) {
            if (!exact && position >= rootNode.keys.length) break;
            stack.push([rootNode, position + 1]);
            break;
          } else {
            if (position < rootNode.keys.length) {
              stack.push([rootNode, position + 1]);
            }
          }
          rootNode = await this.io.read(rootNode.children[position]);
        }
        if (rootNode == null) return;
      } else {
        if (rootNode == null) return;
        stack.push([rootNode, 0]);
      }
      while (stack.length > 0) {
        const stackEntry = stack[stack.length - 1];
        const node = stackEntry[0];
        const pos = stackEntry[1]++;
        if (pos !== 0) {
          yield [node.keys[pos - 1], node.data[pos - 1]];
        }
        // Step into descending node...
        if (!node.leaf && node.children[pos] != null) {
          if (pos >= node.keys.length) {
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
        } else if (pos >= node.keys.length) {
          // Escape if finished.
          stack.pop();
        }
      }
    }).call(this);
  }
  reverseIterator(key?: Key): AsyncIterator<Value> {
    return (async function *(this: BTree<Key, Value>) {
      const iterator = this.reverseIteratorEntries(key);
      while (true) {
        const { value, done } = await iterator.next();
        if (done || value == null) break;
        yield await this.io.readData(value[1]);
      }
    }).call(this);
  }
  iterator(key?: Key): AsyncIterator<Value> {
    return (async function *(this: BTree<Key, Value>) {
      const iterator = this.iteratorEntries(key);
      while (true) {
        const { value, done } = await iterator.next();
        if (done || value == null) break;
        yield await this.io.readData(value[1]);
      }
    }).call(this);
  }
  reverseIteratorKeys(key?: Key): AsyncIterator<Key> {
    return (async function *(this: BTree<Key, Value>) {
      const iterator = this.reverseIteratorEntries(key);
      while (true) {
        const { value, done } = await iterator.next();
        if (done || value == null) break;
        yield value[0];
      }
    }).call(this);
  }
  iteratorKeys(key?: Key): AsyncIterator<Key> {
    return (async function *(this: BTree<Key, Value>) {
      const iterator = this.iteratorEntries(key);
      while (true) {
        const { value, done } = await iterator.next();
        if (done || value == null) break;
        yield value[0];
      }
    }).call(this);
  }
  // Iterator to traverse the tree's whole nodes in pre-order.
  iteratorNodesAll(key?: Key): AsyncIterator<Node<any, Key>> {
    return (async function *(this: BTree<Key, Value>) {
      const rootNode = await this.readRoot();
      const stack: Array<[Node<any, Key>, number]> = [];
      if (rootNode == null) return;
      stack.push([rootNode, 0]);
      while (stack.length > 0) {
        const stackEntry = stack[stack.length - 1];
        const node = stackEntry[0];
        const pos = stackEntry[1]++;
        if (pos === 0) yield node;
        // Step into descending node...
        if (!node.leaf && node.children[pos] != null) {
          if (pos >= node.keys.length) {
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
        } else if (pos >= node.keys.length) {
          // Escape if finished.
          stack.pop();
        }
      }
    }).call(this);
  }
  [Symbol.asyncIterator](key?: Key) {
    return this.iterator(key);
  }
  async traverse(callback: (v: Value) => any): Promise<void> {
    // For await loops doesn't work well for now - just call iterator directly.
    // $FlowFixMe
    const iterator = this[Symbol.asyncIterator]();
    while (true) {
      const { value, done } = await iterator.next();
      if (done) break;
      callback(value);
    }
  }
  async nodeToString(root?: Node<any, Key>): Promise<string> {
    const output: string[] = [];
    // If a key is provided, we need to traverse to the node where the key is
    // located while reconstructing the stack.
    // Sounds quite complicated...
    const rootNode = root || await this.readRoot();
    const stack: Array<[Node<any, Key>, number]> = [];
    if (rootNode != null) stack.push([rootNode, 0]);
    while (stack.length > 0) {
      const stackEntry = stack[stack.length - 1];
      const node = stackEntry[0];
      const pos = stackEntry[1]++;
      if (pos > node.keys.length) {
        stack.pop();
        continue;
      }
      if (pos !== 0) {
        output.push(stack.map(() => '').join('| ') + node.keys[pos - 1]);
      }
      // Step into descending node...
      if (!node.leaf && node.children[pos] != null) {
        stack.push([
          await this.io.read(node.children[pos]),
          0,
        ]);
      }
    }
    return output.join('\n');
  }
}
