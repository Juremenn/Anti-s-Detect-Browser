import os
import marshal

vectors = [
    'canvas', 'webgl', 'audio', 'webrtc', 'hardware', 'memory', 
    'concurrency', 'font', 'timezone', 'resolution', 'screen', 
    'vendor', 'renderer', 'gpu', 'ja3', 'noise', 'spoof', 'octokey', 'octium'
]

matches = []
base_dir = os.path.join('extracted', 'pyz_extracted', 'octo')

for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f.endswith('.pyc'):
            path = os.path.join(root, f)
            try:
                with open(path, 'rb') as fp:
                    fp.seek(16)
                    code = marshal.load(fp)
                found = set()
                stack = [code]
                while stack:
                    curr = stack.pop()
                    for k in curr.co_consts:
                        if isinstance(k, str):
                            kl = k.lower()
                            for v in vectors:
                                if v in kl:
                                    found.add(v)
                        elif hasattr(k, 'co_code'):
                            stack.append(k)
                    for n in curr.co_names:
                        nl = n.lower()
                        for v in vectors:
                            if v in nl:
                                found.add(v)
                if found:
                    rel = os.path.relpath(path, os.path.join('extracted', 'pyz_extracted'))
                    matches.append((rel, sorted(found)))
            except Exception as e:
                pass

print(f"Total matching modules: {len(matches)}")
for rel, fnd in sorted(matches):
    print(f"{rel}: {fnd}")

