// @flow
// import indent from './util/indent';

export type Comparator<Key> = (a: Key, b: Key) => number;

// Although it's not necessary at all - it reduces some overhead since it
// doesn't have to store length information.
export class LocateResult {
  position: number;
  exact: boolean;
  constructor(position: number, exact: boolean) {
    // Again, we're using | and !! to make the JIT compiler aware of its types.
    this.position = position | 0;
    this.exact = !!exact;
  }
}

export function locateNode<Key>(
  node: Node<Key>,
  key: Key,
  comparator: Comparator<Key>
): LocateResult {
  let high = node.keys.length - 1;
  let low = 0;
  do {
    let mid = (high + low) >> 1;
    let compared = comparator(node.keys[mid], key);
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

export function N<Key>(keys: Key[], children: ?Node<Key>[]): Node<Key> {
  if (children != null) {
    for (let i = 0; i < children.length; ++i) {
      children[i].left = children[i - 1];
      children[i].right = children[i + 1];
    }
  }
  return new Node(undefined, keys.length, keys, keys, children || [],
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
  // Stores left - right relation for B+Tree.
  left: any;
  right: any;
  leaf: boolean;
  constructor(id: any, size: number, keys: Key[], data: any[],
    children: any[], leaf: boolean) {
    this.id = id;
    this.size = size;
    this.keys = keys;
    this.data = data;
    this.children = children;
    this.leaf = leaf;
  }
}
