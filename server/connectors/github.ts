// GitHub connector. Pulls the engineering signal founders cite in monthly
// updates: commits, PRs merged, releases shipped, contributors, stars delta.
// Output is formatted markdown — a synthesized "snapshot" note that BYOR
// treats as a Source.
//
// Auth: per-connection GitHub Personal Access Token (classic or fine-grained).
//   - Public repos: no scopes needed
//   - Private repos: `repo` scope

import type { Connector, ConnectorListItem, FetchedContent } from "./types";
import { readConfig } from "./types";

type GithubConfig = {
  apiKey: string;
  // 'owner/repo' or 'owner/repo,owner/repo2'. Optional — empty means user picks
  // when building a list, but for the snapshot path we need at least one.
  repos?: string;
  username?: string;
};

const API = "https://api.github.com";

function authed(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "BYOR/1.0 (+https://github.com/ahammadshibil/reportforge)",
    Accept: "application/vnd.github+json",
  };
}

async function ghGet(token: string, path: string) {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, { headers: authed(token) });
  if (!res.ok) throw new Error(`GitHub ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400 * 1000).toISOString();
}

function parseRepos(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^/]+\/[^/]+$/.test(s));
}

async function snapshotMarkdown(token: string, repos: string[], days: number): Promise<string> {
  if (repos.length === 0) {
    return `# GitHub snapshot — no repos configured\n\nAdd repos in the connection settings (format: owner/name, comma-separated).`;
  }

  const sections: string[] = [];
  let totalCommits = 0;
  let totalPRs = 0;
  let totalReleases = 0;
  let totalContributorsThisPeriod = new Set<string>();

  for (const slug of repos) {
    const [owner, name] = slug.split("/");
    const since = isoDaysAgo(days);
    try {
      const [repo, commits, prsResult, releases] = await Promise.all([
        ghGet(token, `/repos/${owner}/${name}`),
        ghGet(token, `/repos/${owner}/${name}/commits?since=${since}&per_page=100`).catch(() => []),
        // PRs merged since `since`: search API is cleanest
        ghGet(
          token,
          `/search/issues?q=${encodeURIComponent(
            `repo:${owner}/${name} is:pr is:merged merged:>=${since.slice(0, 10)}`
          )}&per_page=50`
        ).catch(() => ({ total_count: 0, items: [] })),
        ghGet(token, `/repos/${owner}/${name}/releases?per_page=20`).catch(() => []),
      ]);

      const commitCount = Array.isArray(commits) ? commits.length : 0;
      const prCount = (prsResult as any).total_count || 0;
      const recentReleases = (Array.isArray(releases) ? releases : []).filter(
        (r: any) => r.published_at && r.published_at >= since
      );
      const releaseCount = recentReleases.length;

      const authors = new Set<string>();
      for (const c of Array.isArray(commits) ? commits : []) {
        if (c.author?.login) authors.add(c.author.login);
        else if (c.commit?.author?.email) authors.add(c.commit.author.email);
      }
      authors.forEach((a) => totalContributorsThisPeriod.add(a));

      totalCommits += commitCount;
      totalPRs += prCount;
      totalReleases += releaseCount;

      const samplePRs = ((prsResult as any).items || []).slice(0, 5).map(
        (pr: any) => `  - #${pr.number} ${pr.title}  _by @${pr.user?.login || "?"}_`
      );
      const sampleReleases = recentReleases.slice(0, 5).map(
        (r: any) => `  - ${r.name || r.tag_name}  _(${(r.published_at || "").slice(0, 10)})_`
      );

      sections.push(`### ${slug}  · ⭐ ${repo.stargazers_count?.toLocaleString() ?? "?"}
- Commits: **${commitCount}**  (by ${authors.size} contributor${authors.size === 1 ? "" : "s"})
- PRs merged: **${prCount}**${samplePRs.length ? "\n" + samplePRs.join("\n") : ""}
- Releases: **${releaseCount}**${sampleReleases.length ? "\n" + sampleReleases.join("\n") : ""}`);
    } catch (e: any) {
      sections.push(`### ${slug}\n_${e?.message ?? "fetch failed"}_`);
    }
  }

  return `# GitHub snapshot — last ${days} days
*Across ${repos.length} repo${repos.length === 1 ? "" : "s"}: ${repos.join(", ")}*

## Headline
- Commits: **${totalCommits}**
- PRs merged: **${totalPRs}**
- Releases shipped: **${totalReleases}**
- Unique contributors: **${totalContributorsThisPeriod.size}**

${sections.join("\n\n")}
`;
}

export const github: Connector = {
  id: "github",
  label: "GitHub (engineering)",

  async createFromKey(input) {
    const apiKey = String(input.apiKey || "").trim();
    if (!apiKey) throw new Error("GitHub token required");
    const repos = input.repos ? String(input.repos).trim() : "";
    // Verify via /user
    const user = await ghGet(apiKey, "/user").catch((e) => {
      throw new Error(`GitHub auth failed: ${e?.message ?? e}`);
    });
    const username = user.login;
    return {
      config: { apiKey, repos, username } as unknown as Record<string, unknown>,
      accountEmail: user.email || undefined,
      name: `GitHub · @${username}${repos ? ` (${parseRepos(repos).length} repo${parseRepos(repos).length === 1 ? "" : "s"})` : ""}`,
    };
  },

  async list(_connection) {
    return {
      items: [
        { externalId: "snapshot:30d", title: "Last 30 days", mimeType: "text/markdown" },
        { externalId: "snapshot:90d", title: "Last 90 days", mimeType: "text/markdown" },
        { externalId: "snapshot:7d", title: "Last 7 days", mimeType: "text/markdown" },
      ],
    };
  },

  async fetch(connection, externalId): Promise<FetchedContent> {
    const cfg = readConfig<GithubConfig>(connection);
    const days =
      externalId === "snapshot:7d" ? 7
      : externalId === "snapshot:90d" ? 90
      : 30;
    const repos = parseRepos(cfg.repos);
    const md = await snapshotMarkdown(cfg.apiKey, repos, days);
    return {
      title: `GitHub — last ${days} days · ${new Date().toISOString().slice(0, 10)}`,
      content: md,
      mimeType: "text/markdown",
      meta: { snapshot: externalId, days, repos, fetchedAt: Date.now() },
    };
  },
};
