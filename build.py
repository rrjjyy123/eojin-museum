#!/usr/bin/env python3
"""온라인 어진 박물관 — 단일 HTML 빌드"""
import base64, glob, json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT_LIST = [sys.argv[1]] if len(sys.argv) > 1 else [os.path.join(ROOT, '어진박물관.html'), os.path.join(ROOT, 'index.html')]

def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()

# 이미지 → base64 data URI
assets = {}
total = 0
for p in sorted(glob.glob(os.path.join(ROOT, 'assets', '*.webp'))):
    key = os.path.splitext(os.path.basename(p))[0]
    raw = open(p, 'rb').read()
    total += len(raw)
    assets[key] = 'data:image/webp;base64,' + base64.b64encode(raw).decode()

three = read(os.path.join(ROOT, 'three.min.cjs'))
shell = read(os.path.join(SRC, 'shell.html'))

three_block = 'window.THREE=(function(){var exports={};\n' + three + '\nreturn exports;})();'
assets_block = 'const ASSETS=' + json.dumps(assets, ensure_ascii=False) + ';'

html = (shell
        .replace('/*__THREE__*/', three_block)
        .replace('/*__ASSETS__*/', assets_block)
        .replace('/*__DATA__*/', read(os.path.join(SRC, 'data.js')))
        .replace('/*__APP__*/', read(os.path.join(SRC, 'app.js'))))

for out_path in OUT_LIST:
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html)
    size = os.path.getsize(out_path)
    print(f'출력 {out_path}  →  {size/1048576:.2f} MB')

print(f'이미지 {len(assets)}점  원본 {total/1048576:.2f} MB 완료')
