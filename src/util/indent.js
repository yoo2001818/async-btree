export default function indent(depth, delimiter = '  ') {
  let output = '';
  for (let i = 0; i < depth; ++i) output += delimiter;
  return output;
}
