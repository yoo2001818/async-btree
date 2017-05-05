// @flow

import type Node from './node';

export interface IOInterface<Key, Value> {
  getRoot(): Promise<any>;
  writeRoot(id: any): Promise<any>;
  // Node section
  read(id: any): Promise<Node<Key>>;
  write(id: any, node: Node<Key>): Promise<any>;
  remove(id: any): Promise<void>;
  allocate(node: Node<Key>): Promise<any>;
  // Data section
  readData(id: any): Promise<Value>;
  writeData(id: any, node: Value): Promise<any>;
  removeData(id: any): Promise<void>;
  allocateData(node: Value): Promise<any>;
}

export interface Tree<Key, Value> {
  readRoot(): Promise<?Node<Key>>;
  insert(key: Key, data: Value): Promise<Tree<Key, Value>>;
  remove(key: Key): Promise<boolean>;
  get(key: Key): Promise<?Value>;
  split(node: Node<Key>, pos: number): Promise<Node<Key>>;
  smallestNode(topNode: ?Node<Key>): Promise<?Node<Key>>;
  biggestNode(topNode: ?Node<Key>): Promise<?Node<Key>>;
  smallest(topNode: ?Node<Key>): Promise<?Key>;
  biggest(topNode: ?Node<Key>): Promise<?Key>;
  // reverseIterator(): Iterator;
  // [Symbol.asyncIterator](): Iterator;
  traverse(callback: Function): Promise<void>;
}
