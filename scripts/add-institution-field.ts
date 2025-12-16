import * as fs from 'fs';
import * as path from 'path';

const dataPath = path.join(__dirname, '..', 'src', 'lib', 'data.ts');
const content = fs.readFileSync(dataPath, 'utf-8');

// Replace all occurrences where birth ends without institution
const updated = content.replace(/birth: "([^"]+)" \}/g, 'birth: "$1", institution: "IETAC" }');

fs.writeFileSync(dataPath, updated);
console.log('✅ Added institution field to all IETAC students');
