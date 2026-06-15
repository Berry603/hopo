const fs = require('fs');
const file = 'src/pages/audit/AuditProjectPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix pattern: add org and month before responsibleDept in findings
// Pattern for findings WITH amount:
content = content.replace(
  /(projectId: 'PRJ-\d{4}-\d{3}', projectName: '[^']+', severity: '[^']+', category: '[^']+', status: '[^']+', amount: \d+,) responsibleDept/g,
  '$1 org: \'sz\', month: 5, responsibleDept'
);

// Fix findings WITHOUT amount (like FND-018)
content = content.replace(
  /(projectId: 'PRJ-\d{4}-\d{3}', projectName: '[^']+', severity: '[^']+', category: '[^']+', status: '[^']+',) responsibleDept/g,
  '$1 org: \'sz\', month: 5, responsibleDept'
);

// Fix reports
content = content.replace(
  /(id: 'RPT-001', projectId: 'PRJ-2026-002', projectName: '采购流程合规性审计',) template/g,
  '$1 org: \'zq\', month: 5, template'
);
content = content.replace(
  /(id: 'RPT-002', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计',) template/g,
  '$1 org: \'zq\', month: 1, template'
);

// Fix create report function
content = content.replace(
  /id: `RPT-(\$\{reports.length \+ 1\}).padStart\(3, '0'\)\}`/g,
  'id: `RPT-$1`'
);
content = content.replace(
  /(id: `RPT-\d{3}`,)\s+projectId: values\.projectId,/g,
  '$1 org: \'sz\', month: 6, projectId: values.projectId,'
);

fs.writeFileSync(file, content);
console.log('Done fixing AuditProjectPage.tsx');
