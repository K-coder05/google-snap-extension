// Packages the Web Store upload: snapfit.zip with manifest.json at the root
// and every path the manifest references kept intact (src/popup, src/styles, src/shared).
// Run via `npm run zip` (builds first).
//
// Uses the OS's bsdtar: on Windows that's System32\tar.exe, called by full
// path because Git Bash's GNU tar shadows it on PATH and can't write zips.
// PowerShell's Compress-Archive is avoided — it flattens src\ away and
// writes backslash separators.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = 'snapfit.zip';
const inputs = ['manifest.json', 'dist', 'icons', 'src/popup', 'src/shared', 'src/styles'];

const tar =
  process.platform === 'win32'
    ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
    : 'bsdtar';

rmSync(path.join(root, out), { force: true });
execFileSync(tar, ['-a', '-c', '-f', out, ...inputs], { cwd: root, stdio: 'inherit' });
console.log(`Wrote ${out}`);
