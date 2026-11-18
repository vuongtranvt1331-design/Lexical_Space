"""Prepare static dictation lessons locally. Read lesson pages only, never MP3s."""
import argparse
import json
import re
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit

from quick_ears_lessons import ROOT, read_lesson

APP = ROOT / 'apps/quick-ears'
DEST = APP / 'lesson-packs'


def valid(rows):
    return isinstance(rows, list) and bool(rows) and all(
        isinstance(row, dict) and isinstance(row.get('answer'), str) and row['answer'].strip()
        and isinstance(row.get('audio'), str) and urlsplit(row['audio']).scheme == 'https'
        for row in rows)


def write_json(path, value):
    data = (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    if path.exists() and path.read_bytes() == data:
        return
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as tmp:
        tmp.write(data)
    Path(tmp.name).replace(path)


def prepare(item, refresh, rate_limit):
    slug = item['slug']
    if not re.fullmatch(r'[a-zA-Z0-9_-]+(?:[.-][a-zA-Z0-9_-]+)*', slug):
        return slug, False, 'invalid slug'
    path = DEST / (slug + '.json')
    existing = False
    try:
        existing = valid(json.loads(path.read_bytes()))
    except (OSError, ValueError):
        pass
    if existing and not refresh:
        return slug, True, ''
    if rate_limit:
        return slug, existing, 'deferred'
    time.sleep(1)
    for attempt in range(2):
        try:
            rows = json.loads(read_lesson(slug))
            if not valid(rows):
                raise ValueError('incomplete lesson')
            write_json(path, rows)
            return slug, True, ''
        except (HTTPError, URLError, OSError, ValueError, KeyError, TypeError) as exc:
            if isinstance(exc, HTTPError) and exc.code == 429:
                retry = exc.headers.get('Retry-After', '')
                rate_limit.append(retry or 'later')
                return slug, existing, 'rate limited'
            if attempt or isinstance(exc, HTTPError) and exc.code < 500:
                return slug, existing, str(exc)
            time.sleep(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='also recheck previously packed lessons')
    args = parser.parse_args()
    catalog = json.loads((APP / 'lessons.json').read_bytes())
    DEST.mkdir(exist_ok=True)
    available, errors = [], []
    rate_limit = []
    for index, item in enumerate(catalog, 1):
        slug, ready, error = prepare(item, args.refresh, rate_limit)
        if ready:
            available.append(slug)
        if error and error != 'deferred':
            errors.append((slug, error))
        if index % 100 == 0:
            print(f'{index}/{len(catalog)} checked', flush=True)
    if rate_limit:
        print('Source rate limit reached. Retry after:', rate_limit[0], file=sys.stderr)
    write_json(DEST / 'available.json', available)
    for slug, message in errors:
        print(f'{slug}: {message}', file=sys.stderr)
    print(f'{len(available)}/{len(catalog)} packaged; {len(errors)} warnings. No audio downloaded.')
    return bool(errors)


if __name__ == '__main__':
    sys.exit(main())
