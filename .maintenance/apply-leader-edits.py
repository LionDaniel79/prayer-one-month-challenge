"""One-time, hash-checked source transport on the isolated feature branch only."""
import hashlib
import json
from pathlib import Path

planned = []
seen = set()
for recipe in sorted(Path('.maintenance').glob('leader-edit-*.json')):
    for entry in json.loads(recipe.read_text(encoding='utf-8')):
        path = Path(entry['path'])
        if path.is_absolute() or '..' in path.parts or path.parts[0] not in ('app', 'components', 'public', 'src', 'tests') or path in seen:
            raise ValueError('Invalid or duplicate source path')
        seen.add(path)
        old = path.read_bytes()
        if hashlib.sha256(old).hexdigest() != entry['before']:
            raise ValueError(f'Base checksum mismatch: {path}')
        lines = old.decode('utf-8').splitlines(keepends=True)
        for start, end, replacement in reversed(entry['ops']):
            if not 0 <= start <= end <= len(lines):
                raise ValueError('Invalid source range')
            lines[start:end] = replacement.splitlines(keepends=True)
        new = ''.join(lines).encode('utf-8')
        if hashlib.sha256(new).hexdigest() != entry['after']:
            raise ValueError(f'Result checksum mismatch: {path}')
        planned.append((path, new))
for path, new in planned:
    path.write_bytes(new)
print(f'Applied {len(planned)} verified source changes.')
