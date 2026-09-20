from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MEMORIES_DIR = ROOT / 'memories'
OUTPUT_FILE = ROOT / 'memories.json'


def get_image_entries(folder: Path):
    if not folder.exists():
        return []

    files = []
    for item in sorted(folder.iterdir()):
        if item.is_file() and item.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp', '.gif'}:
            files.append({
                'title': item.stem,
                'description': 'A memory from this day.',
                'image': f'memories/{folder.name}/{item.name}'
            })
    return files


def build_schedule():
    schedule = {}
    if not MEMORIES_DIR.exists():
        return schedule

    for folder in sorted(MEMORIES_DIR.iterdir()):
        if folder.is_dir():
            date_key = folder.name
            images = get_image_entries(folder)
            if images:
                schedule[date_key] = images
    return schedule


def main():
    schedule = build_schedule()
    OUTPUT_FILE.write_text(json.dumps(schedule, indent=2), encoding='utf-8')
    print(f'Wrote {len(schedule)} memory dates to {OUTPUT_FILE.name}')


if __name__ == '__main__':
    main()
