import spreadAsyncIterable from '../util/spreadAsyncIterable';
import { Tree } from '../type';

export default function test(getTree: () => Tree<number, number>) {
  let btree: Tree<number, number>;
  beforeEach(() => {
    btree = getTree();
  });
  describe('#insert', () => {
    it('should return itself', async() => {
      expect(await btree.insert(1, 1)).toBe(btree);
    });
    it('should work on empty root', async() => {
      expect(await btree.insert(1, 1)).toBe(btree);
      expect(await spreadAsyncIterable(btree)).toEqual([1]);
    });
    it('should sort randomized array to 0..99', async() => {
      let arr: number[] = [];
      let answer;
      for (let i = 0; i < 100; ++i) {
        arr.push(i);
      }
      answer = arr.slice();
      // Use simple shuffle algorithm
      for (let i = 99; i > 0; --i) {
        let j = Math.random() * i | 0;
        let tmp = arr[j];
        arr[j] = arr[i];
        arr[i] = tmp;
      }
      for (let i = 0; i < 100; ++i) {
        expect(await btree.insert(arr[i], arr[i])).toBe(btree);
      }
      expect(await spreadAsyncIterable(btree)).toEqual(answer);
    });
  });
  describe('#remove', () => {
    it('should remove node 0 to 9', async() => {
      for (let i = 0; i < 10; ++i) await btree.insert(i, i);
      for (let i = 0; i < 9; ++i) {
        expect(await btree.remove(i)).toBe(true);
      }
      expect(await spreadAsyncIterable(btree)).toEqual([9]);
    });
    it('should return false if failed to find node', async() => {
      for (let i = 0; i < 10; ++i) await btree.insert(i, i);
      expect(await btree.remove(53)).toBe(false);
      expect(await btree.remove(-49)).toBe(false);
    });
  });
  describe('#get', () => {
    beforeEach(async() => {
      for (let i = 0; i < 100; ++i) {
        await btree.insert(i, i + 31);
      }
    });
    it('should return right value', async() => {
      for (let i = 0; i < 100; ++i) {
        expect(await btree.get(i)).toBe(i + 31);
      }
    });
    it('should return null for invalid values', async() => {
      expect(await btree.get(50.5)).toBe(null);
      expect(await btree.get(-33)).toBe(null);
    });
  });
  describe('#smallest', () => {
    beforeEach(async() => {
      for (let i = 0; i < 100; ++i) await btree.insert(i, i);
    });
    it('should return smallest value', async() => {
      expect(await btree.smallest()).toBe(0);
    });
  });
  describe('#biggest', () => {
    beforeEach(async() => {
      for (let i = 0; i < 100; ++i) await btree.insert(i, i);
    });
    it('should return biggest value', async() => {
      expect(await btree.biggest()).toBe(99);
    });
  });
  describe('#reverseIterator', () => {
    beforeEach(async() => {
      for (let i = 0; i < 10; ++i) await btree.insert(i, i);
    });
    it('should traverse the tree in-order', async() => {
      expect(await spreadAsyncIterable(btree.reverseIterator()))
        .toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    });
    it('should traverse the tree from specified point', async() => {
      for (let i = 0; i < 10; ++i) {
        expect(await spreadAsyncIterable(btree.reverseIterator(i)))
          .toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0].slice(9 - i));
      }
    });
  });
  describe('#iterator', () => {
    beforeEach(async() => {
      for (let i = 0; i < 10; ++i) await btree.insert(i, i);
    });
    it('should traverse the tree in-order', async() => {
      expect(await spreadAsyncIterable(btree))
        .toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
    it('should traverse the tree from specified point', async() => {
      for (let i = 0; i < 10; ++i) {
        expect(await spreadAsyncIterable(btree.iterator(i)))
          .toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].slice(i));
      }
    });
  });
}
