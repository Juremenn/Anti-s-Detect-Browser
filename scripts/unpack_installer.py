import os
import subprocess
import shutil

def unpack_installer():
    installer_path = 'Octo_Browser_latest_win.exe'
    output_dir = 'extracted'
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"[*] Reading installer: {installer_path}")
    with open(installer_path, 'rb') as f:
        # FILES.7z starts at offset 2668032, size 28596146
        f.seek(2668032)
        files_data = bytearray(f.read(28596146))
        
        # octo.7z starts at offset 31264178, size 1167077
        f.seek(31264178)
        octo_data = bytearray(f.read(1167077))
        
        # INI config at 32431255, size 3666
        f.seek(32431255)
        ini_data = f.read(3666)

    # De-obfuscate: first 512 bytes are XORed with 0xFF
    print("[*] Unmasking FILES.7z (xorLength = 512)...")
    for i in range(512):
        files_data[i] ^= 0xFF
        
    print("[*] Unmasking octo.7z (xorLength = 512)...")
    for i in range(512):
        octo_data[i] ^= 0xFF

    files_7z_path = os.path.join(output_dir, 'files.7z')
    octo_7z_path = os.path.join(output_dir, 'octo.7z')
    ini_path = os.path.join(output_dir, 'installer.ini')
    
    with open(files_7z_path, 'wb') as f:
        f.write(files_data)
    with open(octo_7z_path, 'wb') as f:
        f.write(octo_data)
    with open(ini_path, 'wb') as f:
        f.write(ini_data)
        
    seven_zip = r"C:\Program Files\7-Zip\7z.exe"
    print(f"[*] Extracting {files_7z_path} into {output_dir}...")
    subprocess.run([seven_zip, 'x', files_7z_path, f'-o{output_dir}', '-y'], check=True, stdout=subprocess.DEVNULL)
    
    print(f"[*] Extracting {octo_7z_path} into {output_dir}...")
    subprocess.run([seven_zip, 'x', octo_7z_path, f'-o{output_dir}', '-y'], check=True, stdout=subprocess.DEVNULL)
    
    # Clean up intermediate archives
    os.remove(files_7z_path)
    os.remove(octo_7z_path)
    
    print(f"[+] Extraction complete! Assets extracted to: {output_dir}")

if __name__ == '__main__':
    unpack_installer()

