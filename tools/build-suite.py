"""Build static cache metadata; no network, database, or user-storage access."""
from pathlib import Path
from urllib.parse import urlsplit, unquote
from datetime import datetime, timezone, timedelta
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']


def write_if_changed(path, text):
    if not path.exists() or path.read_text(encoding='utf-8') != text:
        path.write_text(text, encoding='utf-8')


def build():
    versioned = [*list((ROOT / 'suite').rglob('*.js')), *list((ROOT / 'suite').rglob('*.css'))]
    versioned += [ROOT / name for name in (
        'js/features/loading.js', 'js/core/offline.js', 'apps/grammar/js/app.js',
        'apps/arcade/js/arcade-2.js', 'apps/poker/js/poker-1.js',
        'apps/sky-dominators/js/ui/navigation.js', 'apps/sky-dominators/js/systems/progress/client.js')]
    stamps = {p.resolve(): hashlib.sha256(p.read_bytes()).hexdigest()[:10] for p in versioned}
    for page in ROOT.rglob('*.html'):
        if any(part in {'node_modules', '.git', 'tests', 'tools'} for part in page.relative_to(ROOT).parts):
            continue
        text = page.read_text(encoding='utf-8-sig')

        def stamp(match):
            raw = match.group('url')
            url = urlsplit(raw)
            if url.scheme or raw.startswith('//'):
                return match[0]
            target = (page.parent / unquote(url.path)).resolve()
            if target not in stamps:
                return match[0]
            value = url.path + '?v=' + VERSION + '-' + stamps[target]
            if url.fragment:
                value += '#' + url.fragment
            return match.group('attribute') + '=' + match.group('quote') + value + match.group('quote')

        updated = re.sub(r'''(?P<attribute>\b(?:src|href))=(?P<quote>["'])(?P<url>[^"']+)(?P=quote)''', stamp, text)
        if updated != text:
            write_if_changed(page, updated)

    core = ['./']
    excluded = {'tests', 'tools', '.git', 'node_modules', 'firestore', '__pycache__'}
    for path in sorted(ROOT.rglob('*')):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT).as_posix()
        if any(part in excluded for part in Path(relative).parts):
            continue
        if relative in {'service-worker.js', 'suite/release.json', 'docs/suite-baseline.json'} or relative.endswith('/service-worker.js'):
            continue
        if path.suffix.lower() in {'.js', '.css', '.html', '.json', '.webmanifest', '.svg'} or relative.startswith('assets/icons/'):
            if path.name.startswith(('test_', 'boss-test')) or path.stat().st_size > 1600000 or path.name in {'package-lock.json', 'package.json'}:
                continue
            core.append('./' + relative)

    worker = (ROOT / 'tools/service-worker.template.js').read_text(encoding='utf-8')
    fingerprints = [name + '\0' + hashlib.sha256((ROOT / name.removeprefix('./')).read_bytes()).hexdigest() for name in core if name != './']
    digest = hashlib.sha256((worker + '\n' + '\n'.join(fingerprints)).encode()).hexdigest()[:14]
    write_if_changed(ROOT / 'service-worker.js', worker.replace('__VERSION__', VERSION + '-' + digest).replace('__CORE__', json.dumps(core)))
    release = {'name': 'SpaceSuite', 'lexicalVersion': VERSION,
               'date': datetime.now(timezone(timedelta(hours=7))).date().isoformat(),
               'root': 'LexicalSpace-project',
               'modules': ['lexical', 'grammar', 'arcade', 'quick-drawn', 'sky-dominators', 'poker'],
               'cacheVersion': digest}
    write_if_changed(ROOT / 'suite/release.json', json.dumps(release, indent=2))
    print(json.dumps({'version': VERSION, 'cache': digest, 'coreFiles': len(core),
                      'coreMB': round(sum((ROOT / n.removeprefix('./')).stat().st_size for n in core if n != './') / 1048576, 2)}))


if __name__ == '__main__':
    build()
