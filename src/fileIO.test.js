import BTree from './btree';
import FileIO from './fileIO';
import test from './btree.test.common';

describe('FileIO', () => {
  let btree, fileIO;
  beforeEach(async () => {
    fileIO = new FileIO();
    await fileIO.open('test.db');
    btree = new BTree(fileIO, 2, (a, b) => a - b);
  });
  test(() => btree);
});
