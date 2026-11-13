import os
import re

vectors = [
    'canvas', 'webgl', 'audio', 'webrtc', 'hardware', 'memory', 
    'concurrency', 'font', 'timezone', 'resolution', 'screen', 
    'vendor', 'renderer', 'gpu', 'ja3', 'noise', 'spoof', 'octokey', 'octium',
    'fingerprint', 'user_agent', 'plugins', 'battery', 'device_memory'
]

pattern = re.compile(rb'[\x20-\x7e]{4,}')
base_dir = os.path.join('extracted', 'pyz_extracted', 'octo')

results = {}

for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f.endswith('.pyc'):
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, os.path.join('extracted', 'pyz_extracted'))
            try:
                with open(full_path, 'rb') as fp:
                    data = fp.read()
                
                # find all ascii strings
                strings = pattern.findall(data)
                matched_vectors = set()
                matched_strings = []
                for s in strings:
                    s_str = s.decode('latin1', errors='ignore')
                    s_low = s_str.lower()
                    for v in vectors:
                        if v in s_low:
                            matched_vectors.add(v)
                            matched_strings.append(s_str)
                if matched_vectors:
                    results[rel_path] = (sorted(matched_vectors), list(set(matched_strings))[:15])
            except Exception as e:
                pass

print(f"Total matching modules: {len(results)}\n")
for rel, (fnd, strs) in sorted(results.items()):
    print(f"=== {rel} ===")
    print(f"  Vectors: {fnd}")
    print(f"  Samples: {strs[:10]}\n")
