export default async function spreadAsyncIterable(iterable) {
  let iterator;
  if (iterable[Symbol.asyncIterator]) {
    iterator = iterable[Symbol.asyncIterator].call(iterable);
  } else {
    iterator = iterable;
  }
  let result = [];
  while (true) {
    const { value, done } = await iterator.next();
    if (done) break;
    result.push(value);
  }
  return result;
}
