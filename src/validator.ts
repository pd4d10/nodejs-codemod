import {
  ASTPath,
  CallExpression,
  Collection,
  identifier,
  IfStatement,
  property,
  template,
  ThrowStatement,
  Transform,
} from 'jscodeshift'
import { print } from 'recast'

const transformer: Transform = (file, api, options) => {
  // exclude lib/internal/validators.js
  if (file.path.endsWith('lib/internal/validators.js')) return

  const root = api.jscodeshift(file.source)

  applyTransform(root, 'string', 'validateString')
  applyTransform(root, 'boolean', 'validateBoolean')
  applyTransform(root, 'number', 'validateNumber')
  applyTransform(root, 'function', 'validateFunction')

  return root.toSource()
}

export default transformer

function applyTransform(
  root: Collection,
  validateType: string,
  funcName: string
) {
  let hasMatch = false

  // find the correct throw statements and replace it
  root.find(ThrowStatement).forEach((p) => {
    const { argument } = p.node

    // pattern: throw new ERR_INVALID_ARG_TYPE('desc', {validateType}, value)
    if (
      argument.type === 'NewExpression' &&
      argument.callee.type === 'Identifier' &&
      argument.callee.name === 'ERR_INVALID_ARG_TYPE' &&
      argument.arguments.length === 3 &&
      argument.arguments[1].type === 'Literal' &&
      typeof argument.arguments[1].value === 'string' &&
      argument.arguments[1].value.toLowerCase() === validateType
    ) {
      const p0 = p.parent as ASTPath
      let ifPath: ASTPath
      let ifNode: IfStatement

      // try to find a if statement
      if (p0.node.type === 'IfStatement') {
        ifPath = p0
        ifNode = p0.node
      } else if (p0.node.type === 'BlockStatement') {
        ifPath = p0.parent as ASTPath
        if (ifPath.node.type === 'IfStatement') {
          ifNode = ifPath.node
        } else {
          return
        }
      } else {
        return
      }

      // pattern: if (typeof value === {validateType})
      if (
        ifNode.test.type === 'BinaryExpression' &&
        ifNode.test.operator === '!==' &&
        ifNode.test.left.type === 'UnaryExpression' &&
        ifNode.test.left.operator === 'typeof' &&
        ifNode.test.right.type === 'Literal' &&
        typeof ifNode.test.right.value === 'string' &&
        ifNode.test.right.value === validateType
      ) {
        hasMatch = true

        const value = print(ifNode.test.left.argument).code
        const desc = print(argument.arguments[0]).code

        ifPath.replace(template.statement`${funcName}(${value}, ${desc});`)
      }
    }
  })

  // if has match, import the util function
  if (hasMatch) {
    const findRequireCalls = () => {
      return root.find(CallExpression).filter((p) => {
        // pattern: require('internal/validators')
        return (
          p.node.callee.type === 'Identifier' &&
          p.node.callee.name === 'require' &&
          p.node.arguments[0].type === 'Literal' &&
          p.node.arguments[0].value === 'internal/validators'
        )
      })
    }

    if (findRequireCalls().length === 0) {
      // no require, add it
      root
        .find(CallExpression)
        .insertBefore(
          template.statement`const { ${funcName} } = require('internal/validators')`
        )
    }

    const requireCalls = findRequireCalls()

    const p0 = requireCalls.get(0).parent as ASTPath
    if (
      p0.node.type === 'VariableDeclarator' &&
      p0.node.id.type === 'ObjectPattern' &&
      p0.node.id.properties.every((p) => print(p).code !== funcName)
    ) {
      p0.node.id.properties.push(
        property.from({
          kind: 'init',
          key: identifier(funcName),
          value: identifier(funcName),
          shorthand: true,
        })
      )
    }
  }
}
