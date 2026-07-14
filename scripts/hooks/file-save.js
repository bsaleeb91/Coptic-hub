#!/usr/bin/env node
/**
 * File Save Hook
 * Fires when Claude writes or edits a file.
 * ✏️ Customize PATTERNS to match your output file types.
 */

const path = require('path');

const filePath = process.env.TOOL_INPUT_FILE_PATH || process.argv[2] || '';
const fileName = path.basename(filePath).toUpperCase();

// ✏️ Add your own file patterns here
// These are the file name patterns that should trigger a QC offer
const PATTERNS = [
  // 'REPORT', 'SUBMISSION', 'EXPORT', 'OUTPUT',
  // Add patterns specific to your domain
];

const OUTPUT_TYPES = ['.csv', '.txt', '.xlsx', '.json', '.pdf'];
const isOutputFile = OUTPUT_TYPES.some(ext => filePath.toLowerCase().endsWith(ext));
const isRelevant = PATTERNS.some(p => fileName.includes(p));

if (isRelevant && isOutputFile) {
  console.log(`
=== FILE ALERT ===
Output file detected: ${path.basename(filePath)}

Tell the user: "I noticed you just saved an output file.
Want me to review it before it goes out? Type /review and I will check it."
=== END ===
`);
}
