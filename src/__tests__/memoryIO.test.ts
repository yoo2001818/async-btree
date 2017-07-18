import 'core-js/modules/es7.symbol.async-iterator';

import BTree from '../btree';
import MemoryIO from '../memoryIO';
import test from './tree.test.common';

describe('MemoryIO', () => {
  let btree: BTree<number, number>;
  beforeEach(() => {
    btree = new BTree(new MemoryIO(), 2, (a, b) => a - b);
  });
  test(() => btree);
});
