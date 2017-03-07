// A asynchronous B-Tree implementation.

interface IOInterface {
  read(sector: number): Promise<Object>;
  write(sector: number, data: Object): Promise;
}

export default class BTree<Key, Data> {
  nodeSize: number;
  size: number;
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
  insert(key: Key, data: Data): Promise<void> {
  }
  remove(key: Key): Promise<void> {
  }
  find(key: Key): Promise<Data> {
  }
}
