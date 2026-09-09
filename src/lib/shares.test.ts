import { describe, expect, it } from "vitest";
import { repositoryShortcut } from "./shares";

describe("repository shortcuts", () => {
  it("prefills valid owner/repository paths without fetching repository access", () => {
    expect(repositoryShortcut("octocat/hello-world")).toBe("octocat/hello-world");
    expect(repositoryShortcut("/Octocat/hello-world/")).toBe("Octocat/hello-world");
    expect(repositoryShortcut("octocat/hello-world.git")).toBe("octocat/hello-world");
  });

  it("reserves share codes and leaves repository browsing paths alone", () => {
    expect(repositoryShortcut("octocat/7m4k-p9rx-2w6c-8h3n")).toBeNull();
    expect(repositoryShortcut("octocat/7M4K-P9RX-2W6C-8H3N")).toBeNull();
    expect(repositoryShortcut("octocat/hello-world/tree")).toBeNull();
    expect(repositoryShortcut("octocat/hello-world/blob/main/README.md")).toBeNull();
  });

  it("rejects malformed and traversal paths", () => {
    for (const path of [
      "octocat",
      "octocat/..",
      "octocat/%2e%2e",
      "-owner/repo",
      "owner//repo",
      "github.com/owner/repo",
    ]) {
      expect(repositoryShortcut(path)).toBeNull();
    }
  });
});
