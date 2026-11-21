"""Build static cache metadata; no network, database, or user-storage access."""
from pathlib import Path
from urllib.parse import urlsplit, unquote
from datetime import datetime, timezone, timedelta
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
# Reuse the same approved Hub logo bytes across game loading screens. They are
# cached on first view, not downloaded as part of the installation precache.
SHARED_LOGOS = ['./apps/arcade/assets/logo/' + name + '_logo.png' for name in
                ('sky_dominators', 'word_battles', 'wild_west_poker')] + ['./apps/arcade/assets/logo/dictation_practice.png',
                 './apps/arcade/assets/logo/space_dominator_super_update.png', './apps/arcade/assets/logo/152-studio.png',
                 './apps/arcade/assets/arcade_space_logo.png']


def write_if_changed(path, text):
    if not path.exists() or path.read_text(encoding='utf-8') != text:
        path.write_text(text, encoding='utf-8')


def build():
    versioned = [*list((ROOT / 'suite').rglob('*.js')), *list((ROOT / 'suite').rglob('*.css'))]
    versioned += [ROOT / name for name in (
        'js/features/loading.js', 'js/features/appearance.js', 'js/features/interface-language.js', 'css/main.css', 'css/recall-ui.css', 'css/lexical-layout.css', 'css/theme.css', 'css/entry-ui.css', 'js/core/offline.js', 'apps/grammar/js/app.js', 'apps/grammar/css/style.css',
        'apps/vocabulary-test/js/exam.js', 'apps/vocabulary-test/css/exam.css',
        'apps/quick-ears/history.js', 'apps/quick-ears/practice.js', 'apps/arcade/js/arcade-2.js', 'apps/arcade/js/space-chase.js', 'apps/arcade/css/arcade-1.css', 'apps/arcade/css/action-frames.css',
        'apps/space-dominators/studio-intro.css', 'apps/space-dominators/station.css', 'apps/space-dominators/station.js',
        'apps/space-dominators/art.js', 'apps/space-dominators/inspecting-dock.js', 'apps/space-dominators/capital-art.js', 'apps/space-dominators/background.js', 'apps/space-dominators/game.js', 'apps/space-dominators/coop-room.js',
        'apps/space-dominators/coop-lobby.js', 'apps/space-dominators/boss-campaign.js',
        'apps/space-dominators/boss-encounters.js', 'apps/space-dominators/asteroid-belt.js', 'apps/space-dominators/boss-six-preview.js',
        'apps/space-dominators/dreadnought-config.js', 'apps/space-dominators/dreadnought.js', 'apps/space-dominators/dreadnought-formations.js', 'apps/space-dominators/dreadnought-ending.js',
        'apps/space-dominators/dock-nine-story.js', 'apps/space-dominators/campaign-entry.js', 'apps/space-dominators/fleet-study.js', 'apps/space-dominators/sfx-config.js', 'apps/space-dominators/fleet-arrival.js', 'apps/space-dominators/boss-practice.js', 'apps/space-dominators/sound.js',
        'apps/poker/js/poker-1.js', 'apps/poker/css/poker-1.css',
        'apps/quick-drawn/css/duel.css', 'apps/quick-drawn/js/chess.js', 'apps/quick-drawn/js/duel.js',
        'apps/quick-drawn/js/ui-sprites.js', 'apps/quick-drawn/js/connection-recovery.js',
        'apps/sky-dominators/css/game.css', 'apps/sky-dominators/js/ui/events.js',
        'apps/sky-dominators/js/ui/progress.js', 'apps/sky-dominators/css/progress.css',
        'apps/sky-dominators/js/systems/input.js', 'apps/sky-dominators/js/ui/hangar.js', 'apps/sky-dominators/js/ui/hud.js',
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

    # Icon-only controls must be visible on the first offline game launch.
    core = ['./', './apps/arcade/assets/space-chase.png', './apps/arcade/assets/audio/space-chase-laser.mp3', './apps/quick-ears/button-sprites.png', './apps/arcade/assets/audio/game-open.mp3', './apps/arcade/assets/audio/game-switch.mp3', './apps/arcade/assets/audio/menu-select.mp3', './apps/arcade/assets/audio/menu-exit.mp3', './apps/arcade/assets/audio/game-unavailable.mp3', './apps/arcade/assets/ui_spritesheet.png',
            './apps/quick-drawn/assets/images/chess/chess_toolbar_emojis.png', './apps/arcade/assets/action-glyphs.png', './apps/arcade/assets/system-controls.png',
            './apps/grammar/assets/matcha-logo.png', './apps/grammar/assets/matcha-topic.png']
    core.extend('./assets/audio/practice-' + cue + '.wav' for cue in ('correct', 'retry', 'complete'))
    dread_root = ROOT / 'apps/space-dominators/assets'
    dread_sprites = json.loads((dread_root / 'sprites/manifest.json').read_text(encoding='utf-8'))
    core.extend('./apps/space-dominators/assets/sprites/' + asset['path'] for asset in dread_sprites['assets'])
    core.extend('./apps/space-dominators/assets/' + name for name in ('boss-six-deck/preview.png', 'star-destroyer.png', 'boss-six-ending/hull-damage-1.png', 'boss-six-ending/hull-damage-2.png', 'boss-six-ending/reactor.png', 'boss-six-ending/reactor-closed.png'))
    dread_sfx = json.loads((dread_root / 'sfx/manifest.json').read_text(encoding='utf-8'))
    core.extend('./' + (dread_root / 'sfx' / event['file']).resolve().relative_to(ROOT).as_posix()
                for event in {event['file']: event for event in dread_sfx['events'].values()}.values())
    core.extend('./apps/space-dominators/assets/' + name for name in
                ('dock-nine-radio.png', 'fleet-lab-dreadnought.png', 'fleet-lab-venator.png', 'fleet-lab-acclamator.png', 'fleet-lab-imperial.png', 'audio/hyperspaceexit.mp3', 'celestial-survey.png', 'planet-encounters.png', 'boss-fx/enemy-flight-effects.png',
                 'boss-fx/beacon-hulls.png', 'boss-fx/rail-hulls.png', 'boss-fx/hound-hulls.png', 'boss-fx/miner-hulls.png', 'inspecting-dock.png',
                 'player-hulls.png', 'player-exhaust.png', 'enemy-flight-atlas.png', 'zodiac-1.png', 'zodiac-2.png', 'zodiac-3.png'))
    core.extend('./apps/' + module + '/assets/action-buttons.png'
                for module in ('arcade', 'sky-dominators', 'quick-drawn', 'poker'))
    excluded = {'tests', 'tools', '.git', 'node_modules', 'firestore', '__pycache__'}
    for path in sorted(ROOT.rglob('*')):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT).as_posix()
        if any(part in excluded for part in Path(relative).parts):
            continue
        if relative in {'service-worker.js', 'suite/release.json', 'docs/suite-baseline.json'} or relative.endswith('/service-worker.js'):
            continue
        # Sentence data is fetched only when the student opens that lesson.
        if relative.startswith('apps/quick-ears/lesson-packs/') and path.name != 'available.json':
            continue
        if path.suffix.lower() in {'.js', '.css', '.html', '.json', '.webmanifest', '.svg'} or relative.startswith('assets/icons/') or relative == 'apps/space-dominators/assets/fonts/PressStart2P-Regular.ttf':
            if path.name.startswith(('test_', 'boss-test')) or path.stat().st_size > 1600000 or path.name in {'package-lock.json', 'package.json'}:
                continue
            core.append('./' + relative)

    worker = (ROOT / 'tools/service-worker.template.js').read_text(encoding='utf-8')
    fingerprints = [name + '\0' + hashlib.sha256((ROOT / name.removeprefix('./')).read_bytes()).hexdigest() for name in [*core, *SHARED_LOGOS] if name != './']
    digest = hashlib.sha256((worker + '\n' + '\n'.join(fingerprints)).encode()).hexdigest()[:14]
    write_if_changed(ROOT / 'service-worker.js', worker.replace('__VERSION__', VERSION + '-' + digest).replace('__CORE__', json.dumps(core)).replace('__SHARED_LOGOS__', json.dumps(SHARED_LOGOS)))
    release = {'name': 'SpaceSuite', 'lexicalVersion': VERSION,
               'date': datetime.now(timezone(timedelta(hours=7))).date().isoformat(),
               'root': 'LexicalSpace-project',
               'modules': ['lexical', 'grammar', 'arcade', 'quick-drawn', 'sky-dominators', 'space-dominators', 'poker', 'vocabulary-test', 'quick-ears'],
               'cacheVersion': digest}
    write_if_changed(ROOT / 'suite/release.json', json.dumps(release, indent=2))
    print(json.dumps({'version': VERSION, 'cache': digest, 'coreFiles': len(core),
                      'coreMB': round(sum((ROOT / n.removeprefix('./')).stat().st_size for n in core if n != './') / 1048576, 2)}))


if __name__ == '__main__':
    build()
