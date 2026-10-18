const fs = require('fs');
const ts = require('typescript');
const keys = Object.keys(ts);
console.log('ts keys:', keys.slice(0, 10));
const t = ts.default || ts;
console.log('ScriptTarget:', t.ScriptTarget);
const sourceFile = t.createSourceFile('LandingPage.tsx', file, t.ScriptTarget ? t.ScriptTarget.Latest : 99, true, t.ScriptKind ? t.ScriptKind.TSX : 4);
console.log('Syntactic errors count:', sourceFile.parseDiagnostics.length);
sourceFile.parseDiagnostics.forEach(d => {
  const lc = sourceFile.getLineAndCharacterOfPosition(d.start);
  console.log(`Line ${lc.line + 1}, col ${lc.character + 1}: ${d.messageText}`);
});
