import Node from './node';

export type Nullable<T> = T | null | undefined;

export interface IOInterface<Id, Key, Value> {
  getRoot(): Promise<Id | null>;
  writeRoot(id: Id): Promise<Id>;
  // Node section
  read(id: Id): Promise<Node<Id, Key>>;
  write(id: Id, node: Node<Id, Key>): Promise<Id>;
  remove(id: Id): Promise<void>;
  allocate(node: Node<Id, Key>): Promise<any>;
  // Data section
  readData(id: Id): Promise<Value>;
  writeData(id: Id, node: Value): Promise<Id>;
  removeData(id: Id): Promise<void>;
  allocateData(node: Value): Promise<Id>;
}

export interface Tree<Key, Value> extends AsyncIterable<Value> {
  readRoot(): Promise<Node<any, Key> | null>;
  insert(key: Key, data: Value, overwrite?: boolean): Promise<Value | null>;
  remove(key: Key): Promise<boolean>;
  get(key: Key): Promise<Value | null>;
  split(node: Node<any, Key>, pos: number): Promise<Node<any, Key>>;
  smallestNode(topNode?: Node<any, Key>): Promise<Node<any, Key> | null>;
  biggestNode(topNode?: Node<any, Key>): Promise<Node<any, Key> | null>;
  smallest(topNode?: Node<any, Key>): Promise<Key | null>;
  biggest(topNode?: Node<any, Key>): Promise<Key | null>;
  reverseIteratorEntries(key?: Key): AsyncIterator<[Key, any]>;
  iteratorEntries(key?: Key): AsyncIterator<[Key, any]>;
  reverseIteratorKeys(key?: Key): AsyncIterator<Key>;
  iteratorKeys(key?: Key): AsyncIterator<Key>;
  reverseIterator(key?: Key): AsyncIterator<Value>;
  iterator(key?: Key): AsyncIterator<Value>;
  iteratorNodesAll(key?: Key): AsyncIterator<Node<any, Key>>;
  traverse(callback: (value: Value) => any): Promise<void>;
}
