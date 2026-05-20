import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { NodeFileSystemV2, WORKRAIL_DIR_MODE } from '../../../src/v2/infra/local/fs/index.js';

describe('NodeFileSystemV2.mkdirp directory permissions', () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    for (const root of tempRoots) {
      await fs.rm(root, { recursive: true, force: true });
    }
    tempRoots.length = 0;
  });

  it('exports WORKRAIL_DIR_MODE = 0o700', () => {
    expect(WORKRAIL_DIR_MODE).toBe(0o700);
  });

  it('creates a leaf directory with mode 0o700 (owner-only rwx)', async () => {
    // Skip on Windows: chmod / file modes are not POSIX there.
    if (process.platform === 'win32') return;

    const fsPort = new NodeFileSystemV2();
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workrail-perms-'));
    tempRoots.push(root);
    const target = path.join(root, 'leaf');

    const result = await fsPort.mkdirp(target);
    expect(result.isOk()).toBe(true);

    const stat = await fs.stat(target);
    // 0o700 survives any reasonable umask (mode & ~umask still yields 0o700
    // for any umask that does not further restrict owner permissions). A
    // missing `mode` arg would default to 0o777 & ~umask -> typically 0o755.
    expect(stat.mode & 0o777).toBe(0o700);
  });

  it('creates intermediate directories with mode 0o700 when recursive', async () => {
    if (process.platform === 'win32') return;

    const fsPort = new NodeFileSystemV2();
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workrail-perms-'));
    tempRoots.push(root);
    const a = path.join(root, 'a');
    const b = path.join(a, 'b');
    const c = path.join(b, 'c');

    const result = await fsPort.mkdirp(c);
    expect(result.isOk()).toBe(true);

    for (const p of [a, b, c]) {
      const stat = await fs.stat(p);
      expect(stat.mode & 0o777, `mode for ${p}`).toBe(0o700);
    }
  });
});
