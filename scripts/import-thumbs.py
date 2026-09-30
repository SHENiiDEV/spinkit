#!/usr/bin/env python3
"""Turns painted thumbnails (art-src/thumbs/<id>.png, from scripts/gen-thumbs.js) into lobby assets.

    python3 scripts/import-thumbs.py --all          # every painted thumbnail
    python3 scripts/import-thumbs.py tiki_titans    # one or more games
    python3 scripts/import-thumbs.py <id> --file some/picture.png   # use any picture as the thumbnail

Center-crops to 4:3 and writes public/games/<id>/assets/thumb.jpg (800x600). Restart the server after.
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art-src', 'thumbs')
W, H = 800, 600


def convert(src, game_id):
    out_dir = os.path.join(ROOT, 'public', 'games', game_id, 'assets')
    if not os.path.isdir(out_dir):
        raise SystemExit(f'{game_id}: no public/games/{game_id}/assets folder (not an artwork game?)')
    im = Image.open(src).convert('RGB')
    w, h = im.size
    if w / h > W / H:  # too wide: crop the sides
        cw = round(h * W / H)
        im = im.crop(((w - cw) // 2, 0, (w - cw) // 2 + cw, h))
    else:  # too tall: crop from the bottom up a little less than from the top (keeps logo room)
        ch = round(w * H / W)
        top = (h - ch) // 3
        im = im.crop((0, top, w, top + ch))
    im = im.resize((W, H), Image.LANCZOS)
    dest = os.path.join(out_dir, 'thumb.jpg')
    im.save(dest, 'JPEG', quality=86, optimize=True, progressive=True)
    print(f'✔ {game_id}: {os.path.relpath(dest, ROOT)} ({os.path.getsize(dest) // 1024} KB)')


def main():
    args = sys.argv[1:]
    if '--file' in args:
        i = args.index('--file')
        f = args[i + 1]
        ids = [a for a in args[:i] + args[i + 2:] if not a.startswith('--')]
        if len(ids) != 1:
            raise SystemExit('--file needs exactly one game id')
        convert(f, ids[0])
        return
    if '--all' in args:
        ids = sorted(f[:-4] for f in os.listdir(SRC) if f.endswith('.png')) if os.path.isdir(SRC) else []
    else:
        ids = [a for a in args if not a.startswith('--')]
    if not ids:
        raise SystemExit(__doc__)
    for gid in ids:
        src = os.path.join(SRC, f'{gid}.png')
        if not os.path.exists(src):
            print(f'✗ {gid}: {os.path.relpath(src, ROOT)} not found')
            continue
        convert(src, gid)
    print('Restart the server to show the new thumbnails in the lobby.')


if __name__ == '__main__':
    main()
