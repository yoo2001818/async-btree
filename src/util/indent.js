export default function indent(depth) {
  let output = '';
  for (let i = 0; i < depth; ++i) output += '  ';
  return output;
}
