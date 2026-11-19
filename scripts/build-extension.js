#!/usr/bin/env node
/**
 * Anti Detect Browser - Single-File CRX3 Build Pipeline
 * Packages extensions/anti-detect-browser/ into a valid CRX3 binary:
 * - Persistent RSA-2048 signing key at scripts/.keys/anti-detect-browser.pem
 * - Deterministic Chromium Extension ID (a-p format)
 * - Clean ZIP payload without artifacts or temporary files
 * - Valid Chromium CRX3 binary header (Cr24, version 3, Protobuf CrxFileHeader)
 * - Output: Extension/anti-detect-browser.crx
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const EXT_SRC = path.join(ROOT, 'extensions', 'anti-detect-browser');
const KEYS_DIR = path.join(__dirname, '.keys');
const KEY_FILE = path.join(KEYS_DIR, 'anti-detect-browser.pem');
const OUTPUT_DIR = path.join(ROOT, 'Extension');
const OUTPUT_CRX = path.join(OUTPUT_DIR, 'anti-detect-browser.crx');

// --- 1. Key Management ------------------------------------------------------
function getOrCreateKey() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  if (fs.existsSync(KEY_FILE)) {
    const pem = fs.readFileSync(KEY_FILE, 'utf-8');
    const privateKey = crypto.createPrivateKey(pem);
    const publicKey = crypto.createPublicKey(privateKey);
    const pubDer = publicKey.export({ type: 'spki', format: 'der' });
    return { privateKey, pubDer, pem };
  }

  console.log('[*] Generating persistent RSA-2048 signing key...');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  fs.writeFileSync(KEY_FILE, privateKey, { encoding: 'utf-8', mode: 0o600 });
  console.log(`[+] Persisted signing key to: ${KEY_FILE}`);

  const pubKeyObj = crypto.createPublicKey({ key: publicKey, type: 'spki', format: 'der' });
  const privKeyObj = crypto.createPrivateKey(privateKey);
  return { privateKey: privKeyObj, pubDer: publicKey, pem: privateKey };
}

// Compute 32-character a-p Extension ID
function computeExtensionId(pubDer) {
  const hash = crypto.createHash('sha256').update(pubDer).digest().subarray(0, 16);
  let id = '';
  for (let i = 0; i < 16; i++) {
    const byte = hash[i];
    id += String.fromCharCode(97 + ((byte >> 4) & 0x0f));
    id += String.fromCharCode(97 + (byte & 0x0f));
  }
  return { id, rawBytes: hash };
}

// --- 2. Clean ZIP Archive Construction --------------------------------------
// Pure Node.js ZIP archive generator (no external dependencies)
function createZipArchive(sourceDir) {
  const entries = [];

  function collectFiles(currentDir, relativePath) {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.') || item.name === 'Thumbs.db' || item.name.endsWith('.map') || item.name.endsWith('.pem')) {
        continue;
      }
      const fullPath = path.join(currentDir, item.name);
      const relPath = relativePath ? `${relativePath}/${item.name}` : item.name;

      if (item.isDirectory()) {
        collectFiles(fullPath, relPath);
      } else if (item.isFile()) {
        const content = fs.readFileSync(fullPath);
        entries.push({ name: relPath.replace(/\\/g, '/'), data: content });
      }
    }
  }

  collectFiles(sourceDir, '');
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf-8');
    const crc = crc32(entry.data);
    const deflated = zlib.deflateRawSync(entry.data, { level: 9 });
    const useDeflate = deflated.length < entry.data.length;
    const compData = useDeflate ? deflated : entry.data;
    const compMethod = useDeflate ? 8 : 0;

    // Local File Header (30 bytes + nameBuf.length)
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // Local header signature
    local.writeUInt16LE(20, 4);          // Version needed (2.0)
    local.writeUInt16LE(0, 6);           // Flags
    local.writeUInt16LE(compMethod, 8);  // Compression method
    local.writeUInt16LE(0x4521, 10);     // File time
    local.writeUInt16LE(0x572a, 12);     // File date
    local.writeUInt32LE(crc, 14);        // CRC32
    local.writeUInt32LE(compData.length, 18); // Compressed size
    local.writeUInt32LE(entry.data.length, 22); // Uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);    // Filename length
    local.writeUInt16LE(0, 28);                 // Extra field length
    nameBuf.copy(local, 30);

    // Central Directory Header (46 bytes + nameBuf.length)
    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0); // Central directory signature
    central.writeUInt16LE(20, 4);         // Version made by
    central.writeUInt16LE(20, 6);         // Version needed
    central.writeUInt16LE(0, 8);          // Flags
    central.writeUInt16LE(compMethod, 10); // Compression method
    central.writeUInt16LE(0x4521, 12);    // File time
    central.writeUInt16LE(0x572a, 14);    // File date
    central.writeUInt32LE(crc, 16);       // CRC32
    central.writeUInt32LE(compData.length, 20); // Compressed size
    central.writeUInt32LE(entry.data.length, 24); // Uncompressed size
    central.writeUInt16LE(nameBuf.length, 28);    // Filename length
    central.writeUInt16LE(0, 30);                 // Extra field length
    central.writeUInt16LE(0, 32);                 // Comment length
    central.writeUInt16LE(0, 34);                 // Disk number
    central.writeUInt16LE(0, 36);                 // Internal attrs
    central.writeUInt32LE(0, 38);                 // External attrs
    central.writeUInt32LE(offset, 42);            // Relative offset
    nameBuf.copy(central, 46);

    localHeaders.push(local, compData);
    centralHeaders.push(central);
    offset += local.length + compData.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const c of centralHeaders) centralDirSize += c.length;

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4);          // Disk number
  eocd.writeUInt16LE(0, 6);          // Start disk
  eocd.writeUInt16LE(entries.length, 8);  // Entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // Total entries
  eocd.writeUInt32LE(centralDirSize, 12); // Central dir size
  eocd.writeUInt32LE(centralDirOffset, 16); // Central dir offset
  eocd.writeUInt16LE(0, 20);          // Comment length

  return {
    buffer: Buffer.concat([...localHeaders, ...centralHeaders, eocd]),
    fileCount: entries.length
  };
}

// CRC32 Calculation
function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (~crc) >>> 0;
}

// --- 3. Protobuf Encoding Helpers -------------------------------------------
function encodeVarint(num) {
  const bytes = [];
  while (num >= 0x80) {
    bytes.push((num & 0x7f) | 0x80);
    num >>>= 7;
  }
  bytes.push(num & 0x7f);
  return Buffer.from(bytes);
}

function encodeField(fieldNum, valueBuffer) {
  const tag = (fieldNum << 3) | 2;
  return Buffer.concat([encodeVarint(tag), encodeVarint(valueBuffer.length), valueBuffer]);
}

// --- 4. Build CRX3 Package --------------------------------------------------
function buildCrx() {
  console.log('=== Anti-Detect Browser CRX3 Packager ===');

  if (!fs.existsSync(EXT_SRC)) {
    throw new Error(`Extension source directory not found: ${EXT_SRC}`);
  }

  const { privateKey, pubDer } = getOrCreateKey();
  const { id: extId, rawBytes: crxIdBytes } = computeExtensionId(pubDer);
  console.log(`[*] Stable Extension ID: ${extId}`);

  console.log(`[*] Archiving files from: ${EXT_SRC}`);
  const { buffer: zipPayload, fileCount } = createZipArchive(EXT_SRC);
  console.log(`[+] Packed ${fileCount} files into clean ZIP payload (${zipPayload.length} bytes)`);

  // SignedData protobuf: Field 1 (bytes crx_id = 1)
  const signedHeaderData = encodeField(1, crxIdBytes);

  // Signing input: "CRX3 SignedData\x00" + uint32_le(signedHeaderData.length) + signedHeaderData + zipPayload
  const prefix = Buffer.from('CRX3 SignedData\x00', 'utf-8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(signedHeaderData.length, 0);

  const signData = Buffer.concat([prefix, lenBuf, signedHeaderData, zipPayload]);
  const signature = crypto.sign('sha256', signData, privateKey);

  // AsymmetricKeyProof protobuf: Field 1 (public_key) + Field 2 (signature)
  const proof = Buffer.concat([
    encodeField(1, pubDer),
    encodeField(2, signature)
  ]);

  // CrxFileHeader protobuf: Field 2 (sha256_with_rsa) + Field 10000 (signed_header_data)
  const header = Buffer.concat([
    encodeField(2, proof),
    encodeField(10000, signedHeaderData)
  ]);

  // Final CRX3 Binary Format
  const magic = Buffer.from('Cr24', 'utf-8');
  const versionBuf = Buffer.alloc(4);
  versionBuf.writeUInt32LE(3, 0);
  const headerLenBuf = Buffer.alloc(4);
  headerLenBuf.writeUInt32LE(header.length, 0);

  const crxBinary = Buffer.concat([
    magic,
    versionBuf,
    headerLenBuf,
    header,
    zipPayload
  ]);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_CRX, crxBinary);
  console.log(`[+] Successfully wrote CRX3 package: ${OUTPUT_CRX}`);
  console.log(`    Total Size: ${crxBinary.length} bytes`);
  console.log(`    ZIP Payload Offset: ${12 + header.length}`);

  // Immediate Integrity Verification
  verifyCrx(OUTPUT_CRX, pubDer);
}

function verifyCrx(filePath, pubDer) {
  const data = fs.readFileSync(filePath);
  if (!data.subarray(0, 4).equals(Buffer.from('Cr24'))) {
    throw new Error('Verification failed: Missing Cr24 magic.');
  }
  const version = data.readUInt32LE(4);
  if (version !== 3) {
    throw new Error(`Verification failed: Expected CRX3, got version ${version}.`);
  }
  const headerLen = data.readUInt32LE(8);
  const zipOffset = 12 + headerLen;
  if (!data.subarray(zipOffset, zipOffset + 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    throw new Error('Verification failed: ZIP signature not found at expected header offset.');
  }
  console.log('[✓] CRX3 header verification and ZIP integrity check passed.');
}

buildCrx();
