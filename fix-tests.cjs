const fs = require('fs');
const path = require('path');
const d = './tests/state';
fs.readdirSync(d).filter(f=>f.endsWith('.test.ts')).forEach(f => {
  const p = path.join(d, f);
  let c = fs.readFileSync(p, 'utf8');
  c = c.split('{ uid:').join('{ factionId: "angels_of_death", weapons: [], uid:');
  fs.writeFileSync(p, c);
});
