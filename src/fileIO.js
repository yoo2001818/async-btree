import fs from 'mz/fs';

// FileIO uses internal file-system like structure (such as pages, etc) to
// store data. So basically, we're developing some kind of file system
// on a... file system.
//
// Each page is 16K bytes, and each page represents single B-Tree node.
// Each data page has single node, however, this'll be changed over time.
// Each key can contain up to 256 bytes, so each page can contain up to
// 256 keys (If we exclude pointers, etc.)
//
// There's a superblock, which contains the list of free blocks, used blocks,
// root block, etc.
// In B+Tree, we should store next / prev pointers in node too.
const buffer = Buffer.alloc(16 * 1024);
export default class FileIO {
  constructor() {
    this.fd = null;
  }
  async open(path) {
    try {
      this.fd = await fs.open(path, 'r+');
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Generate new database.
        this.fd = await fs.open(path, 'w+');
      } else {
        throw err;
      }
    }
    await this.readSuperblock();
  }
  async readSuperblock() {
    // Load first 16K of the file descriptor.
    await fs.read(this.fd, buffer, 0, 16 * 1024, 0);
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
