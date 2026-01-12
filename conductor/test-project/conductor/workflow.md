# Development Workflow

## Guiding Principles

1. **The Plan is the Source of Truth**: All work must be tracked in `plan.md`
2. **Test-Driven Development**: Write unit tests before implementing functionality
3. **High Code Coverage**: Aim for >80% code coverage for all modules
4. **Clear Commits**: Each commit should represent a logical unit of work

## Task Workflow

1. **Select Task**: Choose the next available task from `plan.md`
2. **Mark In Progress**: Change task from `[ ]` to `[~]`
3. **Write Failing Tests (Red Phase)**: Create tests that define expected behavior
4. **Implement to Pass Tests (Green Phase)**: Write minimum code to pass tests
5. **Refactor**: Improve code quality while maintaining passing tests
6. **Verify Coverage**: Ensure >80% coverage for new code
7. **Commit Changes**: Use clear, descriptive commit messages
8. **Mark Complete**: Change task from `[~]` to `[x]`

## Commit Message Format

- `feat(scope): description` - New features
- `fix(scope): description` - Bug fixes
- `test(scope): description` - Test additions/changes
- `refactor(scope): description` - Code refactoring
- `docs(scope): description` - Documentation updates
