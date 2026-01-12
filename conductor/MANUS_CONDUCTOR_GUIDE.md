# Manus-Conductor User Guide

## Overview

**Manus-Conductor** brings the structured, spec-driven development methodology of Conductor to Manus AI. Instead of using CLI commands, you interact with Conductor through natural conversation with Manus.

## What is Conductor?

Conductor is a development workflow framework that helps you:

- **Define clear specifications** before writing code
- **Follow Test-Driven Development (TDD)** systematically
- **Track progress** through hierarchical task structures
- **Maintain documentation** that stays synchronized with your code
- **Work as a team** with shared context and standards

## Core Concepts

### Tracks

A **track** is a high-level unit of work—typically a feature, bug fix, or chore. Each track contains:

- **Specification (`spec.md`)**: Detailed requirements, acceptance criteria, and scope
- **Plan (`plan.md`)**: Hierarchical breakdown into phases, tasks, and sub-tasks
- **Metadata**: Track ID, creation date, and status

### Project Context

Conductor maintains several context files that guide all development:

- **`product.md`**: Product vision, target users, goals, and features
- **`product-guidelines.md`**: Design standards, brand messaging, visual identity
- **`tech-stack.md`**: Technology decisions, frameworks, databases, and architecture
- **`workflow.md`**: Development methodology (TDD, commit strategy, testing approach)
- **`tracks.md`**: Registry of all tracks with their current status

### Workflow

The default workflow follows **Test-Driven Development (TDD)**:

1. **Red Phase**: Write failing tests that define expected behavior
2. **Green Phase**: Implement minimum code to make tests pass
3. **Refactor**: Improve code quality while maintaining passing tests
4. **Commit**: Save changes with clear, descriptive messages

## How to Use Manus-Conductor

### 1. Setup Your Project

**What you say:**
> "Set up Conductor for my project"

**What Manus does:**
1. Detects if your project is new (Greenfield) or existing (Brownfield)
2. For existing projects, analyzes your codebase to understand context
3. Guides you through interactive questions to define:
   - Product vision and goals
   - Design guidelines
   - Technology stack
   - Development workflow
4. Creates the conductor directory structure
5. Generates initial documentation files

**Result:** Your project now has a `conductor/` directory with all context files.

---

### 2. Create a New Track

**What you say:**
> "Create a new track for adding user authentication"

or simply:
> "Add user authentication"

**What Manus does:**
1. Loads your project context
2. Asks clarifying questions about the feature:
   - What authentication methods? (Email/password, OAuth, etc.)
   - What user roles are needed?
   - What security requirements?
   - What's the expected user flow?
3. Generates a detailed specification (`spec.md`)
4. Shows you the spec for review and approval
5. Creates an implementation plan (`plan.md`) with phases and tasks
6. Shows you the plan for review and approval
7. Adds the track to the registry

**Result:** A new track folder with spec and plan, ready for implementation.

---

### 3. Implement a Track

**What you say:**
> "Implement the authentication track"

or simply:
> "Start implementing"

**What Manus does:**
1. Loads the track's spec and plan
2. Loads the workflow methodology
3. Iterates through each task in order:
   - Marks task as "in progress"
   - Writes failing tests (Red phase)
   - Implements code to pass tests (Green phase)
   - Refactors if needed
   - Verifies code coverage
   - Commits changes with descriptive message
   - Marks task as "completed"
4. Updates the track status to "completed" when all tasks are done
5. Synchronizes project documentation with changes

**Result:** Feature implemented following TDD, with all tests passing and documentation updated.

---

### 4. Check Status

**What you say:**
> "What's the project status?"

or:
> "Show me the tracks"

**What Manus does:**
1. Reads the tracks registry
2. Summarizes:
   - Total number of tracks
   - Completed, in-progress, and pending tracks
   - Details of each track
3. Shows the current task for any in-progress tracks

**Result:** Clear overview of project progress.

---

### 5. Revert Changes

**What you say:**
> "Revert the authentication track"

or:
> "Undo the last task"

**What Manus does:**
1. Analyzes Git history to find commits related to the track/task
2. Shows you what will be reverted
3. Asks for confirmation
4. Performs git revert for the logical unit of work
5. Updates track/task status accordingly

**Result:** Changes cleanly reverted while preserving Git history.

---

## Example Workflow

### Starting a New Project

```
You: "I want to build a task management app with Conductor"

Manus: "Great! I'll set up Conductor for your project. First, let me ask a few questions..."

[Interactive Q&A about product, tech stack, workflow]

Manus: "Perfect! I've created your project context. Here's what we have:
- Product: Task management app for small teams
- Tech Stack: React, Node.js, PostgreSQL
- Workflow: TDD with Jest and Cypress
Would you like to create your first track?"

You: "Yes, create a track for the basic task CRUD operations"

Manus: "I'll help you spec this out. What fields should a task have?"

[Interactive Q&A about the feature]

Manus: "Here's the specification I've drafted... [shows spec]
Does this look good?"

You: "Yes, looks great"

Manus: "Excellent! Here's the implementation plan... [shows plan]
Ready to implement?"

You: "Yes, let's do it"

Manus: [Implements following TDD, commits changes, updates status]

"The task CRUD track is complete! All tests passing. 
Would you like to create another track?"
```

---

## Directory Structure

After setup, your project will have:

```
your-project/
├── conductor/
│   ├── product.md                    # Product vision and goals
│   ├── product-guidelines.md         # Design standards
│   ├── tech-stack.md                 # Technology decisions
│   ├── workflow.md                   # Development methodology
│   ├── tracks.md                     # Track registry
│   ├── setup_state.json              # Setup progress state
│   ├── code_styleguides/             # Language-specific style guides
│   │   ├── python.md
│   │   ├── javascript.md
│   │   └── ...
│   └── tracks/                       # Individual track folders
│       ├── track-001/
│       │   ├── metadata.json         # Track metadata
│       │   ├── spec.md               # Detailed specification
│       │   └── plan.md               # Implementation plan
│       ├── track-002/
│       └── ...
├── src/                              # Your application code
├── tests/                            # Your tests
└── ...
```

---

## Key Benefits

### 1. **Clear Specifications**
Never start coding without knowing exactly what you're building. Every track has a detailed spec approved by you.

### 2. **Systematic Testing**
TDD is built into the workflow. Tests are written first, ensuring high code coverage and confidence.

### 3. **Progress Tracking**
Always know what's done, what's in progress, and what's next. No more lost context.

### 4. **Team Alignment**
Project context files ensure everyone understands the product, tech stack, and workflow.

### 5. **Living Documentation**
Documentation stays synchronized with your code automatically. No more outdated docs.

### 6. **Intelligent Revert**
Undo entire features or specific tasks, not just individual commits. Conductor understands logical units of work.

---

## Tips for Success

### 1. **Be Thorough During Setup**
Take time to define your product vision, tech stack, and workflow clearly. This context guides all future development.

### 2. **Review Specs and Plans**
Always review and approve specs and plans before implementation. This is your chance to catch issues early.

### 3. **Trust the TDD Process**
Writing tests first feels slower initially but leads to better code and fewer bugs.

### 4. **Keep Context Updated**
If your tech stack or workflow changes, update the context files. Conductor uses these to guide implementation.

### 5. **Use Natural Language**
You don't need to memorize commands. Just tell Manus what you want in plain English.

---

## Advanced Features

### Brownfield Projects

For existing projects, Conductor analyzes your codebase to understand:
- Current tech stack from manifest files
- Architecture from directory structure
- Project goals from README

This allows Conductor to adapt to your existing project rather than forcing a new structure.

### Custom Workflows

The default workflow uses TDD, but you can customize it during setup or by editing `conductor/workflow.md`. Define your own:
- Testing strategy
- Commit conventions
- Code review process
- Deployment procedures

### Phase Verification

Conductor can pause at the end of each phase for manual verification. This ensures quality gates are met before moving forward.

### Multiple Tracks

Work on multiple tracks simultaneously. Conductor tracks the status of each independently.

---

## Troubleshooting

### "Conductor is not set up"
**Solution:** Run setup first by saying "Set up Conductor for my project"

### "No tracks found"
**Solution:** Create a track by saying "Create a new track for [feature description]"

### "Tests are failing"
**Solution:** Manus will automatically debug and fix failing tests during implementation. If issues persist, you can guide Manus with specific instructions.

### "I want to change the workflow"
**Solution:** Edit `conductor/workflow.md` or ask Manus to update it for you.

---

## Comparison: Gemini CLI vs Manus

| Aspect | Gemini CLI | Manus-Conductor |
|--------|------------|-----------------|
| **Interface** | Slash commands | Natural conversation |
| **Setup** | `/conductor:setup` | "Set up Conductor" |
| **New Track** | `/conductor:newTrack "description"` | "Create a track for [description]" |
| **Implement** | `/conductor:implement` | "Implement the track" |
| **Status** | `/conductor:status` | "What's the status?" |
| **Revert** | `/conductor:revert` | "Revert the [track/task]" |
| **Learning Curve** | Need to learn commands | Just talk naturally |
| **Flexibility** | Fixed command structure | Adapt to your phrasing |
| **Context** | CLI-based | Full Manus capabilities (search, browser, etc.) |

---

## Getting Started Checklist

- [ ] Say "Set up Conductor for my project" to initialize
- [ ] Answer questions about your product and tech stack
- [ ] Review and approve the generated context files
- [ ] Create your first track
- [ ] Review and approve the spec and plan
- [ ] Start implementation
- [ ] Watch Manus follow TDD to build your feature
- [ ] Check status to see progress
- [ ] Create more tracks as needed

---

## Support

For questions about Manus-Conductor, you can:
- Ask Manus directly during your session
- Review the generated context files in `conductor/`
- Check the original Conductor documentation at https://github.com/gemini-cli-extensions/conductor

---

## Summary

Manus-Conductor brings structured, spec-driven development to your AI-assisted workflow. By combining Conductor's methodology with Manus's natural language interface and powerful capabilities, you get:

✅ Clear specifications before coding  
✅ Systematic test-driven development  
✅ Automatic progress tracking  
✅ Living documentation  
✅ Team alignment through shared context  
✅ Intelligent version control  

All through simple, natural conversation.

**Ready to get started? Just say: "Set up Conductor for my project"**
