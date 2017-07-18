export default function indent(depth: number, delimiter: string = '  ') {
  let output = '';
  for (let i = 0; i < depth; ++i) output += delimiter;
  return output;
}
