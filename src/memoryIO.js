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
    console.log('Reading ' + id);
    return Promise.resolve(this.data[id]);
  }
  write(id, node) {
    console.log('Writing ' + id);
    this.data[id] = node;
    return Promise.resolve(id);
  }
  remove(id) {
    console.log('Removing ' + id);
    this.data[id] = undefined;
    return Promise.resolve();
  }
  allocate() {
    let id = this.data.length;
    console.log('Allocating ' + id);
    return Promise.resolve(id);
  }
}
