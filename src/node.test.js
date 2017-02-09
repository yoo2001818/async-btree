import Node from './node';

describe('Node', () => {
  describe('#inspect', () => {
    let node;
    beforeEach(() => {
      node = new Node([3, 5], [
        new Node([1, 2]),
        new Node([4]),
        new Node([8], [new Node([6, 7]), new Node([9])]),
      ]);
    });
    it('should output stringified nodes', () => {
      expect(node.inspect()).toBe(`
        - - 1
        - - 2
        - 3
        - - 4
        - 5
        - - - 6
        - - - 7
        - - 8
        - - - 9
      `.replace(/ {8}/g, '').trim());
    });
  });
  describe('#fromArray', () => {
    it('should return generated tree', () => {
      expect([...Node.fromArray([1, 2, 3, 4, 5, 6, 7, 8],
        (a, b) => a - b)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });
  describe('#size', () => {
    it('should return right size', () => {
      expect(new Node([3, 5], [
        new Node([1, 2]),
        new Node([4]),
        new Node([8], [new Node([6, 7]), new Node([9])]),
      ]).size()).toBe(9);
    });
    it('should return 0 for empty node', () => {
      expect(new Node().size()).toBe(0);
    });
  });
  describe('#height', () => {
    it('should return right height', () => {
      expect(new Node([3, 5], [
        new Node([1, 2]),
        new Node([4]),
        new Node([8], [new Node([6, 7]), new Node([9])]),
      ]).height()).toBe(3);
    });
    it('should return 1 for empty node', () => {
      expect(new Node().height()).toBe(1);
    });
  });
  describe('#smallest', () => {
    it('should return smallest key on the tree', () => {
      let node = Node.fromArray([1, 2, 3, 4, 5, 6, 7, 8], (a, b) => a - b);
      expect(node.smallest()).toBe(1);
    });
  });
  describe('#biggest', () => {
    it('should return biggest key on the tree', () => {
      let node = Node.fromArray([1, 2, 3, 4, 5, 6, 7, 8], (a, b) => a - b);
      expect(node.biggest()).toBe(8);
    });
  });
  describe('#traverse', () => {
    let node;
    beforeEach(() => {
      node = new Node([3, 5], [
        new Node([1, 2]),
        new Node([4]),
        new Node([8], [new Node([6, 7]), new Node([9])]),
      ]);
    });
    it('should traverse the tree in-order', () => {
      let i = 0;
      node.traverse(v => {
        i++;
        expect(v).toBe(i);
      });
      expect(i).toBe(9);
    });
  });
  describe('#@@iterator', () => {
    let node;
    beforeEach(() => {
      node = new Node([3, 5], [
        new Node([1, 2]),
        new Node([4]),
        new Node([8], [new Node([6, 7]), new Node([9])]),
      ]);
    });
    it('should traverse the tree in-order', () => {
      expect([...node]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });
  describe('#locate', () => {
    let node, comparator;
    beforeEach(() => {
      node = new Node([3, 5, 10, 15, 22, 500], [
        new Node([1, 2], [new Node([0])]),
        new Node([4]),
        new Node([8], [new Node([6, 7]), new Node([9])]),
      ]);
      comparator = (a, b) => a - b;
    });
    it('should locate the position of exact node', () => {
      expect(node.locate(5, comparator)).toEqual([1, true]);
      expect(node.locate(22, comparator)).toEqual([4, true]);
    });
    it('should locate the position of middle node', () => {
      expect(node.locate(1, comparator)).toEqual([0, false]);
      expect(node.locate(4, comparator)).toEqual([1, false]);
      expect(node.locate(6000, comparator)).toEqual([6, false]);
    });
  });
  describe('#search', () => {
    let node, comparator;
    beforeEach(() => {
      node = new Node([3, 5, 10, 15, 22, 500], [
        new Node([1, 2], [new Node([0])]),
        new Node([4]),
        new Node([8], [new Node([6, 7]), new Node([9])]),
      ]);
      comparator = (a, b) => a - b;
    });
    it('should search the key', () => {
      expect(node.search(4, comparator)).toBe(4);
      expect(node.search(2, comparator)).toBe(2);
      expect(node.search(8, comparator)).toBe(8);
      expect(node.search(3, comparator)).toBe(3);
      expect(node.search(1, comparator)).toBe(1);
      expect(node.search(0, comparator)).toBe(0);
      expect(node.search(9, comparator)).toBe(9);
    });
    it('should return null if not found', () => {
      expect(node.search(53, comparator)).toBe(null);
    });
  });
  describe('#split', () => {
    let node;
    beforeEach(() => {
      node = new Node([1, 5], [new Node([2, 3, 4])]);
    });
    it('should split the node', () => {
      expect(node.split(0, 2).inspect()).toBe(`
        - - 2
        - 3
        - - 4
        - 1
        - 5
      `.replace(/ {8}/g, '').trim());
    });
    it('should split the node if only one children is available', () => {
      node = new Node([], [new Node([2, 3, 4])]);
      expect(node.split(0, 2).inspect()).toBe(`
        - - 2
        - 3
        - - 4
      `.replace(/ {8}/g, '').trim());
    });
  });
  describe('#insert', () => {
    let node, comparator;
    beforeEach(() => {
      node = new Node();
      comparator = (a, b) => a - b;
    });
    it('should return current root node', () => {
      expect(node.insert(1, comparator, 2, true)).toBe(node);
    });
    it('should return new root node', () => {
      node.keys = [1, 2, 3];
      let newRoot = node.insert(4, comparator, 2, true);
      expect(newRoot.children[0]).toBe(node);
    });
    it('should work on empty root', () => {
      node.insert(1, comparator, 2, true);
      expect([...node]).toEqual([1]);
    });
    it('should sort randomized array to 0..99', () => {
      let arr = [];
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
        node = node.insert(arr[i], comparator, 2, true);
      }
      expect([...node]).toEqual(answer);
    });
  });
});
