const fs = require('fs');
const file = 'src/pages/audit/AuditProjectPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// Step 1: Remove ALL existing org/month pairs from mockFindings and mockReports
content = content.replace(/, org: '[^']+', month: \d+/g, '');

// Step 2: Add correct org/month to each finding
// Project mapping
const projMap = {
  'PRJ-2026-001': "', org: 'sz', month: 4",
  'PRJ-2026-002': "', org: 'zq', month: 5",
  'PRJ-2026-003': "', org: 'sz', month: 5",
  'PRJ-2026-004': "', org: 'sz', month: 5",
  'PRJ-2025-012': "', org: 'zq', month: 12",
};

// Fix findings: insert org/month before responsibleDept
content = content.replace(
  /(projectId: '(PRJ-\d{4}-\d{3})', projectName: '[^']+', severity: '[^']+', category: '[^']+', status: '[^']+'(?:, amount: \d+)?,) responsibleDept/g,
  (match, fullProjId, projId) => {
    const suffix = projMap[projId] || "', org: 'sz', month: 6";
    return match.replace(', responsibleDept', suffix + ', responsibleDept');
  }
);

// Fix findings without amount (FND-018)
content = content.replace(
  /(projectId: '(PRJ-\d{4}-\d{3})', projectName: '[^']+', severity: '[^']+', category: '[^']+', status: '[^']+',) responsibleDept/g,
  (match, fullProjId, projId) => {
    if (match.includes('org:')) return match; // already fixed
    const suffix = projMap[projId] || "', org: 'sz', month: 6";
    return match.replace(', responsibleDept', suffix + ', responsibleDept');
  }
);

// Fix reports
content = content.replace(
  /(id: 'RPT-001', projectId: 'PRJ-2026-002', projectName: '[^']+',) template/g,
  "$1 org: 'zq', month: 5, template"
);
content = content.replace(
  /(id: 'RPT-002', projectId: 'PRJ-2025-012', projectName: '[^']+',) template/g,
  "$1 org: 'zq', month: 1, template"
);

// Fix create report
content = content.replace(
  /const newReport: Report = \{\s+id: `RPT-/,
  'const newReport: Report = {\n        id: `RPT-'
);
content = content.replace(
  /(const newReport: Report = \{\s+id: `RPT-[^`]+`),(\s+projectId: values\.projectId,)/,
  '$1,\n        org: \'sz\', month: 6$2'
);

fs.writeFileSync(file, content);
console.log('Done');
