# Closer Protocol — Autonomous Execution

Excellent work. You have demonstrated architectural discipline.

## Step 1: Lock It In

Commit the Red Team fixes immediately:

```bash
git commit -am "refactor: apply red-team hardening"
```

## Step 2: The "Closer" Protocol (Autonomous Mode)

We are no longer doing one step at a time. I am authorizing you to **complete the feature fully** within this branch.

### UPDATE PLAN

Open `STRATEGIC_AUDIT.md`. Append a section called `## Deployment Checklist`. List the 3-5 remaining concrete steps to take this from "started" to "shippable."

Format as checkboxes:

```markdown
## Deployment Checklist
- [ ] Step 1: [specific action]
- [ ] Step 2: [specific action]
- [ ] Step 3: [specific action]
```

### EXECUTE LOOP

For each item on the checklist:

1. **Code it.** Write the implementation.
2. **Verify it.** Run tests — must be green before moving on.
3. **Check it off.** Update `STRATEGIC_AUDIT.md` with `[x]`.
4. **Commit it.** Use semantic prefix: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
5. **Next.** Move to the next item immediately.

### CONSTRAINTS

- Do not stop to ask for feedback unless you hit a critical blocker or need a new dependency.
- Do not refactor code outside the branch scope.
- If a step takes more than 3 attempts to pass tests, pause and document the blocker in `STRATEGIC_AUDIT.md` before continuing to the next item.
- You have the con.

START NOW.
