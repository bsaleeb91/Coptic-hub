#!/usr/bin/env node
/**
 * Session End Hook
 * Fires when Claude Code session ends.
 * Prompts agent to propose memory entries.
 */

const path = require('path');
const today = new Date().toISOString().split('T')[0];

try {
  console.log(`
=== AGENT SESSION END ===

Review everything discussed in this session and ask:
"Want me to update memory with anything from this session?"

If yes, propose entries in this format:
(${today}) [Domain] Lesson: what was learned or confirmed

Also check: does anything in these files need updating?
- agent-skill/references/DOMAIN.md
- agent-skill/references/RULES.md
- agent-skill/references/REPORTS.md
- agent-skill/references/TEAM.md

Tell the user: "Copy any entries into agent-skill/references/MEMORY.md to save them."
Agent never writes files directly — always propose, user commits.
=== END ===
`);
  process.exit(0);
} catch (err) {
  process.stderr.write('Hook error: ' + err.message + '\n');
  process.exit(0);
}
