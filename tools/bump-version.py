#!/usr/bin/env python3
"""每次部署前執行：在所有 .html 載入的本站 .js / .css 後面加上版本號（?v=YYYYMMDDHHMM），
讓手機重新整理一次就一定抓到新版程式。外部網址（http/https）不會被改動。
用法：在網站資料夾最外層執行  python tools/bump-version.py"""
import re, sys, pathlib, datetime
root = pathlib.Path(__file__).resolve().parent.parent
ver = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).strftime("%Y%m%d%H%M")
pat = re.compile(r'''(\b(?:src|href)=")((?!https?:|//|data:)[^"?#]+\.(?:js|css))(?:\?v=[^"#]*)?(")''')
changed = 0
for f in sorted(root.rglob("*.html")):
    if any(p.startswith(".") for p in f.relative_to(root).parts):
        continue
    s = f.read_text(encoding="utf-8")
    t = pat.sub(lambda m: m.group(1) + m.group(2) + "?v=" + ver + m.group(3), s)
    if t != s:
        f.write_text(t, encoding="utf-8"); changed += 1
v = root / "VERSION.txt"
lines = v.read_text(encoding="utf-8").splitlines() if v.exists() else []
lines = [l for l in lines if not l.startswith("assets ")]
v.write_text("\n".join(lines + ["assets " + ver]) + "\n", encoding="utf-8")
print(f"版本號 {ver}，已更新 {changed} 個 HTML 檔")
