---
name: goal
description: Give the agent a multi-step goal to execute autonomously using the full Observe-Plan-Act-Reflect loop
---
Execute the stated goal autonomously.

Steps:
1. Invoke the planner agent — break the goal into concrete steps
2. For each step: observe → act → check result → adapt if needed
3. Invoke the reflector agent before presenting final output
4. Report results:
   ✅ What was completed
   🔴 What needs human action
   ⚠️ Anything unexpected found
5. Propose memory entries if anything new was learned

Do not skip planner or reflector.
Maximum 2 retries per step before escalating to human.
Always tell the user what needs human action at the end.
