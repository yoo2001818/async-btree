export default class MemoryIO {
  constructor() {
    this.size = 0;
    this.root = null;
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
  allocate(node) {
    let id = this.size ++;
    return Promise.resolve(id);
  }
  readData(id) {
    return Promise.resolve(this.data[id]);
  }
  writeData(id, data) {
    this.data[id] = data;
    return Promise.resolve(id);
  }
  removeData(id) {
    this.data[id] = undefined;
    return Promise.resolve();
  }
  allocateData(data) {
    let id = this.size ++;
    return Promise.resolve(id);
  }
}
