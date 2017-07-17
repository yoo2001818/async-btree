import BPlusTree from './bplustree';
import { N } from './node';
import spreadAsyncIterable from './util/spreadAsyncIterable';
import test from './tree.test.common';

describe('BPlusTree', () => {
  // Use direct I/O without using IDs for ease of debugging
  let btree, rootNode;
  beforeEach(() => {
    btree = new BPlusTree({
      getRoot: () => Promise.resolve(rootNode),
      writeRoot: (newNode) => Promise.resolve(rootNode = newNode),
      read: (id) => Promise.resolve(id),
      write: (id) => Promise.resolve(id),
      remove: () => Promise.resolve(),
      allocate: (node) => Promise.resolve(node),
      readData: (id) => Promise.resolve(id),
      writeData: (id) => Promise.resolve(id),
      removeData: () => Promise.resolve(),
      allocateData: (node) => Promise.resolve(node),
    }, 2, (a, b) => a - b);
    rootNode = null;
  });
  test(() => btree);
  describe('#reverseIterator', () => {
    beforeEach(() => {
      // Overwrite root node.
      rootNode = N([4, 7], [
        N([1, 2, 3]),
        N([4, 5, 6]),
        N([7, 8, 9]),
      ]);
    });
    it('should traverse the tree in-order', async() => {
      expect(await spreadAsyncIterable(btree.reverseIterator()))
        .toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    });
  });
  describe('#@@asyncIterator', () => {
    beforeEach(() => {
      // Overwrite root node.
      rootNode = N([4, 7], [
        N([1, 2, 3]),
        N([4, 5, 6]),
        N([7, 8, 9]),
      ]);
    });
    it('should traverse the tree in-order', async() => {
      expect(await spreadAsyncIterable(btree))
        .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });
  describe('#traverse', () => {
    beforeEach(() => {
      // Overwrite root node.
      rootNode = N([4, 7], [
        N([1, 2, 3]),
        N([4, 5, 6]),
        N([7, 8, 9]),
      ]);
    });
    it('should traverse the tree in-order', async() => {
      let i = 0;
      await btree.traverse(v => {
        i++;
        expect(v).toBe(i);
      });
      expect(i).toBe(9);
    });
  });
});
