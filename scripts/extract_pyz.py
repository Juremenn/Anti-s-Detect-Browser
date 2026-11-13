import os
import marshal
import zlib

def extract_pyz():
    pyz_path = 'Octo Browser.exe_extracted/PYZ.pyz'
    out_dir = 'extracted/pyz_extracted'
    os.makedirs(out_dir, exist_ok=True)
    
    with open(pyz_path, 'rb') as f:
        magic = f.read(4)
        pyver = f.read(4)
        # Python 3.12 pyc header magic is cb 0d 0d 0a (0x0a0d0dcb)
        pyc_header = pyver + b'\x00' * 12
        
        # Read TOC offset (stored in header or footer)
        # In our earlier inspection TOC pos is 9859973
        f.seek(9859973)
        toc = marshal.load(f)
        
        print(f"[*] Extracting {len(toc)} modules to {out_dir}...")
        extracted_count = 0
        app_modules = []
        
        for name, info in toc:
            ispkg, pos, length = info
            f.seek(pos)
            compressed_data = f.read(length)
            try:
                code_data = zlib.decompress(compressed_data)
            except Exception as e:
                print(f"[-] Error decompressing {name}: {e}")
                continue
                
            # Convert module name to file path
            parts = name.split('.')
            if ispkg:
                file_rel = os.path.join(*parts, '__init__.pyc')
            else:
                file_rel = os.path.join(*parts) + '.pyc'
                
            full_path = os.path.join(out_dir, file_rel)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            with open(full_path, 'wb') as pyc_out:
                pyc_out.write(pyc_header)
                pyc_out.write(code_data)
                
            extracted_count += 1
            if not name.startswith(('encodings', 'asyncio', 'urllib', 'email', 'http', 'logging', 'json', 'xml', 'unittest', 'importlib', 'ctypes')):
                app_modules.append(name)

    print(f"[+] Successfully extracted {extracted_count} .pyc files!")
    print(f"[+] Identified candidate application modules: {len(app_modules)}")
    
    with open('extracted/app_modules.txt', 'w') as mf:
        for m in sorted(app_modules):
            mf.write(m + '\n')

if __name__ == '__main__':
    extract_pyz()
