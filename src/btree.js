// A asynchronous B-Tree implementation.
import type Node from './node';

interface IOInterface {
  getRoot(): Promise<any>;
  writeRoot(id: any): Promise<any>;
  read(id: any): Promise<Node>;
  write(id: any, node: Node): Promise<any>;
  remove(id: any): Promise<void>;
  allocate(node: Node): Promise<any>;
}

export default class BTree<Key, Value> {
  nodeSize: number;
  comparator: (a: Key, b: Key) => number;
  root: Node;
  io: IOInterface;

  constructor(io: IOInterface, nodeSize: number,
    comparator: (a: Key, b: Key) => number
  ) {
    this.io = io;
    this.nodeSize = nodeSize;
    this.comparator = comparator;
  }
  readRoot(): Promise<?Node> {
    return this.io.getRoot().then(id => {
      if (id == null) return null;
      // We're not using async function to use TCO?
      return this.io.read(id);
    });
  }
  insert(key: Key, data: Value): Promise<void> {
  }
  remove(key: Key): Promise<void> {
  }
  get(key: Key): Promise<Value> {
  }
  async traverse(callback: Function): void {
    return this._traverse(await this.readRoot(), callback);
  }
  async _traverse(node: Node, callback: Function): void {
    // This is regular B-Tree, so each regular node has at least one data.
    let i;
    for (i = 0; i < node.size; ++i) {
      if (node.children[i] != null) {
        await this._traverse(await this.io.read(node.children[i]), callback);
      }
      // TODO Should we put data in same section?
      callback(await this.io.read(node.data[i]));
    }
    if (node.children[i] != null) {
      await this._traverse(await this.io.read(node.children[i]), callback);
    }
  }
}
