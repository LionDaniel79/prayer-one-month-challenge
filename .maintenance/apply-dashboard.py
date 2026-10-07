from hashlib import sha256
from pathlib import Path, PurePosixPath
import json
import os
import subprocess

if os.environ.get('GITHUB_REF') != 'refs/heads/feature/admin-dashboard-metrics':
    raise SystemExit('This source application is restricted to its isolated feature branch.')
root = Path.cwd().resolve()
entries = []
for number in range(6):
    entries.extend(json.loads((root / f'.maintenance/dashboard-edits-{number}.json').read_text(encoding='utf-8')))
if len(entries) != 40 or len({e['path'] for e in entries}) != 40:
    raise SystemExit('Unexpected source manifest count.')
allowed = {'app', 'components', 'src', 'tests', 'docs', 'drizzle', 'scripts', 'public'}
changes = []
for entry in entries:
    relative = PurePosixPath(entry['path'])
    if relative.is_absolute() or '..' in relative.parts or (relative.parts[0] not in allowed and str(relative) != 'README.md'):
        raise SystemExit('Unexpected source path.')
    path = root / relative
    if not path.resolve().is_relative_to(root) or path.is_symlink():
        raise SystemExit('Source path must stay in this repository.')
    old = path.read_text(encoding='utf-8') if path.exists() else ''
    if sha256(old.encode()).hexdigest() != entry['before']:
        raise SystemExit('Source changed before application: ' + str(relative))
    if 'content' in entry:
        new = entry['content']
    else:
        new = old
        previous = len(old)
        for start, end, replacement in reversed(entry['ops']):
            if not 0 <= start <= end <= previous:
                raise SystemExit('Overlapping source operation: ' + str(relative))
            new = new[:start] + replacement + new[end:]
            previous = start
    if sha256(new.encode()).hexdigest() != entry['after']:
        raise SystemExit('Output checksum mismatch: ' + str(relative))
    changes.append((path, new))
# All inputs and results have been verified before touching any source.
for path, content in changes:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content.encode('utf-8'))
subprocess.run(['git', 'diff', '--check'], check=True)
subprocess.run(['git', 'add', '--', *[e['path'] for e in entries]], check=True)
print('Verified and staged 40 source files on the isolated feature branch.')
