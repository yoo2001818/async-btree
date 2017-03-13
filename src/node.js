// import indent from './util/indent';

export type Comparator<Key> = (a: Key, b: Key) => number;

// Although it's not necessary at all - it reduces some overhead since it
// doesn't have to store length information.
export class LocateResult {
  position: number;
  exact: boolean;
  constructor(position, exact) {
    // Again, we're using | and !! to make the JIT compiler aware of its types.
    this.position = position | 0;
    this.exact = !!exact;
  }
}

export function N(keys, children) {
  return new Node(undefined, keys.length, keys, keys, children,
    children == null);
}

export default class Node<Key> {
  // The address of node itself.
  id: any;
  size: number;
  keys: Key[];
  data: any[];
  // Childrens usually store filesystem's key - however - direct values can
  // be stored too. IOInterface should handle this then.
  children: any[];
  leaf: boolean;
  constructor(id, size, keys, data, children, leaf) {
    this.id = id;
    this.size = size;
    this.keys = keys;
    this.data = data;
    this.children = children;
    this.leaf = leaf;
  }
  locate(key: Key, comparator: Comparator): [number, boolean] {
    let high = this.keys.length - 1;
    let low = 0;
    do {
      let mid = (high + low) >> 1;
      let compared = comparator(this.keys[mid], key);
      if (compared === 0) {
        return new LocateResult(mid, true);
      } else if (compared < 0) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    } while (high >= low);
    return new LocateResult(low, false);
  }
}
