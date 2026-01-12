#!/usr/bin/env python3
"""
Manus-Conductor Integration
A Python helper for implementing Conductor's structured development workflow in Manus.
"""

import os
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple


class ManusCondor:
    """Main class for managing Conductor workflows in Manus."""
    
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root).resolve()
        self.conductor_dir = self.project_root / "conductor"
        self.tracks_dir = self.conductor_dir / "tracks"
        self.state_file = self.conductor_dir / "setup_state.json"
        self.tracks_file = self.conductor_dir / "tracks.md"
        
    def is_setup(self) -> bool:
        """Check if Conductor is properly set up."""
        required_files = [
            self.conductor_dir / "product.md",
            self.conductor_dir / "tech-stack.md",
            self.conductor_dir / "workflow.md",
        ]
        return all(f.exists() for f in required_files)
    
    def detect_project_type(self) -> Tuple[str, Dict]:
        """
        Detect if project is Greenfield (new) or Brownfield (existing).
        Returns: (project_type, metadata)
        """
        indicators = {
            "has_git": (self.project_root / ".git").exists(),
            "has_package_json": (self.project_root / "package.json").exists(),
            "has_requirements": (self.project_root / "requirements.txt").exists(),
            "has_pom": (self.project_root / "pom.xml").exists(),
            "has_go_mod": (self.project_root / "go.mod").exists(),
            "has_src": (self.project_root / "src").exists(),
            "has_app": (self.project_root / "app").exists(),
        }
        
        is_brownfield = any([
            indicators["has_git"],
            indicators["has_package_json"],
            indicators["has_requirements"],
            indicators["has_pom"],
            indicators["has_go_mod"],
            indicators["has_src"],
            indicators["has_app"],
        ])
        
        project_type = "Brownfield" if is_brownfield else "Greenfield"
        
        return project_type, indicators
    
    def init_conductor_structure(self):
        """Initialize the conductor directory structure."""
        self.conductor_dir.mkdir(exist_ok=True)
        self.tracks_dir.mkdir(exist_ok=True)
        (self.conductor_dir / "code_styleguides").mkdir(exist_ok=True)
        
        # Initialize state file
        if not self.state_file.exists():
            self.save_state("")
        
        # Initialize tracks file
        if not self.tracks_file.exists():
            self.tracks_file.write_text("# Tracks\n\nThis file contains all tracks for the project.\n\n")
    
    def save_state(self, step: str):
        """Save the current setup state."""
        state = {"last_successful_step": step}
        self.state_file.write_text(json.dumps(state, indent=2))
    
    def load_state(self) -> str:
        """Load the current setup state."""
        if self.state_file.exists():
            state = json.loads(self.state_file.read_text())
            return state.get("last_successful_step", "")
        return ""
    
    def create_product_md(self, content: str):
        """Create or update product.md file."""
        product_file = self.conductor_dir / "product.md"
        product_file.write_text(content)
        self.save_state("2.1_product_guide")
    
    def create_product_guidelines_md(self, content: str):
        """Create or update product-guidelines.md file."""
        guidelines_file = self.conductor_dir / "product-guidelines.md"
        guidelines_file.write_text(content)
        self.save_state("2.2_product_guidelines")
    
    def create_tech_stack_md(self, content: str):
        """Create or update tech-stack.md file."""
        tech_stack_file = self.conductor_dir / "tech-stack.md"
        tech_stack_file.write_text(content)
        self.save_state("2.3_tech_stack")
    
    def create_workflow_md(self, content: str):
        """Create or update workflow.md file."""
        workflow_file = self.conductor_dir / "workflow.md"
        workflow_file.write_text(content)
        self.save_state("2.5_workflow")
    
    def get_next_track_id(self) -> str:
        """Generate the next track ID."""
        if not self.tracks_dir.exists():
            return "track-001"
        
        existing_tracks = [d.name for d in self.tracks_dir.iterdir() if d.is_dir()]
        if not existing_tracks:
            return "track-001"
        
        # Extract numbers from track IDs
        numbers = []
        for track in existing_tracks:
            match = re.search(r'track-(\d+)', track)
            if match:
                numbers.append(int(match.group(1)))
        
        if numbers:
            next_num = max(numbers) + 1
            return f"track-{next_num:03d}"
        return "track-001"
    
    def create_track(self, description: str, spec_content: str, plan_content: str) -> str:
        """
        Create a new track with spec and plan.
        Returns: track_id
        """
        track_id = self.get_next_track_id()
        track_dir = self.tracks_dir / track_id
        track_dir.mkdir(exist_ok=True)
        
        # Create metadata
        metadata = {
            "id": track_id,
            "description": description,
            "created_at": datetime.now().isoformat(),
            "status": "pending"
        }
        (track_dir / "metadata.json").write_text(json.dumps(metadata, indent=2))
        
        # Create spec and plan
        (track_dir / "spec.md").write_text(spec_content)
        (track_dir / "plan.md").write_text(plan_content)
        
        # Update tracks.md
        self.add_track_to_registry(track_id, description)
        
        return track_id
    
    def add_track_to_registry(self, track_id: str, description: str):
        """Add a track to the tracks.md registry."""
        track_entry = f"\n---\n\n## [ ] Track: {description}\n\n**Folder:** [conductor/tracks/{track_id}](conductor/tracks/{track_id})\n\n"
        
        if self.tracks_file.exists():
            content = self.tracks_file.read_text()
            self.tracks_file.write_text(content + track_entry)
        else:
            self.tracks_file.write_text(f"# Tracks\n\nThis file contains all tracks for the project.\n{track_entry}")
    
    def parse_tracks(self) -> List[Dict]:
        """
        Parse the tracks.md file and return a list of tracks.
        Each track dict contains: {id, description, status, folder}
        """
        if not self.tracks_file.exists():
            return []
        
        content = self.tracks_file.read_text()
        sections = content.split("---")
        
        tracks = []
        for section in sections[1:]:  # Skip the header
            # Extract status and description from heading
            heading_match = re.search(r'##\s*\[([ ~x])\]\s*Track:\s*(.+)', section)
            if not heading_match:
                continue
            
            status_char = heading_match.group(1)
            description = heading_match.group(2).strip()
            
            # Map status character to status name
            status_map = {' ': 'pending', '~': 'in_progress', 'x': 'completed'}
            status = status_map.get(status_char, 'pending')
            
            # Extract folder link
            folder_match = re.search(r'\[conductor/tracks/([^\]]+)\]', section)
            track_id = folder_match.group(1) if folder_match else None
            
            if track_id:
                tracks.append({
                    'id': track_id,
                    'description': description,
                    'status': status,
                    'folder': f"conductor/tracks/{track_id}"
                })
        
        return tracks
    
    def get_track_by_id(self, track_id: str) -> Optional[Dict]:
        """Get a track by its ID."""
        tracks = self.parse_tracks()
        for track in tracks:
            if track['id'] == track_id:
                return track
        return None
    
    def get_next_pending_track(self) -> Optional[Dict]:
        """Get the next track that is not completed."""
        tracks = self.parse_tracks()
        for track in tracks:
            if track['status'] != 'completed':
                return track
        return None
    
    def update_track_status(self, track_id: str, new_status: str):
        """
        Update a track's status in tracks.md.
        new_status: 'pending', 'in_progress', or 'completed'
        """
        status_map = {'pending': ' ', 'in_progress': '~', 'completed': 'x'}
        status_char = status_map.get(new_status, ' ')
        
        content = self.tracks_file.read_text()
        
        # Find the track's description
        track = self.get_track_by_id(track_id)
        if not track:
            return
        
        description = track['description']
        
        # Replace the status marker
        old_pattern = r'##\s*\[[ ~x]\]\s*Track:\s*' + re.escape(description)
        new_heading = f"## [{status_char}] Track: {description}"
        
        content = re.sub(old_pattern, new_heading, content)
        self.tracks_file.write_text(content)
    
    def parse_plan(self, track_id: str) -> List[Dict]:
        """
        Parse a track's plan.md and return tasks.
        Each task dict contains: {phase, task, status, subtasks}
        """
        plan_file = self.tracks_dir / track_id / "plan.md"
        if not plan_file.exists():
            return []
        
        content = plan_file.read_text()
        lines = content.split('\n')
        
        tasks = []
        current_phase = None
        
        for line in lines:
            # Detect phase headers
            if line.startswith('## '):
                current_phase = line[3:].strip()
                continue
            
            # Detect tasks (- [ ] Task: ...)
            task_match = re.match(r'^-\s*\[([ ~x])\]\s*Task:\s*(.+)', line)
            if task_match:
                status_char = task_match.group(1)
                task_desc = task_match.group(2).strip()
                status_map = {' ': 'pending', '~': 'in_progress', 'x': 'completed'}
                status = status_map.get(status_char, 'pending')
                
                tasks.append({
                    'phase': current_phase,
                    'task': task_desc,
                    'status': status,
                    'subtasks': []
                })
                continue
            
            # Detect subtasks (    - [ ] ...)
            subtask_match = re.match(r'^\s{4}-\s*\[([ ~x])\]\s*(.+)', line)
            if subtask_match and tasks:
                status_char = subtask_match.group(1)
                subtask_desc = subtask_match.group(2).strip()
                status_map = {' ': 'pending', '~': 'in_progress', 'x': 'completed'}
                status = status_map.get(status_char, 'pending')
                
                tasks[-1]['subtasks'].append({
                    'subtask': subtask_desc,
                    'status': status
                })
        
        return tasks
    
    def get_next_pending_task(self, track_id: str) -> Optional[Dict]:
        """Get the next pending task from a track's plan."""
        tasks = self.parse_plan(track_id)
        for task in tasks:
            if task['status'] != 'completed':
                return task
        return None
    
    def update_task_status(self, track_id: str, task_description: str, new_status: str):
        """
        Update a task's status in plan.md.
        new_status: 'pending', 'in_progress', or 'completed'
        """
        plan_file = self.tracks_dir / track_id / "plan.md"
        if not plan_file.exists():
            return
        
        status_map = {'pending': ' ', 'in_progress': '~', 'completed': 'x'}
        status_char = status_map.get(new_status, ' ')
        
        content = plan_file.read_text()
        
        # Replace the task status
        old_pattern = r'-\s*\[[ ~x]\]\s*Task:\s*' + re.escape(task_description)
        new_task = f"- [{status_char}] Task: {task_description}"
        
        content = re.sub(old_pattern, new_task, content)
        plan_file.write_text(content)
    
    def get_project_status(self) -> Dict:
        """Get overall project status."""
        tracks = self.parse_tracks()
        
        total_tracks = len(tracks)
        completed_tracks = sum(1 for t in tracks if t['status'] == 'completed')
        in_progress_tracks = sum(1 for t in tracks if t['status'] == 'in_progress')
        pending_tracks = sum(1 for t in tracks if t['status'] == 'pending')
        
        return {
            'total_tracks': total_tracks,
            'completed': completed_tracks,
            'in_progress': in_progress_tracks,
            'pending': pending_tracks,
            'tracks': tracks
        }
    
    def load_context_files(self) -> Dict[str, str]:
        """Load all context files for reference."""
        context = {}
        
        files = {
            'product': self.conductor_dir / "product.md",
            'guidelines': self.conductor_dir / "product-guidelines.md",
            'tech_stack': self.conductor_dir / "tech-stack.md",
            'workflow': self.conductor_dir / "workflow.md",
        }
        
        for key, path in files.items():
            if path.exists():
                context[key] = path.read_text()
            else:
                context[key] = ""
        
        return context
    
    def load_track_context(self, track_id: str) -> Dict[str, str]:
        """Load spec and plan for a specific track."""
        track_dir = self.tracks_dir / track_id
        
        context = {
            'spec': '',
            'plan': '',
            'metadata': {}
        }
        
        spec_file = track_dir / "spec.md"
        plan_file = track_dir / "plan.md"
        metadata_file = track_dir / "metadata.json"
        
        if spec_file.exists():
            context['spec'] = spec_file.read_text()
        
        if plan_file.exists():
            context['plan'] = plan_file.read_text()
        
        if metadata_file.exists():
            context['metadata'] = json.loads(metadata_file.read_text())
        
        return context


def main():
    """CLI interface for testing."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python manus_conductor.py <command> [args]")
        print("Commands: detect, init, status")
        return
    
    conductor = ManusCondor()
    command = sys.argv[1]
    
    if command == "detect":
        project_type, indicators = conductor.detect_project_type()
        print(f"Project Type: {project_type}")
        print(f"Indicators: {json.dumps(indicators, indent=2)}")
    
    elif command == "init":
        conductor.init_conductor_structure()
        print("Conductor structure initialized")
    
    elif command == "status":
        if not conductor.is_setup():
            print("Conductor is not set up. Run setup first.")
            return
        
        status = conductor.get_project_status()
        print(json.dumps(status, indent=2))
    
    else:
        print(f"Unknown command: {command}")


if __name__ == "__main__":
    main()
