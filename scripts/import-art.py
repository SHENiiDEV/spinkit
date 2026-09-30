#!/usr/bin/env python3
"""
Imports painted (AI) artwork into a game: cuts symbols out of sprite sheets, cuts character
cards out of their dark background, cleans the cabinet and measures its reel windows.

  python3 scripts/import-art.py sheet  <sheet.png> <out_dir> name1 name2 ...   # symbols on a white background
  python3 scripts/import-art.py card   <cards.png> <out_dir> name1 [name2 ...]  # tall cards side by side on a dark background
  python3 scripts/import-art.py strip  <image.png> <out_dir/name.png>           # one tall piece on a dark background (e.g. a totem)
  python3 scripts/import-art.py stage  <cabinet.png> <out_dir> [--windows 2,4,5,6,5,4,2 | --panel]
  python3 scripts/import-art.py video  <clip.mp4> <still_card.png> <out_dir> <name> [--patch x0,y0,x1,y1 ...]

sheet  finds every symbol as a separate blob (reading order: rows top to bottom, left to right),
       removes the white background and saves 320x320 transparent PNGs in the given order.
stage  saves stage.jpg; with --windows it finds the dark reel windows, paints over the cell
       separator lines the generator drew (the game draws its own rows) and prints the
       theme.stage block with reel_rects for the game definition.

video  turns an image-to-video clip of a card (dark background) into an animated giant:
       <name>.webm + <name>.mp4 (cropped to the card, looping, no audio) and <name>_mask.png
       (the card shape; the game cuts the video with it). --patch paints rectangles of the clip
       (clip pixels, e.g. a generator watermark on the static frame) with the matching part of the
       still picture. Use in the game: tall_video: [webm, mp4], tall_mask: mask.
       Needs ffmpeg (with libx264 and libvpx-vp9).

Needs Pillow, numpy and scipy (pip3 install pillow numpy scipy). Dev tool, not used by the server.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


def background_mask(rgb, color, tol):
    """Pixels close to `color` that are connected to the image border."""
    close = np.abs(rgb.astype(int) - np.array(color)).max(axis=2) <= tol
    lab, _ = ndimage.label(close)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    return np.isin(lab, list(border))


def cut_out(img, color, tol, feather=1.0, holes=False):
    rgb = np.asarray(img.convert('RGB'))
    bg = background_mask(rgb, color, tol)
    if holes:
        # enclosed background (the inside of an A, O, Q, 0 ...): large, flat, almost exactly the bg colour
        flat = np.abs(rgb.astype(int) - np.array(color)).max(axis=2) <= 12
        lab, n = ndimage.label(flat & ~bg)
        if n:
            sizes = ndimage.sum(flat, lab, range(1, n + 1))
            big = [i + 1 for i, v in enumerate(sizes) if v > rgb.shape[0] * rgb.shape[1] * 0.0004]
            bg |= np.isin(lab, big)
    alpha = Image.fromarray(((~bg) * 255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(feather))
    out = img.convert('RGBA')
    out.putalpha(alpha)
    return out


def fit_square(rgba, size=320, fill=0.92):
    box = rgba.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    rgba = rgba.crop(box)
    s = size * fill / max(rgba.size)
    rgba = rgba.resize((max(1, round(rgba.width * s)), max(1, round(rgba.height * s))), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(rgba, ((size - rgba.width) // 2, (size - rgba.height) // 2), rgba)
    return out


def blobs(alpha, count):
    """Groups the opaque pixels into `count` symbols (small fragments join the nearest symbol)."""
    solid = alpha > 20
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=6))
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    order = np.argsort(sizes)[::-1]
    if len(order) < count:
        raise SystemExit(f'found only {len(order)} symbols, expected {count}')
    main = [int(i) + 1 for i in order[:count]]
    boxes = [ndimage.find_objects((lab == k).astype(int))[0] for k in main]
    # reading order: group into rows by vertical centre, then left to right
    items = sorted(zip(main, boxes), key=lambda kb: (kb[1][0].start + kb[1][0].stop) / 2)
    rows, current = [], []
    for kb in items:
        cy = (kb[1][0].start + kb[1][0].stop) / 2
        if current and cy - (current[0][1][0].start + current[0][1][0].stop) / 2 > (kb[1][0].stop - kb[1][0].start) * 0.5:
            rows.append(current)
            current = []
        current.append(kb)
    rows.append(current)
    return [kb for row in rows for kb in sorted(row, key=lambda kb: kb[1][1].start)], lab


def transparent(src):
    """The picture as RGBA if it already has a transparent background (e.g. generated with background=transparent)."""
    img = Image.open(src)
    if img.mode in ('RGBA', 'LA') or 'transparency' in img.info:
        rgba = img.convert('RGBA')
        if (np.asarray(rgba.getchannel('A')) < 128).mean() > 0.05:
            return rgba
    return None


def cmd_sheet(src, out_dir, names):
    rgba = transparent(src)
    if rgba is None:
        rgba = cut_out(Image.open(src).convert('RGB'), (255, 255, 255), 28, holes=True)
    alpha = np.asarray(rgba.getchannel('A'))
    found, lab = blobs(alpha, len(names))
    os.makedirs(out_dir, exist_ok=True)
    for name, (k, (ys, xs)) in zip(names, found):
        if name.startswith('_'):
            continue  # spare cell
        piece = rgba.crop((xs.start, ys.start, xs.stop, ys.stop))
        keep = (lab[ys, xs] == k)
        a = np.asarray(piece.getchannel('A')).copy()
        a[~keep] = 0
        piece.putalpha(Image.fromarray(a))
        fit_square(piece).save(os.path.join(out_dir, name + '.png'))
        print('  ✓', name)


def cmd_grid(src, out_dir, names, cols=3, rows=3, tol=28, holes=True):
    """Symbols painted on an even grid (cols x rows, reading order); a symbol may overflow its cell and
    touch a neighbour: pieces are assigned to the cell holding most of their pixels, merged pieces are split
    along the cell borders."""
    rgba = transparent(src)
    if rgba is None:
        rgba = cut_out(Image.open(src).convert('RGB'), (255, 255, 255), tol, holes=holes)
    a = np.asarray(rgba.getchannel('A'))
    H, W = a.shape
    solid = a > 20
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=2))
    yy, xx = np.mgrid[0:H, 0:W]
    cell_of_px = np.minimum(yy * rows // H, rows - 1) * cols + np.minimum(xx * cols // W, cols - 1)
    owner = np.full((H, W), -1)
    for k in range(1, n + 1):
        m = (lab == k) & solid
        cnt = np.bincount(cell_of_px[m], minlength=cols * rows)
        if cnt.sum() < H * W * 0.0003:
            continue  # specks
        best = cnt.argmax()
        if cnt[best] >= cnt.sum() * 0.8:
            owner[lab == k] = best  # clearly one symbol (overflow kept)
        else:
            owner[(lab == k)] = cell_of_px[lab == k]  # two symbols touching: split at the cell border
    os.makedirs(out_dir, exist_ok=True)
    for i, name in enumerate(names):
        if name.startswith('_'):
            continue
        m = owner == i
        if not m.any():
            raise SystemExit(f'cell {i} ({name}) is empty')
        ys, xs = np.where(m)
        box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        piece = rgba.crop(box)
        al = np.asarray(piece.getchannel('A')).copy()
        al[~m[box[1]:box[3], box[0]:box[2]]] = 0
        piece.putalpha(Image.fromarray(al))
        fit_square(piece).save(os.path.join(out_dir, name + '.png'))
        print('  ✓', name)


def cmd_boxes(src, out_dir, boxes):
    """Symbols cut by hand-picked boxes {name: [x0, y0, x1, y1]} (for sheets whose layout is irregular)."""
    rgba = transparent(src)
    if rgba is None:
        rgba = cut_out(Image.open(src).convert('RGB'), (255, 255, 255), 28, holes=True)
    os.makedirs(out_dir, exist_ok=True)
    for name, (x0, y0, x1, y1) in boxes.items():
        x0, y0 = max(0, x0 - 6), max(0, y0 - 6)
        x1, y1 = min(rgba.width, x1 + 6), min(rgba.height, y1 + 6)
        piece = rgba.crop((x0, y0, x1, y1))
        a = np.asarray(piece.getchannel('A')).copy()
        solid = a > 30
        lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=3))
        if n:
            sizes = ndimage.sum(solid, lab, range(1, n + 1))
            keep = np.isin(lab, [i + 1 for i, v in enumerate(sizes) if v >= sizes.max() * 0.15])
            a[~keep] = 0
            piece.putalpha(Image.fromarray(a))
        fit_square(piece).save(os.path.join(out_dir, name + '.png'))
        print('  ✓', name)


def dark_color(rgb):
    return tuple(int(v) for v in np.median(np.concatenate([rgb[:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3)]), axis=0))


def cmd_card(src, out_dir, names, width=400):
    rgba = transparent(src)
    if rgba is not None and len(names) == 1:
        piece = rgba.crop(rgba.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
        piece = piece.resize((width, round(piece.height * width / piece.width)), Image.LANCZOS)
        os.makedirs(out_dir, exist_ok=True)
        piece.save(os.path.join(out_dir, names[0] + '.png'))
        print('  ✓', names[0], piece.size)
        return
    img = Image.open(src).convert('RGB')
    rgb = np.asarray(img)
    bgc = dark_color(rgb)
    solid = ~background_mask(rgb, bgc, 30)
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=4))
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    main = sorted([int(i) + 1 for i in np.argsort(sizes)[::-1][:len(names)]], key=lambda k: ndimage.find_objects((lab == k).astype(int))[0][1].start)
    os.makedirs(out_dir, exist_ok=True)
    for name, k in zip(names, main):
        ys, xs = ndimage.find_objects((lab == k).astype(int))[0]
        piece = cut_out(img.crop((max(0, xs.start - 4), max(0, ys.start - 4), min(img.width, xs.stop + 4), min(img.height, ys.stop + 4))), bgc, 30, 0.8)
        piece = piece.crop(piece.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
        piece = piece.resize((width, round(piece.height * width / piece.width)), Image.LANCZOS)
        piece.save(os.path.join(out_dir, name + '.png'))
        print('  ✓', name, piece.size)


def cmd_strip(src, out_file, width=300):
    piece = transparent(src)
    if piece is None:
        img = Image.open(src).convert('RGB')
        piece = cut_out(img, dark_color(np.asarray(img)), 30, 0.8)
    piece = piece.crop(piece.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
    piece = piece.resize((width, round(piece.height * width / piece.width)), Image.LANCZOS)
    piece.save(out_file)
    print('  ✓', out_file, piece.size)


def find_panel(img):
    """The reel window of a cabinet with one rectangular window: the dark, filled, box-shaped region
    around the centre that does not touch the picture's edges (threshold raised until one is found)."""
    lum = np.asarray(img.convert('L')).astype(int)
    H, W = lum.shape
    probes = [(int(H * f), int(W * g)) for f in (0.45, 0.5, 0.4, 0.55) for g in (0.5, 0.47, 0.53)]
    for t in range(16, 96, 6):
        dark = ndimage.binary_opening(lum < t, iterations=2)
        lab, n = ndimage.label(dark)
        seen = set()
        for (py, px) in probes:
            k = lab[py, px]
            if not k or k in seen:
                continue
            seen.add(k)
            ys, xs = ndimage.find_objects((lab == k).astype(int))[0]
            bw, bh = xs.stop - xs.start, ys.stop - ys.start
            area = (lab[ys, xs] == k).sum()
            if xs.start <= 2 or ys.start <= 2 or xs.stop >= W - 2 or ys.stop >= H - 2:
                continue  # leaks into the background
            if bw < W * 0.15 or bh < H * 0.2 or area < bw * bh * 0.8 or bw * bh > W * H * 0.5:
                continue
            box = dark[ys, xs]
            cols = np.where(box.mean(axis=0) > 0.7)[0]
            rows = np.where(box.mean(axis=1) > 0.7)[0]
            x0, x1 = xs.start + cols.min(), xs.start + cols.max()
            y0, y1 = ys.start + rows.min(), ys.start + rows.max()
            return {'x': int(x0), 'y': int(y0), 'w': int(x1 - x0 + 1), 'h': int(y1 - y0 + 1)}
    raise SystemExit('no dark reel window found')


def write_cover(img, out_dir, width=942, aspect=1.117):
    """cover.jpg for the lobby: the cabinet cropped to the lobby tile shape."""
    w, h = img.size
    cw, ch = (w, round(w / aspect)) if w / h < aspect else (round(h * aspect), h)
    left, top = (w - cw) // 2, (h - ch) // 2
    img.crop((left, top, left + cw, top + ch)).resize((width, round(width / aspect)), Image.LANCZOS).save(os.path.join(out_dir, 'cover.jpg'), quality=86)


def cmd_stage(src, out_dir, windows=None, panel=False, reels=None):
    img = Image.open(src).convert('RGB')
    os.makedirs(out_dir, exist_ok=True)
    if panel or reels:
        reels = dict(reels) if reels else find_panel(img)  # reels: hand-measured window {x, y, w, h}
        panel = True
        # frame the cabinet around its reel window (window ~40% of the width, logo kept above it)
        W, H = img.size
        L = max(0, int(reels['x'] - reels['w'] * 0.6))
        R = min(W, int(reels['x'] + reels['w'] * 1.6))
        T = 0  # the logo sits at the top of the picture
        B = min(H, int(reels['y'] + reels['h'] * 1.12))
        img = img.crop((L, T, R, B))
        reels = {'x': reels['x'] - L, 'y': reels['y'] - T, 'w': reels['w'], 'h': reels['h']}
        img.save(os.path.join(out_dir, 'stage.jpg'), quality=92)
        stage = {'width': img.width, 'height': img.height, 'reels': reels, 'pad': 8}
        print('  ✓ stage.jpg', img.size, 'reel window', reels)
        return stage
    if not windows:
        img.save(os.path.join(out_dir, 'stage.jpg'), quality=92)
        print('  ✓ stage.jpg', img.size)
        return None
    a = np.asarray(img).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    dark = (r < 50) & (g < 70) & (b < 75) & (g >= r - 4)  # dark (teal-ish / neutral) panel
    # windows = the tall dark boxes; find them column by column around the vertical centre band
    col_dark = dark[int(img.height * 0.3):int(img.height * 0.7)].mean(axis=0) > 0.35
    runs, s = [], None
    for x, v in enumerate(col_dark):
        if v and s is None:
            s = x
        if not v and s is not None:
            if x - s > img.width * 0.03:
                runs.append((s, x - 1))
            s = None
    runs = sorted(runs, key=lambda t: t[1] - t[0], reverse=True)[:len(windows)]
    runs.sort()
    if len(runs) != len(windows):
        raise SystemExit(f'found {len(runs)} reel windows, expected {len(windows)}')
    rects = []
    out = a.copy()
    for (x0, x1) in runs:
        inner = dark[:, x0 + 8:x1 - 8].mean(axis=1) > 0.5
        mid = max(range(len(inner)), key=lambda y: inner[max(0, y - 40):y + 40].sum())
        lo = hi = mid
        gap = 0
        y = mid
        while y > 0:
            y -= 1
            gap = 0 if inner[y] else gap + 1
            if inner[y]:
                lo = y
            if gap > 8:
                break
        gap = 0
        y = mid
        while y < len(inner) - 1:
            y += 1
            gap = 0 if inner[y] else gap + 1
            if inner[y]:
                hi = y
            if gap > 8:
                break
        # paint over separator lines inside the window (copy the row just above each line)
        for yy in range(lo + 1, hi):
            if not inner[yy]:
                src_y = yy - 1
                while src_y > lo and not inner[src_y]:
                    src_y -= 1
                out[yy, x0 + 2:x1 - 1] = out[src_y, x0 + 2:x1 - 1]
        rects.append({'x': int(x0), 'y': int(lo), 'w': int(x1 - x0 + 1), 'h': int(hi - lo + 1)})
    Image.fromarray(out.astype('uint8')).save(os.path.join(out_dir, 'stage.jpg'), quality=92)
    X0 = min(t['x'] for t in rects)
    Y0 = min(t['y'] for t in rects)
    X1 = max(t['x'] + t['w'] for t in rects)
    Y1 = max(t['y'] + t['h'] for t in rects)
    stage = {'width': img.width, 'height': img.height, 'reels': {'x': X0, 'y': Y0, 'w': X1 - X0, 'h': Y1 - Y0}, 'pad': 0, 'reel_rects': rects}
    print('  ✓ stage.jpg', img.size)
    print('theme.stage (image path aside):')
    print(json.dumps(stage))
    return stage


def cmd_video(clip, still_path, out_dir, name, patches):
    import subprocess
    import tempfile
    tmp = tempfile.mkdtemp()
    first = os.path.join(tmp, 'first.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', clip, '-vf', 'select=eq(n\\,0)', '-vsync', '0', first], check=True)
    frame = Image.open(first).convert('RGB')
    still = Image.open(still_path).convert('RGB')

    def card_box(img):
        rgb = np.asarray(img)
        m = ~background_mask(rgb, dark_color(rgb), 30)
        ys, xs = np.where(m)
        return xs.min(), ys.min(), xs.max(), ys.max()

    fb, sb = card_box(frame), card_box(still)
    # still -> clip coordinates (the generator may rescale each axis a little)
    kx = (fb[2] - fb[0]) / (sb[2] - sb[0])
    ky = (fb[3] - fb[1]) / (sb[3] - sb[1])
    reg = still.resize((round(still.width * kx), round(still.height * ky)), Image.LANCZOS)
    canvas = Image.new('RGB', frame.size, dark_color(np.asarray(frame)))
    canvas.paste(reg, (fb[0] - round(sb[0] * kx), fb[1] - round(sb[1] * ky)))
    a = np.zeros((frame.height, frame.width), np.uint8)
    for (x0, y0, x1, y1) in patches:
        a[y0:y1, x0:x1] = 255
    patch = canvas.convert('RGBA')
    patch.putalpha(Image.fromarray(a).filter(ImageFilter.GaussianBlur(3)))
    patch_png = os.path.join(tmp, 'patch.png')
    patch.save(patch_png)
    fixed = frame.copy()
    fixed.paste(patch, (0, 0), patch)
    # crop to the card (even size for the encoders)
    x0, y0 = int(fb[0]), int(fb[1])
    w = (int(fb[2]) - x0 + 1) // 2 * 2
    h = (int(fb[3]) - y0 + 1) // 2 * 2
    mask = cut_out(fixed, dark_color(np.asarray(fixed)), 30, 0.8).getchannel('A').crop((x0, y0, x0 + w, y0 + h))
    os.makedirs(out_dir, exist_ok=True)
    mask.save(os.path.join(out_dir, name + '_mask.png'))
    vf = f'[0:v][1:v]overlay=0:0,crop={w}:{h}:{x0}:{y0},format=yuv420p'
    base = ['ffmpeg', '-v', 'error', '-y', '-i', clip, '-i', patch_png, '-filter_complex', vf, '-an']
    subprocess.run(base + ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-row-mt', '1', os.path.join(out_dir, name + '.webm')], check=True)
    subprocess.run(base + ['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', os.path.join(out_dir, name + '.mp4')], check=True)
    print(f'  ✓ {name}.webm, {name}.mp4, {name}_mask.png ({w}x{h})')


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    cmd, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
    rest = sys.argv[4:]
    if cmd == 'sheet':
        cmd_sheet(src, out, rest)
    elif cmd == 'card':
        cmd_card(src, out, rest)
    elif cmd == 'strip':
        cmd_strip(src, out)
    elif cmd == 'video':
        still, out_dir, name = out, rest[0], rest[1]
        patches = []
        if '--patch' in rest:
            for v in rest[rest.index('--patch') + 1:]:
                if v.startswith('--'):
                    break
                patches.append(tuple(int(t) for t in v.split(',')))
        cmd_video(src, still, out_dir, name, patches)
    elif cmd == 'stage':
        windows = None
        if '--windows' in rest:
            windows = [int(v) for v in rest[rest.index('--windows') + 1].split(',')]
        stage = cmd_stage(src, out, windows, panel='--panel' in rest)
        if stage and '--panel' in rest:
            print(json.dumps(stage))
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == '__main__':
    main()
