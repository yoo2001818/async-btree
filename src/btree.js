// A asynchronous B-Tree implementation.
import Node from './node';

interface IOInterface {
  getRoot(): Promise<any>;
  writeRoot(id: any): Promise<any>;
  read(id: any): Promise<Node>;
  write(id: any, node: Node): Promise<any>;
  remove(id: any): Promise<void>;
  allocate(): Promise<any>;
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
  async insert(key: Key, data: Value): void {
    let node = await this.readRoot();
    if (node == null) {
      // Create root node. If this is the case, just put data into the root
      // node and we're done.
      node = new Node(await this.io.allocate(), 1, [key], [data], [], true);
      await this.io.write(node.id, node);
      await this.io.writeRoot(node.id);
      return;
    }
    if (node.keys.length >= this.nodeSize * 2 - 1) {
      // Create new root node then separate it.
      let newRoot = new Node(await this.io.allocate(), 0, [], [], [node.id],
        false);
      await this.split(newRoot, 0);
      await this.io.writeRoot(newRoot.id);
      node = newRoot;
    }
    while (node != null) {
      if (node.leaf) {
        // If leaf node, put the key in the right place, while pushing the other
        // ones.
        let i;
        for (i = node.n;
          i >= 1 && this.comparator(node.keys[i - 1], key) > 0; --i
        ) {
          node.keys[i] = node.keys[i - 1];
          node.data[i] = node.data[i - 1];
        }
        node.keys[i] = key;
        node.data[i] = data;
        await this.io.write(node.id, node);
        // We're done here.
        return this;
      } else {
        // If middle node, Find right offset and insert to there.
        let result = node.locate(key, this.comparator);
        if (result.exact) throw new Error('Duplicate key');
        let pos = result.position;
        let child = node.children[pos];
        if (child.keys.length === this.nodeSize * 2 - 1) {
          await this.split(node, pos);
          if (this.comparator(node.keys[pos], key) < 0) {
            child = node.children[pos + 1];
          }
        }
        // Go to below node and continue...
        node = child;
      }
    }
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
    right.id = await this.io.allocate();
    node.children[pos + 1] = right.id;
    node.keys[pos] = center;
    await Promise.all([
      this.io.write(right.id, right),
      this.io.write(child.id, child),
      this.io.write(node.id, node),
    ]);
    return node;
  }
  async traverse(callback: Function): void {
    let rootNode = await this.readRoot();
    return await this._traverse(rootNode, callback);
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
