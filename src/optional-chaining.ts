import {
  ConditionalExpression,
  expressionStatement,
  template,
  logicalExpression,
  Transform,
  optionalMemberExpression,
} from 'jscodeshift'
import { print } from 'recast'

const transformer: Transform = (file, api, options) => {
  const root = api.jscodeshift(file.source)

  root.find(ConditionalExpression).forEach((p) => {
    if (
      p.node.consequent.type === 'MemberExpression' &&
      print(p.node.consequent.object).code === print(p.node.test).code
    ) {
      p.replace(
        template.statement`${
          print(
            optionalMemberExpression(
              p.node.consequent.object,
              p.node.consequent.property
            )
          ).code
        } ?? ${print(p.node.alternate).code}`
      )
    }
  })

  return root.toSource()
}

export default transformer
