import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareManagedCodexHome } from "./codex-home.js";

describe("prepareManagedCodexHome", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tolerates auth.json symlink races when another run wins the create step", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-codex-home-race-"));
    const sharedHome = path.join(root, "shared-codex-home");
    const paperclipHome = path.join(root, "paperclip-home");
    const companyId = "company-1";
    const targetHome = path.join(
      paperclipHome,
      "instances",
      "default",
      "companies",
      companyId,
      "codex-home",
    );
    const targetAuth = path.join(targetHome, "auth.json");
    const sourceAuth = path.join(sharedHome, "auth.json");

    await fs.mkdir(sharedHome, { recursive: true });
    await fs.writeFile(sourceAuth, '{"token":"shared"}\n', "utf8");

    const realSymlink = fs.symlink.bind(fs);
    let injectedRace = false;
    vi.spyOn(fs, "symlink").mockImplementation(async (source, target, type) => {
      if (!injectedRace && String(target) === targetAuth) {
        injectedRace = true;
        await realSymlink(source, target, type);
        const error = new Error(
          `EEXIST: file already exists, symlink '${String(source)}' -> '${String(target)}'`,
        ) as NodeJS.ErrnoException;
        error.code = "EEXIST";
        throw error;
      }

      return realSymlink(source, target, type);
    });

    const resolved = await prepareManagedCodexHome(
      {
        ...process.env,
        CODEX_HOME: sharedHome,
        PAPERCLIP_HOME: paperclipHome,
        PAPERCLIP_INSTANCE_ID: "default",
      },
      async () => {},
      companyId,
    );

    expect(injectedRace).toBe(true);
    expect(resolved).toBe(targetHome);
    expect(await fs.realpath(targetAuth)).toBe(await fs.realpath(sourceAuth));
  });
});
