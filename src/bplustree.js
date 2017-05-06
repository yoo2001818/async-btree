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
}
