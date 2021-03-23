# gemini protocol stuff

A work in progress module/package for working with the [Gemini](https://gemini.circumlunar.space/) protocol. Heavily influenced by the nodejs http module.

## Usage

Right now while I'm currently iterating on this there isn't really an _easy_ way of playing around with it. However, if you really want to you can clone the repo and do

```
npm run build
```

then inside a seperate project do

```
npm install /path/to/gemini
```

which will create a symbolic link to the library within your projects `node_modules` folder.

After that you can import/require the package as you normally would.

```
import * as gemini from 'gemini'
// or
const gemini = require('gemini');
```

## Documentation

The two main exports are `gemini.request` and `gemini.createServer`

`gemini.request(url)`

`gemini.createServer(opts, [requestListener])`

## License

[MIT](./LICENSE)
