"""Read one selected public conversation for the loopback-only practice screen."""
import json
import re
from functools import lru_cache
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
CATALOG = {item['slug']: item['topic'] for item in json.loads((ROOT / 'apps/quick-ears/lessons.json').read_bytes())}

@lru_cache(maxsize=8)
def read_lesson(slug):
    if slug not in CATALOG:
        raise KeyError(slug)
    url = 'https://dailydictation.com/exercises/' + CATALOG[slug] + '/' + slug + '/listen-and-type'
    request = Request(url, headers={'User-Agent': 'QuickEars/1.0 (local lesson preview)'})
    with urlopen(request, timeout=10) as response:
        page = response.read(4_000_000).decode('utf-8')
    match = re.search(r'"challenges"\s*:\s*\[', page)
    if not match:
        raise ValueError('No exercises found')
    challenges, _ = json.JSONDecoder().raw_decode(page[match.end()-1:])
    parts = []
    for item in challenges:
        answer = item['content'].strip()
        audio = item['audioSrc']
        if not answer or urlsplit(audio).scheme != 'https' or urlsplit(audio).hostname != 'dailydictation.com':
            raise ValueError('Unsupported exercise')
        parts.append({'answer': answer, 'audio': audio})
    if not parts:
        raise ValueError('Empty lesson')
    return json.dumps(parts, ensure_ascii=False).encode()
