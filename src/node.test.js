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
  describe('#split', () => {
    let node;
    beforeEach(() => {
      node = new Node([1, 5], [new Node([2, 3, 4])]);
    });
    it('should split the node', () => {
      node.split(0, 2);
    });
  });
});
