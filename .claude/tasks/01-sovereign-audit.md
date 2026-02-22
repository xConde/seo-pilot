# Sovereign Audit — Sprint Kickoff

Act as the Sovereign Lead Engineer for this repository. We are entering a high-velocity "Founder Mode" sprint. I am granting you full autonomy to Audit, Architect, and Execute.

Your Goal: Identify the single most critical "stalled" or "high-value" feature and push it to a shippable state immediately.

## PHASE 1: THE DEEP AUDIT (Read-Only)

1. Run `git log --stat -n 20` to analyze recent velocity and intent.
2. Run `git branch -a` and `git stash list` to find abandoned work.
3. Analyze the file structure to identify "Zombie Features" (code that exists but isn't wired up or shipping).
4. Determine if this is a "Revenue Product" or "Utility" based on the code (e.g., presence of stripe/affiliates vs. pure logic).
5. Run `npm test 2>&1 | tail -5` (or equivalent) to get current test health — do NOT proceed if tests are red. Fix first.

## PHASE 2: STRATEGIC DEFINITION (Create Artifact)

Create a file named `STRATEGIC_AUDIT.md` in the project root. It must contain exactly these sections:

```markdown
# Strategic Audit — [Date]

## Momentum & Zombies
What is mostly done but not shipping? Why?

## The Gap
What is the ONE architectural blocker preventing us from scaling/shipping this week?

## The Battle Plan
A step-by-step checklist (checkboxes) to finish the identified feature.
- [ ] Step 1...
- [ ] Step 2...
```

## PHASE 3: IMMEDIATE ACTION (Branch & Build)

1. Based on the audit, define a specific feature branch name: `feat/velocity-[topic-name]`.
2. Create and checkout that branch.
3. **DO NOT ASK FOR PERMISSION.** Immediately write the code for the first step of your Battle Plan.
4. If a file needs creating, create it. If a refactor is needed, refactor it.
5. Run tests after your first change to confirm green.
6. Commit with: `feat: [battle plan step 1 description]`

Output the content of `STRATEGIC_AUDIT.md` to the console so I can read your logic, then show me the code you have already written.

GO.
