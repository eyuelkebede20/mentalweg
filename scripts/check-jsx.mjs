import fs from 'node:fs';
import * as ts from 'typescript';

const content = fs.readFileSync('public-app/src/LandingPage.tsx', 'utf8');
const sf = ts.createSourceFile('LandingPage.tsx', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const diagnostics = sf.parseDiagnostics;
for (const diag of diagnostics) {
  const { line, character } = sf.getLineAndCharacterOfPosition(diag.start);
  console.log(`Line ${line + 1}:${character + 1} - ${diag.messageText}`);
}
