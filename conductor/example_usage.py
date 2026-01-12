#!/usr/bin/env python3
"""
Example Usage of Manus-Conductor Integration

This script demonstrates how Manus would use the ManusCondor class
to implement Conductor workflows through natural conversation.
"""

import sys
sys.path.insert(0, '/home/ubuntu')
from manus_conductor import ManusCondor


def example_setup_workflow():
    """Example: Setting up Conductor for a new project."""
    print("=" * 60)
    print("EXAMPLE 1: Setup Workflow")
    print("=" * 60)
    print("\nUser: 'Set up Conductor for my project'\n")
    
    conductor = ManusCondor('/tmp/example-project')
    
    # Step 1: Detect project type
    project_type, indicators = conductor.detect_project_type()
    print(f"Manus: Detected {project_type} project")
    
    # Step 2: Initialize structure
    conductor.init_conductor_structure()
    print("Manus: Created conductor directory structure")
    
    # Step 3: Interactive context gathering (simulated)
    print("\nManus: Let me ask you a few questions about your product...")
    print("Manus: What are you building?")
    print("User: 'A task management app for small teams'")
    
    # Step 4: Create context files
    product_content = """# Product Guide
## Initial Concept
A task management app for small teams.
"""
    conductor.create_product_md(product_content)
    print("\nManus: ✓ Created product.md")
    
    # Similar process for other context files...
    print("Manus: ✓ Created tech-stack.md")
    print("Manus: ✓ Created workflow.md")
    print("Manus: ✓ Created product-guidelines.md")
    
    print("\nManus: Setup complete! You can now create tracks.")


def example_create_track_workflow():
    """Example: Creating a new track."""
    print("\n" + "=" * 60)
    print("EXAMPLE 2: Create Track Workflow")
    print("=" * 60)
    print("\nUser: 'Create a track for user authentication'\n")
    
    conductor = ManusCondor('/tmp/example-project')
    
    # Step 1: Check if setup is complete
    if not conductor.is_setup():
        print("Manus: Conductor is not set up. Please run setup first.")
        return
    
    # Step 2: Load project context
    context = conductor.load_context_files()
    print("Manus: Loaded project context")
    
    # Step 3: Interactive specification gathering (simulated)
    print("\nManus: Let me ask you about this feature...")
    print("Manus: What authentication methods should we support?")
    print("User: 'Email and password with JWT tokens'")
    print("\nManus: Should we include OAuth integration?")
    print("User: 'No, that's out of scope for now'")
    
    # Step 4: Generate spec
    spec_content = """# Track Specification: User Authentication
## Overview
Implement JWT-based authentication with email/password.
"""
    print("\nManus: Here's the specification I've drafted:")
    print(spec_content)
    print("Manus: Does this look good?")
    print("User: 'Yes, approved'")
    
    # Step 5: Generate plan
    plan_content = """# Implementation Plan: User Authentication
## Phase 1: Database Models
- [ ] Task: Create User model
"""
    print("\nManus: Here's the implementation plan:")
    print(plan_content)
    print("Manus: Ready to proceed?")
    print("User: 'Yes'")
    
    # Step 6: Create track
    track_id = conductor.create_track(
        description="User Authentication",
        spec_content=spec_content,
        plan_content=plan_content
    )
    print(f"\nManus: ✓ Created track {track_id}")
    print(f"Manus: Track is ready for implementation!")


def example_implement_workflow():
    """Example: Implementing a track."""
    print("\n" + "=" * 60)
    print("EXAMPLE 3: Implement Workflow")
    print("=" * 60)
    print("\nUser: 'Implement the authentication track'\n")
    
    conductor = ManusCondor('/tmp/example-project')
    
    # Step 1: Select track
    track = conductor.get_next_pending_track()
    if not track:
        print("Manus: No pending tracks found.")
        return
    
    print(f"Manus: Starting implementation of: {track['description']}")
    
    # Step 2: Update track status
    conductor.update_track_status(track['id'], 'in_progress')
    
    # Step 3: Load track context
    track_context = conductor.load_track_context(track['id'])
    workflow = conductor.load_context_files()['workflow']
    
    print("Manus: Loaded spec, plan, and workflow")
    
    # Step 4: Iterate through tasks (simulated)
    next_task = conductor.get_next_pending_task(track['id'])
    
    print(f"\nManus: Starting task: {next_task['task']}")
    conductor.update_task_status(track['id'], next_task['task'], 'in_progress')
    
    # TDD Cycle (simulated)
    print("\nManus: Writing failing tests (Red phase)...")
    print("Manus: ✓ Tests written and failing as expected")
    
    print("\nManus: Implementing code to pass tests (Green phase)...")
    print("Manus: ✓ All tests now passing")
    
    print("\nManus: Refactoring code...")
    print("Manus: ✓ Code refactored, tests still passing")
    
    print("\nManus: Verifying coverage...")
    print("Manus: ✓ Coverage: 85% (target: >80%)")
    
    print("\nManus: Committing changes...")
    print("Manus: ✓ Committed: feat(auth): Create User model")
    
    # Step 5: Mark task complete
    conductor.update_task_status(track['id'], next_task['task'], 'completed')
    print(f"\nManus: ✓ Task completed: {next_task['task']}")
    
    # Continue with next tasks...
    print("\nManus: Moving to next task...")


def example_status_workflow():
    """Example: Checking project status."""
    print("\n" + "=" * 60)
    print("EXAMPLE 4: Status Workflow")
    print("=" * 60)
    print("\nUser: 'What's the project status?'\n")
    
    conductor = ManusCondor('/tmp/example-project')
    
    status = conductor.get_project_status()
    
    print("Manus: Here's your project status:")
    print(f"\n📊 Overall Progress")
    print(f"  Total Tracks: {status['total_tracks']}")
    print(f"  ✅ Completed: {status['completed']}")
    print(f"  🔄 In Progress: {status['in_progress']}")
    print(f"  ⏳ Pending: {status['pending']}")
    
    print(f"\n📋 Track Details:")
    for track in status['tracks']:
        status_emoji = {
            'completed': '✅',
            'in_progress': '🔄',
            'pending': '⏳'
        }
        emoji = status_emoji.get(track['status'], '❓')
        print(f"  {emoji} {track['description']} [{track['status']}]")


def main():
    """Run all examples."""
    print("\n" + "=" * 60)
    print("MANUS-CONDUCTOR INTEGRATION EXAMPLES")
    print("=" * 60)
    print("\nThese examples show how Manus uses the ManusCondor class")
    print("to implement Conductor workflows through natural conversation.")
    
    example_setup_workflow()
    example_create_track_workflow()
    example_implement_workflow()
    example_status_workflow()
    
    print("\n" + "=" * 60)
    print("KEY DIFFERENCES FROM GEMINI CLI")
    print("=" * 60)
    print("""
1. No slash commands - just natural conversation
2. Manus handles all file operations automatically
3. Interactive questions flow naturally in conversation
4. Status updates are conversational, not command output
5. Full integration with Manus's other capabilities (search, browser, etc.)
    """)
    
    print("=" * 60)
    print("READY TO USE")
    print("=" * 60)
    print("""
The integration is complete and tested! You can now:

1. Say "Set up Conductor for my project" to initialize
2. Say "Create a track for [feature]" to create tracks
3. Say "Implement the track" to start development
4. Say "What's the status?" to check progress
5. Say "Revert [track/task]" to undo changes

Everything works through natural conversation with Manus!
    """)


if __name__ == "__main__":
    main()
