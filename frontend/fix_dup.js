const fs = require('fs');
const file = 'src/pages/audit/AuditProjectPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove duplicate org/month properties (keep the last one)
// Pattern: org: 'xx', month: N, org: 'yy', month: M  -> keep only first
content = content.replace(/org: '([^']+)', month: (\d+), org: '([^']+)', month: (\d+)/g, 'org: \'$1\', month: $2');

// Fix reports with duplicate properties
content = content.replace(/org: '([^']+)', month: (\d+), org: '([^']+)', month: (\d+)/g, 'org: \'$1\', month: $2');

// Fix the create report function - add org/month
content = content.replace(
  /const newReport: Report = \{\s+id: `RPT-(\$\{reports\.length \+ 1\}).padStart\(3, '0'\)}`/g,
  'const newReport: Report = {\n        id: `RPT-$1`,\n        org: \'sz\', month: 6'
);

// Fix the create report that uses random ID
content = content.replace(
  /id: `RPT-\$\{Math\.floor\(Math\.random\(\) \* 900 \+ 100\)\}`/g,
  'id: `RPT-${Math.floor(Math.random() * 900 + 100)}`,\n        org: \'sz\', month: 6'
);

fs.writeFileSync(file, content);
console.log('Done cleaning duplicates');
