// SD-015 FileStore + FileService unit tests (TC-UNIT-065 ~ TC-UNIT-070).

import { describe, it, expect, beforeEach } from 'vitest';
import { FileStore, validateMagic, sanitizeFilename } from '../../src/stores/file.store.js';
import { FileService } from '../../src/services/file.service.js';
import { UserStore } from '../../src/stores/user.store.js';
import { DAILY_QUOTA_LIMIT, FILE_SIZE_LIMIT } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-015 FileStore + FileService (TC-UNIT-065 ~ 070)', () => {
  let fileStore: FileStore;
  let userStore: UserStore;
  let fileService: FileService;
  let userId: string;

  beforeEach(() => {
    fileStore = new FileStore();
    userStore = new UserStore();
    fileService = new FileService(fileStore, userStore);
    // Capture the actual user id — the UserStore module-level counter persists
    // across test cases within a file, so the id may not be 'u-1' after the first test.
    const user = userStore.create({
      email: 'u@x.com',
      password: 'passwordpassword',
      displayName: 'u',
    });
    userId = user.id;
  });

  /** Helper: minimal valid PNG buffer (8x1 pixel). */
  function pngBuffer(): Buffer {
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A + IHDR chunk header
    return Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    ]);
  }

  /** Helper: minimal valid JPEG buffer. */
  function jpegBuffer(): Buffer {
    return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  }

  it('TC-UNIT-065: file exceeding 10MB throws 1041', () => {
    const big = Buffer.alloc(FILE_SIZE_LIMIT + 1);
    big[0] = 0x89; big[1] = 0x50; big[2] = 0x4e; big[3] = 0x47; // PNG magic.
    expect(() =>
      fileStore.create('u-1', { filename: 'big.png', mimeType: 'image/png', content: big }),
    ).toThrow(AppError);
    try {
      fileStore.create('u-1', { filename: 'big.png', mimeType: 'image/png', content: big });
    } catch (err) {
      expect((err as AppError).code).toBe(1041);
    }
  });

  it('TC-UNIT-066: magic number mismatch returns false', () => {
    const jpeg = jpegBuffer();
    const result = validateMagic(jpeg, 'image/png');
    expect(result).toBe(false);
  });

  it('TC-UNIT-067: SHA-256 dedup does not store duplicate content', () => {
    const png = pngBuffer();
    const initial = fileStore.size();
    fileStore.create('u-1', { filename: 'a.png', mimeType: 'image/png', content: png });
    // Second upload with same content → dedup, no new file stored.
    fileStore.create('u-1', { filename: 'b.png', mimeType: 'image/png', content: png });
    expect(fileStore.size()).toBe(initial + 1);
  });

  it('TC-UNIT-068: sanitizeFilename removes path separators and ..', () => {
    const result = sanitizeFilename('../../etc/passwd');
    expect(result).not.toContain('..');
    expect(result).not.toContain('/');
    expect(result).not.toContain('\\');
  });

  it('TC-UNIT-069: daily quota exceeded throws 1005', () => {
    // DAILY_QUOTA_LIMIT = 50MB, FILE_SIZE_LIMIT = 10MB.
    // Upload 5 distinct 10MB PNG files (50MB total = DAILY_QUOTA_LIMIT).
    // Each file is exactly FILE_SIZE_LIMIT bytes (size > FILE_SIZE_LIMIT is strict, so 10MB is OK).
    // Each file has a unique byte at offset 4 to avoid SHA-256 dedup.
    for (let i = 0; i < 5; i++) {
      const buf = Buffer.alloc(FILE_SIZE_LIMIT); // exactly 10MB
      buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47; // PNG magic
      buf[4] = i; // distinct content
      fileStore.create(userId, { filename: `big${i}.png`, mimeType: 'image/png', content: buf });
    }

    // A 6th small PNG (4 bytes magic) would push daily quota over 50MB → 1005.
    const small = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(() =>
      fileService.upload(userId, { filename: 'small.png', mimeType: 'image/png', content: small }),
    ).toThrow(AppError);
    try {
      fileService.upload(userId, { filename: 'small.png', mimeType: 'image/png', content: small });
    } catch (err) {
      expect((err as AppError).code).toBe(1005);
    }
  });

  it('TC-UNIT-070: getQuota aggregates daily used bytes correctly', () => {
    // Upload 3 distinct small PNG files.
    for (let i = 0; i < 3; i++) {
      const buf = pngBuffer();
      buf[4] = i; // make distinct to avoid dedup.
      fileStore.create(userId, { filename: `f${i}.png`, mimeType: 'image/png', content: buf });
    }
    const expected = pngBuffer().length * 3;
    const quota = fileService.getQuota(userId);
    expect(quota.dailyUsed).toBe(expected);
  });
});
