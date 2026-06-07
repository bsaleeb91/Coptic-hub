---
name: status
description: Show current status of tasks, reports, or data — what's done, what's pending, what's overdue
---
Give a full status update.

Steps:
1. Read agent-skill/references/REPORTS.md
2. Check any live data sources for current state
3. Return a structured summary:
   ✅ Complete / running clean
   ⏳ In progress / due soon
   🔴 Overdue or blocked
   🔵 In development

Keep it short — one line per item.
If nothing is tracked in REPORTS.md, say so and ask what to check.
