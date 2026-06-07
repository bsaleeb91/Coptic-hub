---
name: review
description: Review and QC something before it goes out — attach the item and the agent checks it against all relevant rules and specs
---
Review the attached or specified item before it goes out.

Steps:
1. Identify what is being reviewed and what it is for
2. Read agent-skill/references/RULES.md for the QC checklist
3. Read agent-skill/references/DOMAIN.md for domain standards
4. Invoke the reviewer agent to run the full review
5. Invoke the reflector agent to verify the review itself is complete

Return a structured QC report:
🔴 ERRORS — must fix before proceeding (with exact location and fix)
⚠️ WARNINGS — flag for awareness
✅ PASSED — what was verified

If no item is provided, ask: "What would you like me to review?"
