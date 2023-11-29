const { transform } = require('../lib/compiler');
const { JSVM } = require('../lib/vm/vm');
// const { JSVM } = require('../dist');
const code = require('fs').readFileSync(require('path').join(__dirname, './benchmark.js'), 'utf-8');
const script = transform(code, 'sum.js', { hoisting: true, convertES5: false });

const vm1 = new JSVM({
  console,
  require,
});

vm1.go(script);
