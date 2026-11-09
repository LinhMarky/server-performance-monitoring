'use strict';
const fs = require('node:fs');
const path = require('node:path');

function generateCodes(count) {
  if (!Number.isSafeInteger(count) || count < 100 || count > 1000000) {
    throw new Error('STUDENT_COUNT must be an integer between 100 and 1000000.');
  }
  const ids = new Set(Array.from({ length: 100 }, (_, i) => 1 + Math.floor(i * (count - 1) / 99)));
  for (const id of [1, 50, 100, Math.floor(count/4), Math.floor(count/2), Math.floor(count*3/4), count-1, count]) ids.add(id);
  return [...ids].sort((a,b) => a-b).map(id => `SV${String(id).padStart(7, '0')}`);
}

if (require.main === module) {
  try {
    const raw = process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? process.env.STUDENT_COUNT ?? '200000';
    if (!/^\d+$/.test(raw)) throw new Error('STUDENT_COUNT must contain only digits.');
    const codes = generateCodes(Number(raw));
    const json = `${JSON.stringify(codes, null, 2)}\n`;
    if (process.argv.includes('--stdout')) process.stdout.write(json);
    else {
      const destination = path.join(__dirname, '../benchmark-data/student-codes.json');
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, json);
      console.log(`Generated ${codes.length} valid codes for ${raw} students: ${destination}`);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { generateCodes };
