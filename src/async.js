interface IOInterface {
  read(sector: Number): Promise<Object>;
  write(sector: Number, data: Object): Promise;
}

export default function createAsyncBTree(ioInterface: IOInterface): Function {
  return class BTree {
    constructor() {
      this.keys = [];
      this.children = [];
    }
  };
}
