import { parseScript as meriyahParse } from "meriyah";
import { prettyPrint, types } from 'recast';
const b = types.builders;
import { existsSync, readFileSync } from 'fs';

function jsx(node) {
  return b.identifier('jsx');
}

function nodemap(node) {
  let newnode;
  if ('type' in node && node.type === 'JSXElement') {
    newnode = jsx(node);
  } else if (Array.isArray(node)) {
    newnode = [ ...node ];
  } else {
    newnode = { ...node };
  }
  for (const key in newnode) {
    const child = newnode[key];
    if (typeof child === 'object' && child !== null) {
      newnode[key] = nodemap(child);
    }
  }
  return newnode;
}

export default function transform(path) {
  console.log('transform', path);
  const source = readFileSync(path).toString();
  const estree = meriyahParse(source, {
    module: true,
    jsx: true,
    // loc: true,
  });
  // const estree = parse(source.toString(), {
  //   parser: {
  //     parse(source) {
  //       return ;
  //     }
  //   }
  // });

  const mapped = nodemap(estree);
  const res = prettyPrint(mapped);
  return res.code;
}
