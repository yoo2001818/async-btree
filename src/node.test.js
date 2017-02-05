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
  });
});
