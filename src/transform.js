import { parseScript as meriyahParse } from "meriyah";
import { prettyPrint, types } from 'recast';
const b = types.builders;
import { readFileSync } from 'fs';

function jsxAttribute(node) {
  if (node.type === 'JSXExpressionContainer') {
    return node.expression;
  } else {
    return node;
  }
}

function jsx(node) {
  if (node.type === 'JSXElement') {
    const children = node.children
      .map(c => nodemap(c));
    const tag = node.openingElement.name.name;
    const props = node.openingElement.attributes.map(p => b.property('init', b.identifier(p.name.name), jsxAttribute(p.value)));
    if (tag.indexOf('$$') === 0) {
      return b.memberExpression(b.identifier('$'), b.identifier(tag.slice(2)), false);
    } else if (tag[0] === '$') {
      props.push(b.property('init', b.identifier('parent'), b.thisExpression()));
      const args = [b.objectExpression(props)];

      if (node.children.length > 0) {
        args.push(b.arrayExpression(children.filter(c => !(c.type === 'Literal' && c.value.indexOf('\n') === 0))));
      }
      return b.callExpression(
        b.memberExpression(
          b.memberExpression(
            b.identifier('$'),
            b.identifier(tag.slice(1)),
            false
          ),
          b.identifier('from_jsx'),
          false
        ),
        args
      );
    } else {
      const properties = props;
      return b.callExpression(
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
              b.literal(tag)
            ),
            b.property(
              'init',
              b.identifier('properties'),
              b.objectExpression(properties)
            ),
            b.property(
              'init',
              b.identifier('children'),
              b.arrayExpression(children)
            )
          ])
        ]
      );
    }
  } else if (node.type === 'JSXText') {
    return b.literal(node.value);
  } else if (node.type === 'JSXExpressionContainer') {
    return node.expression;
  } else if (node.type === 'JSXFragment') {
    return b.arrayExpression(node.children.map(c => jsx(c)));
  } else {
    globalThis.SIMULABRA.log('not handled', node);
    return node;
  }

}

function nodemap(node) {
  let newnode;
  if ('type' in node && node.type.indexOf('JSX') === 0) {
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
