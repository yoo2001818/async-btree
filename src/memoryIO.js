export default class MemoryIO {
  constructor() {
    this.root = 0;
    this.data = [];
  }
  getRoot() {
    return Promise.resolve(this.root);
  }
  writeRoot(id) {
    this.root = id;
    return Promise.resolve(id);
  }
  read(id) {
    return Promise.resolve(this.data[id]);
  }
  write(id, node) {
    this.data[id] = node;
    return Promise.resolve(id);
  }
  remove(id) {
    this.data[id] = undefined;
    return Promise.resolve();
  }
  allocate() {
    let id = this.data.length;
    return Promise.resolve(id);
  }
}
