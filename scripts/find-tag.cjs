const fs = require('fs');
const content = fs.readFileSync('public-app/src/LandingPage.tsx', 'utf8');

const lines = content.split('\n');
const stack = [];

// Match JSX tags
const tagRegex = /<\/?([a-zA-Z0-9]+)(\s|>|\/)/g;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let match;
  while ((match = tagRegex.exec(line)) !== null) {
    const full = match[0];
    const name = match[1];
    
    // Ignore self-closing or void elements
    if (['img', 'input', 'br', 'hr', 'meta', 'link'].includes(name.toLowerCase())) continue;
    
    // Check if self closing in this line, e.g. <Tag ... />
    const restOfLine = line.slice(match.index);
    if (/^<[a-zA-Z0-9]+[^>]*\/>/.test(restOfLine)) {
      continue;
    }

    if (full.startsWith('</')) {
      const popped = stack.pop();
      if (!popped || popped.name !== name) {
        console.log(`Mismatch at line ${i+1}: got </${name}>, but stack had <${popped ? popped.name : 'empty'}> (from line ${popped ? popped.line : '?'})`);
      }
    } else {
      stack.push({ name, line: i + 1 });
    }
  }
}

if (stack.length > 0) {
  console.log(`Remaining unclosed tags in stack:`, stack);
} else {
  console.log('All tags balanced!');
}
