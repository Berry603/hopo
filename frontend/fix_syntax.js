const fs = require('fs');
const file = 'src/pages/audit/AuditProjectPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix the broken syntax: amount: NNNN', org -> amount: NNNN, org
content = content.replace(/, amount: (\d+)', org:/g, ', amount: $1, org:');

// Fix the broken syntax: amount: NNNN', responsibleDept -> amount: NNNN, responsibleDept
// (This was created by an earlier broken replace)

fs.writeFileSync(file, content);
console.log('Fixed syntax');
