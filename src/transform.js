import { parseScript } from "meriyah";
import { parse } from 'recast';
import { visit } from 'ast-types';
import { existsSync, readFileSync } from 'fs';
import { basename } from "path";

export default function transform(path) {
  console.log('transform', path);
  const source = readFileSync(path);
//   const estree = parse(source.toString());
//   function visit(node) {
//     if (node.type === 'JSXElement') {
//       console.log('transform node!');
//       console.log(node);
//     } else {
//       for (const child of Object.values(node)) {
//         if (typeof child === 'object' && child !== null) {
//           visit(child);
//         }
//       }
//     }
//   }
// 
//   visit(estree);
  return source;
}
