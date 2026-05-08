// MCP server presets — curated list of MCPs verified to exist as of May 2026.
// Status reflects scouting from the BYOR MCP integration plan:
//   official        = first-party from the vendor
//   community-mature = active GitHub project, well-maintained
//   community-fragile = browser-driven (no upstream API), expect drift

export type McpPreset = {
  id: string;
  label: string;
  description: string;
  status: "official" | "community-mature" | "community-fragile";
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  // env vars the user must supply (rendered as inputs in the UI)
  envFields?: Array<{ key: string; label: string; placeholder?: string; required?: boolean }>;
  homepage: string;
};

export const MCP_PRESETS: McpPreset[] = [
  {
    id: "colab",
    label: "Google Colab",
    description:
      "Run code in Colab notebooks. Bridges to a real browser session — start the local extension first.",
    status: "official",
    transport: "stdio",
    command: "uvx",
    args: ["--from", "git+https://github.com/googlecolab/colab-mcp", "colab-mcp"],
    homepage: "https://github.com/googlecolab/colab-mcp",
  },
  {
    id: "notion",
    label: "Notion (official)",
    description:
      "Search, read, create, manage Notion pages and databases. Official.",
    status: "official",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@notionhq/notion-mcp-server"],
    envFields: [
      {
        key: "NOTION_TOKEN",
        label: "Notion Integration Token",
        placeholder: "secret_…",
        required: true,
      },
    ],
    homepage: "https://github.com/makenotion/notion-mcp-server",
  },
  {
    id: "perplexity",
    label: "Perplexity (official)",
    description:
      "Real-time web search + grounded research via Sonar. Use as a source to ground synthesis.",
    status: "official",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@perplexity-ai/mcp-server"],
    envFields: [
      {
        key: "PERPLEXITY_API_KEY",
        label: "Perplexity API Key",
        placeholder: "pplx-…",
        required: true,
      },
    ],
    homepage: "https://github.com/perplexityai/modelcontextprotocol",
  },
  {
    id: "jupyter",
    label: "Jupyter (Datalayer)",
    description:
      "Run code in a JupyterLab kernel. Use for vault embeddings, semantic search, model inference.",
    status: "community-mature",
    transport: "stdio",
    command: "uvx",
    args: ["--from", "jupyter-mcp-server", "jupyter-mcp-server"],
    envFields: [
      { key: "DOCUMENT_URL", label: "Jupyter URL", placeholder: "http://localhost:8888" },
      { key: "DOCUMENT_TOKEN", label: "Jupyter Token", required: true },
    ],
    homepage: "https://github.com/datalayer/jupyter-mcp-server",
  },
  {
    id: "airtable",
    label: "Airtable (community)",
    description:
      "Read & write Airtable bases. Alternative to BYOR's native Airtable connector.",
    status: "community-mature",
    transport: "stdio",
    command: "npx",
    args: ["-y", "airtable-mcp-server"],
    envFields: [
      {
        key: "AIRTABLE_API_KEY",
        label: "Airtable PAT",
        placeholder: "pat…",
        required: true,
      },
    ],
    homepage: "https://github.com/domdomegg/airtable-mcp-server",
  },
  {
    id: "obsidian",
    label: "Obsidian (Local REST API)",
    description:
      "Read & write your Obsidian vault. Requires the `Local REST API` plugin enabled in Obsidian.",
    status: "community-mature",
    transport: "stdio",
    command: "npx",
    args: ["-y", "obsidian-mcp-server"],
    envFields: [
      { key: "OBSIDIAN_API_KEY", label: "Local REST API Key", required: true },
      {
        key: "OBSIDIAN_BASE_URL",
        label: "Local REST API URL",
        placeholder: "https://127.0.0.1:27124",
      },
    ],
    homepage: "https://github.com/cyanheads/obsidian-mcp-server",
  },
  {
    id: "notebooklm",
    label: "NotebookLM (browser-driven)",
    description:
      "Grounded Q&A over NotebookLM notebooks. ⚠️ Drives a real Chrome via Playwright — fragile when Google updates the UI.",
    status: "community-fragile",
    transport: "stdio",
    command: "npx",
    args: ["-y", "notebooklm-mcp"],
    homepage: "https://github.com/PleasePrompto/notebooklm-mcp",
  },
  {
    id: "substack",
    label: "Substack (browser-driven)",
    description:
      "Create & publish Substack posts. ⚠️ Browser automation — Substack has no posting API.",
    status: "community-fragile",
    transport: "stdio",
    command: "npx",
    args: ["-y", "substack-mcp"],
    envFields: [
      { key: "SUBSTACK_EMAIL", label: "Substack email", required: true },
      { key: "SUBSTACK_PASSWORD", label: "Substack password", required: true },
    ],
    homepage: "https://github.com/marcomoauro/substack-mcp",
  },
  {
    id: "custom",
    label: "Custom MCP server",
    description:
      "Connect to any other MCP server by command (stdio) or URL (HTTP/SSE).",
    status: "community-mature",
    transport: "stdio",
    homepage: "https://modelcontextprotocol.io",
  },
];

export function getPreset(id: string): McpPreset | undefined {
  return MCP_PRESETS.find((p) => p.id === id);
}
