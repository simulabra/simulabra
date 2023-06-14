import { parseScript as meriyahParse } from "meriyah";
import { prettyPrint, types } from 'recast';
const b = types.builders;
import { existsSync, readFileSync } from 'fs';

function jsxAttribute(node) {
  if (node.type === 'JSXExpressionContainer') {
    return node.expression;
  } else {
    return node;
  }
}

function jsx(node) {
  const exp = b.callExpression(
    b.memberExpression(
      b.callExpression(
        b.memberExpression(
          b.memberExpression(
            b.identifier('$'),
            b.identifier('html_element'),
            false
          ),
          b.identifier('new'),
          false
        ),
        [
          b.objectExpression([
            b.property(
              'init',
              b.identifier('tag'),
              b.literal('div')
            ),
            b.property(
              'init',
              b.identifier('properties'),
              b.objectExpression([])
            ),
            b.property(
              'init',
              b.identifier('children'),
              b.arrayExpression([])
            )
          ])
        ]
      ),
      b.identifier('to_dom'),
      false
    ),
    []
  );

  exp.callee.object.arguments[0].properties[0].value.value = node.openingElement.name.name;
  exp.callee.object.arguments[0].properties[1].value.properties = node.openingElement.attributes.map(p => b.property('init', b.identifier(p.name.name), jsxAttribute(p.value)));
  exp.callee.object.arguments[0].properties[2].value.elements = node.children.map(c => nodemap(c));

  return exp;

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
