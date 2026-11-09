'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let count = 0;
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules','.git'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.js')) { execFileSync(process.execPath, ['--check',file]); count++; }
  }
}
for (const dir of ['backend','frontend','scripts']) walk(path.join(root,dir));
console.log(`PASS JavaScript syntax: ${count} files`);
