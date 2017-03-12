export default async function spreadAsyncIterable(iterable) {
  const iterator = iterable[Symbol.asyncIterator]();
  let result = [];
  while (true) {
    const { value, done } = await iterator.next();
    if (done) break;
    result.push(value);
  }
  return result;
}
