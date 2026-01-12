# Manus-Conductor Quick Reference

## What You Say to Manus

### Setup (Run Once)
```
"Set up Conductor for my project"
"Initialize Conductor"
"I want to use Conductor for this project"
```

### Create a Track
```
"Create a track for [feature description]"
"Add a new feature: [description]"
"I need to implement [feature]"
```

### Implement a Track
```
"Implement the [feature] track"
"Start implementing"
"Work on the authentication track"
```

### Check Status
```
"What's the project status?"
"Show me the tracks"
"What's in progress?"
```

### Revert Changes
```
"Revert the [feature] track"
"Undo the last task"
"Roll back the authentication changes"
```

---

## What Manus Does

### During Setup
1. ✓ Detects project type (new or existing)
2. ✓ Analyzes existing code (if applicable)
3. ✓ Asks about product vision
4. ✓ Asks about tech stack
5. ✓ Asks about workflow preferences
6. ✓ Creates conductor directory structure
7. ✓ Generates context files

### During Track Creation
1. ✓ Loads project context
2. ✓ Asks clarifying questions about the feature
3. ✓ Generates detailed specification
4. ✓ Shows spec for your approval
5. ✓ Generates implementation plan
6. ✓ Shows plan for your approval
7. ✓ Creates track folder with spec and plan

### During Implementation
1. ✓ Loads track spec and plan
2. ✓ Loads workflow methodology
3. ✓ For each task:
   - Writes failing tests (Red phase)
   - Implements code to pass tests (Green phase)
   - Refactors code (optional)
   - Verifies code coverage
   - Commits changes
   - Marks task complete
4. ✓ Updates track status
5. ✓ Synchronizes documentation

---

## File Structure

```
your-project/
└── conductor/
    ├── product.md              # What you're building
    ├── product-guidelines.md   # Design standards
    ├── tech-stack.md          # Technologies used
    ├── workflow.md            # How you work
    ├── tracks.md              # List of all tracks
    └── tracks/
        └── track-001/
            ├── spec.md        # What to build
            └── plan.md        # How to build it
```

---

## Key Concepts

### Track
A high-level unit of work (feature, bug fix, chore)

### Spec
Detailed requirements and acceptance criteria

### Plan
Hierarchical breakdown: Phases → Tasks → Sub-tasks

### TDD Workflow
1. Red: Write failing tests
2. Green: Make tests pass
3. Refactor: Improve code quality

---

## Status Indicators

- `[ ]` Pending
- `[~]` In Progress
- `[x]` Completed

---

## Tips

✅ **Review specs and plans** before implementation  
✅ **Trust the TDD process** - tests first, then code  
✅ **Keep context updated** - it guides all development  
✅ **Use natural language** - no commands to memorize  
✅ **Check status often** - stay aware of progress  

---

## Common Questions

**Q: Can I modify the spec after starting?**  
A: Yes, just ask Manus to update it

**Q: Can I work on multiple tracks?**  
A: Yes, but implement one at a time

**Q: What if tests fail?**  
A: Manus will debug and fix them automatically

**Q: Can I customize the workflow?**  
A: Yes, edit `conductor/workflow.md` or ask Manus

**Q: Do I need to know Git?**  
A: No, Manus handles all Git operations

---

## Getting Started Checklist

- [ ] Say "Set up Conductor for my project"
- [ ] Answer questions about your product
- [ ] Review generated context files
- [ ] Create your first track
- [ ] Review and approve spec and plan
- [ ] Start implementation
- [ ] Check status to see progress

---

## Example Session

```
You: "Set up Conductor for my task management app"
Manus: "Great! Let me ask you a few questions..."
[Interactive Q&A]
Manus: "Setup complete! Ready to create your first track?"

You: "Yes, add user authentication"
Manus: "What authentication methods should we support?"
You: "Email and password with JWT"
[More Q&A]
Manus: "Here's the spec... Does this look good?"
You: "Yes"
Manus: "Here's the plan... Ready to implement?"
You: "Yes"

Manus: [Implements following TDD]
Manus: "Track complete! All tests passing. Next track?"
```

---

## Need Help?

Just ask Manus:
- "How does Conductor work?"
- "Show me the current track"
- "What's next in the plan?"
- "Explain the workflow"

---

**Remember**: No commands to memorize. Just talk to Manus naturally!
