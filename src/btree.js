// A asynchronous B-Tree implementation.
import Node from './node';

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
  async split(node: Node, pos: number = 0): Node {
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
    let child = node.children[pos];

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
    // Resize the left node.
    child.size = this.nodeSize - 1;
    child.keys.length = this.nodeSize - 1;
    child.children.length = this.nodeSize;

    // Save the left / right node.
    node.children[pos + 1] = await this.io.allocate(right);
    node.keys[pos] = center;
    await this.io.write(child.id, child);
    await this.io.write(node.id, node);
    return node;
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
