# nodejs-codemod

A tool for refactoring [Node.js codebase](https://github.com/nodejs/node)

## Usage

```sh
npm install
npm run build
npx jscodeshift -t lib/validatior.js {your/nodejs/source/path}/lib/**/*.js
```

## Roadmap

- [ ] Reuse the validation in `lib/internal/validators.js`
- [ ] Migration of core modules to primordials:: https://github.com/nodejs/node/issues/30697

## License

MIT
