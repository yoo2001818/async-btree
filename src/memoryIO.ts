export default class MemoryIO {
  size: number;
  root: any;
  data: any[];
  constructor() {
    this.size = 0;
    this.root = null;
    this.data = [];
  }
  getRoot() {
    return Promise.resolve(this.root);
  }
  writeRoot(id: number) {
    this.root = id;
    return Promise.resolve(id);
  }
  read(id: number) {
    return Promise.resolve(this.data[id]);
  }
  write(id: number, node: any) {
    this.data[id] = node;
    return Promise.resolve(id);
  }
  remove(id: number) {
    this.data[id] = undefined;
    return Promise.resolve();
  }
  allocate(node: any) {
    const id = this.size++;
    return Promise.resolve(id);
  }
  readData(id: number) {
    return Promise.resolve(this.data[id]);
  }
  writeData(id: number, data: any) {
    this.data[id] = data;
    return Promise.resolve(id);
  }
  removeData(id: number) {
    this.data[id] = undefined;
    return Promise.resolve();
  }
  allocateData(data: any) {
    const id = this.size++;
    return Promise.resolve(id);
  }
}
