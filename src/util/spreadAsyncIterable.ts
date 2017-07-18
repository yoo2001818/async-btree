export default async function spreadAsyncIterable<T>(
  iterable: AsyncIterator<T> | AsyncIterable<T>
): Promise<T[]> {
  let iterator: AsyncIterator<T>;
  if ((<AsyncIterable<T>>iterable)[Symbol.asyncIterator]) {
    iterator = (<AsyncIterable<T>>iterable)[Symbol.asyncIterator]();
  } else {
    iterator = <AsyncIterator<T>>iterable;
  }
  let result = [];
  while (true) {
    const { value, done } = await iterator.next();
    if (done) break;
    result.push(value);
  }
  return result;
}
