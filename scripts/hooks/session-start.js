#!/usr/bin/env node
/**
 * KYRIE Session Start Hook
 * Fires when Claude Code session begins in Coptic-hub.
 * Injects date, MEMORY.md lessons, Coptic fasting reminder, and commit status prompt.
 */

const fs = require('fs');
const path = require('path');

const AGENT_ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_FILE = path.join(AGENT_ROOT, 'agent-skill', 'references', 'MEMORY.md');

// Coptic fasting days (simplified — Wednesday and Friday every week)
function getCopticFastingReminder(dayName) {
  if (dayName === 'Wednesday') return 'Today is Wednesday — a Coptic fasting day (no animal products until Ninth Hour).';
  if (dayName === 'Friday') return 'Today is Friday — a Coptic fasting day (no animal products until Ninth Hour).';
  return '';
}

try {
  const today = new Date();
  const fullDate = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const fastingReminder = getCopticFastingReminder(dayName);

  let memoryContent = '';
  if (fs.existsSync(MEMORY_FILE)) {
    memoryContent = fs.readFileSync(MEMORY_FILE, 'utf8');
  }

  const context = [
    '=== KYRIE SESSION START ===',
    'Date: ' + fullDate,
    fastingReminder,
    '',
    'You are KYRIE — the Claude Code development partner for the Coptic Hub React Native app.',
    'Read agent-skill/SKILL.md, then agent-skill/references/MEMORY.md and ROADMAP.md (repo root) before responding.',
    'Greet Bishoy with today\'s date, state the current commit status from ROADMAP.md, and ask what he needs.',
    '',
    memoryContent ? '--- LESSONS FROM PAST SESSIONS ---\n' + memoryContent + '\n---' : '',
    '=== END KYRIE SESSION START ==='
  ].filter(Boolean).join('\n');

  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context
    }
  };

  process.stdout.write(JSON.stringify(output) + '\n');
  process.exit(0);

} catch (err) {
  process.stderr.write('KYRIE hook error: ' + err.message + '\n');
  process.exit(0);
}
