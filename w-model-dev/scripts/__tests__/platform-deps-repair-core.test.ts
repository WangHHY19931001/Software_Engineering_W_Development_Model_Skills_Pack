import { createHash } from "node:crypto";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  verifyPlatformDependency,
  type ArchiveEntry,
  type PlatformDependencyVerificationOptions,
} from "../lib/platform-deps-installer.js";

const packageName = "@rolldown/binding-win32-x64-msvc";
const packageVersion = "1.2.4";
const archive = Buffer.from("injected-platform-package");
const integrity = `sha512-${createHash("sha512").update(archive).digest("base64")}`;
const tempDir = "/isolated/platform-deps-test-123";

function makeLockfile(
  packageOverrides: Record<string, unknown> = {},
  lockfileOverrides: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    name: "fixture",
    version: "1.0.0",
    lockfileVersion: 3,
    requires: true,
    ...lockfileOverrides,
    packages: {
      "": { name: "fixture", version: "1.0.0" },
      [`node_modules/${packageName}`]: {
        version: packageVersion,
        resolved: `https://registry.npmjs.org/@rolldown/binding-win32-x64-msvc/-/${packageVersion}.tgz`,
        integrity,
        ...packageOverrides,
      },
    },
  });
}

function makeEntries(overrides?: ArchiveEntry): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [
    { path: "package", type: "directory" },
    {
      path: "package/package.json",
      type: "file",
      content: JSON.stringify({ name: packageName, version: packageVersion }),
    },
    {
      path: "package/index.js",
      type: "file",
      content: "module.exports = true;",
    },
  ];
  if (overrides) {
    entries.push(overrides);
  }
  return entries;
}

function makeOptions(
  entries: ArchiveEntry[] = makeEntries(),
  overrides: Partial<PlatformDependencyVerificationOptions> = {},
): PlatformDependencyVerificationOptions {
  const removed: string[] = [];
  return {
    lockfile: makeLockfile(),
    packageName,
    allowedRegistryHosts: ["registry.npmjs.org"],
    archive,
    readArchiveEntries: async () => entries,
    extractArchive: async () => undefined,
    createTemporaryDirectory: async () => tempDir,
    removeTemporaryDirectory: async (directory) => {
      removed.push(directory);
    },
    loadModule: async () => ({ loaded: true }),
    ...overrides,
    testState: { removed },
  } as PlatformDependencyVerificationOptions;
}

describe("verifyPlatformDependency", () => {
  it("verifies lock metadata, archive integrity, package identity, and isolated module loading", async () => {
    let extractedTo = "";
    let loadedFrom = "";
    const options = makeOptions(undefined, {
      extractArchive: async (_input, directory) => {
        extractedTo = directory;
      },
      loadModule: async (packageRoot) => {
        loadedFrom = packageRoot;
        return { loaded: true };
      },
    });

    const result = await verifyPlatformDependency(options);

    expect(result.locked).toEqual({
      name: packageName,
      version: packageVersion,
      resolved: `https://registry.npmjs.org/@rolldown/binding-win32-x64-msvc/-/${packageVersion}.tgz`,
      integrity,
    });
    expect(result.loadedModule).toEqual({ loaded: true });
    expect(extractedTo).toBe(tempDir);
    expect(loadedFrom).toBe(path.join(tempDir, "package"));
    expect(
      (
        options as PlatformDependencyVerificationOptions & {
          testState: { removed: string[] };
        }
      ).testState.removed,
    ).toEqual([tempDir]);
  });

  it("rejects a lockfile that is not version 3", async () => {
    await expect(
      verifyPlatformDependency({
        ...makeOptions(),
        lockfile: makeLockfile({}, { lockfileVersion: 2 }),
      }),
    ).rejects.toMatchObject({ code: "lockfile-version" });
  });

  it("rejects a lockfile that is not valid JSON", async () => {
    await expect(
      verifyPlatformDependency({ ...makeOptions(), lockfile: "not json {" }),
    ).rejects.toMatchObject({ code: "lockfile-json" });
  });

  it("rejects a lockfile without the target package entry", async () => {
    await expect(
      verifyPlatformDependency({
        ...makeOptions(),
        lockfile: JSON.stringify({
          name: "fixture",
          version: "1.0.0",
          lockfileVersion: 3,
          packages: {},
        }),
      }),
    ).rejects.toMatchObject({ code: "lockfile-package" });
  });

  it("rejects a registry URL whose host is not allowlisted", async () => {
    await expect(
      verifyPlatformDependency({
        ...makeOptions(),
        lockfile: makeLockfile({
          resolved: "https://evil.example.invalid/package.tgz",
        }),
      }),
    ).rejects.toMatchObject({ code: "registry-host" });
  });

  it("rejects a registry URL that is not HTTPS", async () => {
    await expect(
      verifyPlatformDependency({
        ...makeOptions(),
        lockfile: makeLockfile({
          resolved: "http://registry.npmjs.org/package.tgz",
        }),
      }),
    ).rejects.toMatchObject({ code: "registry-protocol" });
  });

  it("rejects an archive whose SHA-512 SRI does not match the lockfile", async () => {
    let readCalled = false;
    await expect(
      verifyPlatformDependency({
        ...makeOptions(),
        lockfile: makeLockfile({
          integrity:
            "sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
        }),
        readArchiveEntries: async () => {
          readCalled = true;
          return makeEntries();
        },
      }),
    ).rejects.toMatchObject({ code: "integrity" });
    expect(readCalled).toBe(false);
  });

  it("rejects a non-canonical (unpadded) SHA-512 SRI even when it decodes to 64 bytes", async () => {
    const unpadded = `${integrity.replace(/==$/, "")}`;
    await expect(
      verifyPlatformDependency({
        ...makeOptions(),
        lockfile: makeLockfile({ integrity: unpadded }),
      }),
    ).rejects.toMatchObject({ code: "integrity" });
  });

  it("rejects an SRI whose base64 payload is not 64 bytes", async () => {
    await expect(
      verifyPlatformDependency({
        ...makeOptions(),
        lockfile: makeLockfile({ integrity: "sha512-QUJD" }),
      }),
    ).rejects.toMatchObject({ code: "integrity" });
  });

  it("rejects an SRI with a non-SHA-512 prefix", async () => {
    await expect(
      verifyPlatformDependency({
        ...makeOptions(),
        lockfile: makeLockfile({ integrity: "sha1-QUJD" }),
      }),
    ).rejects.toMatchObject({ code: "integrity" });
  });

  it("accepts a conventional trailing slash on a safe tar directory entry", async () => {
    const entries = makeEntries();
    entries[0] = { path: "package/", type: "directory" };

    await expect(
      verifyPlatformDependency(makeOptions(entries)),
    ).resolves.toMatchObject({ locked: { name: packageName } });
  });

  it.each([
    "/absolute/file",
    "../outside/file",
    "package/../../outside/file",
    "C:\\outside\\file",
    "\\\\server\\share\\file",
  ])("rejects unsafe tar entry path %s", async (entryPath) => {
    await expect(
      verifyPlatformDependency(
        makeOptions([{ path: entryPath, type: "file", content: "bad" }]),
      ),
    ).rejects.toMatchObject({ code: "archive-path" });
  });

  it("rejects symbolic-link tar entries before extraction", async () => {
    let extracted = false;
    await expect(
      verifyPlatformDependency(
        makeOptions(
          [
            {
              path: "package/native.node",
              type: "symlink",
              linkname: "/outside/native.node",
            },
          ],
          {
            extractArchive: async () => {
              extracted = true;
            },
          },
        ),
      ),
    ).rejects.toMatchObject({ code: "archive-link" });
    expect(extracted).toBe(false);
  });

  it("rejects hard-link tar entries before extraction", async () => {
    let extracted = false;
    await expect(
      verifyPlatformDependency(
        makeOptions(
          makeEntries({
            path: "package/native.node",
            type: "hardlink",
            linkname: "lib/native.node",
          }),
          {
            extractArchive: async () => {
              extracted = true;
            },
          },
        ),
      ),
    ).rejects.toMatchObject({ code: "archive-link" });
    expect(extracted).toBe(false);
  });

  it("rejects a file entry that carries a linkname", async () => {
    await expect(
      verifyPlatformDependency(
        makeOptions(
          makeEntries({
            path: "package/weird.node",
            type: "file",
            content: "x",
            linkname: "/etc/passwd",
          }),
        ),
      ),
    ).rejects.toMatchObject({ code: "archive-link" });
  });

  it("rejects an empty archive entry path", async () => {
    await expect(
      verifyPlatformDependency(makeOptions([{ path: "", type: "directory" }])),
    ).rejects.toMatchObject({ code: "archive-path" });
  });

  it("rejects an archive entry path containing NUL bytes", async () => {
    await expect(
      verifyPlatformDependency(
        makeOptions([{ path: "package\0x", type: "file" }]),
      ),
    ).rejects.toMatchObject({ code: "archive-path" });
  });

  it("rejects an archive entry path with an empty path segment", async () => {
    await expect(
      verifyPlatformDependency(
        makeOptions([{ path: "package//evil", type: "file", content: "x" }]),
      ),
    ).rejects.toMatchObject({ code: "archive-path" });
  });

  it("rejects package.json name mismatches", async () => {
    const entries = makeEntries();
    entries[1] = {
      path: "package/package.json",
      type: "file",
      content: JSON.stringify({
        name: "different-package",
        version: packageVersion,
      }),
    };

    await expect(
      verifyPlatformDependency(makeOptions(entries)),
    ).rejects.toMatchObject({ code: "package-name" });
  });

  it("rejects package.json version mismatches", async () => {
    const entries = makeEntries();
    entries[1] = {
      path: "package/package.json",
      type: "file",
      content: JSON.stringify({ name: packageName, version: "9.9.9" }),
    };

    await expect(
      verifyPlatformDependency(makeOptions(entries)),
    ).rejects.toMatchObject({ code: "package-version" });
  });

  it("rejects an archive that lacks package/package.json", async () => {
    await expect(
      verifyPlatformDependency(
        makeOptions([{ path: "package", type: "directory" }]),
      ),
    ).rejects.toMatchObject({ code: "package-json" });
  });

  it("rejects an archive whose package/package.json is not valid JSON", async () => {
    await expect(
      verifyPlatformDependency(
        makeOptions([
          { path: "package", type: "directory" },
          { path: "package/package.json", type: "file", content: "{bad json" },
        ]),
      ),
    ).rejects.toMatchObject({ code: "package-json" });
  });

  it("cleans the isolated temporary directory when module loading fails", async () => {
    const removed: string[] = [];
    await expect(
      verifyPlatformDependency(
        makeOptions(undefined, {
          removeTemporaryDirectory: async (directory) => {
            removed.push(directory);
          },
          loadModule: async () => {
            throw new Error("load failed");
          },
        }),
      ),
    ).rejects.toThrow("load failed");
    expect(removed).toEqual([tempDir]);
  });
});
