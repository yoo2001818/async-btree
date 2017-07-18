export default async function spreadAsyncIterable<T>(
  iterable: AsyncIterator<T> | AsyncIterable<T>,
): Promise<T[]> {
  let iterator: AsyncIterator<T>;
  if ((iterable as AsyncIterable<T>)[Symbol.asyncIterator]) {
    iterator = (iterable as AsyncIterable<T>)[Symbol.asyncIterator]();
  } else {
    iterator = iterable as AsyncIterator<T>;
  }
  const result = [];
  while (true) {
    const { value, done } = await iterator.next();
    if (done) break;
    result.push(value);
  }
  return result;
}
