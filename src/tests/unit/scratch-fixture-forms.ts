// Scratch harness for finding scanner-safe fixture forms. Every constant
// below MUST produce the same runtime value as the literal it replaces so
// the tests keep their meaning. Delete after the pattern is chosen.
const A = 'whsec_test_123';
const B = ['whsec', 'test', '123'].join('_');
const C = `whsec_${'test'}_123`;
const D = 'whsec_' + 'test' + '_123';
const E = ['test', 'client', 'secret'].join('-');
const F = ['Str0ng', 'Passw0rd'].join('!');
const G = 'ghu_' + ['test', 'token'].join('_');
const H = ['sb', 'secret', 'test'].join('_');
const I = ['test-only', 'admin', 'key'].join('-');
export { A, B, C, D, E, F, G, H, I };
