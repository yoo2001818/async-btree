import BTree from './btree';
import Node, { N } from './node';
import spreadAsyncIterable from './util/spreadAsyncIterable';

describe('BTree', () => {
  // Use direct I/O without using IDs for ease of debugging
  let btree, rootNode;
  beforeEach(() => {
    btree = new BTree({
      getRoot: () => Promise.resolve(rootNode),
      writeRoot: (newNode) => Promise.resolve(rootNode = newNode),
      read: (id) => Promise.resolve(id),
      write: (id) => Promise.resolve(id),
      remove: () => Promise.resolve(),
      allocate: (node) => Promise.resolve(node),
    });
  });
  describe('#@@asyncIterator', () => {
    beforeEach(() => {
      // Overwrite root node.
      rootNode = N([3, 5], [
        N([1, 2]),
        N([4]),
        N([8], [N([6, 7]), N([9])]),
      ]);
    });
    it('should traverse the tree in-order', async () => {
      expect(await spreadAsyncIterable(btree))
        .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });
  describe('#traverse', () => {
    beforeEach(() => {
      // Overwrite root node.
      rootNode = N([3, 5], [
        N([1, 2]),
        N([4]),
        N([8], [N([6, 7]), N([9])]),
      ]);
    });
    it('should traverse the tree in-order', async () => {
      let i = 0;
      await btree.traverse(v => {
        i++;
        expect(v).toBe(i);
      });
      expect(i).toBe(9);
    });
  });
});
