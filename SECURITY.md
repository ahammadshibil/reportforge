# Security Policy

## Reporting a vulnerability

If you find a security issue, **please don't open a public GitHub issue.** Instead, email me at `shibil.ahammad@specialeinvest.com` with:

- A clear description of the issue
- Reproduction steps
- The version (git commit SHA) where you found it
- Optional: your handle if you'd like credit in the fix announcement

I aim to respond within 72 hours and ship a fix within 7 days for high-severity issues.

## Scope

In scope:
- The BYOR codebase (server, client, MCP server, connectors)
- The provisioning script
- Default Dockerfile + railway.toml configurations
- The hosted instance at `byor-shibil-production.up.railway.app` (test workspaces only please — don't probe other users' data)

Out of scope:
- Third-party MCP servers BYOR connects to (report to their respective maintainers)
- The user's own LLM provider (Anthropic, OpenAI, Gemini, etc)
- Issues that require physical or root access to the host

## What I'm shipping security-wise today

- AES-256-GCM at-rest encryption for connection configs (OAuth tokens, API keys)
- Session-based auth with persistent SQLite session store
- bcrypt-hashed admin password support (`ADMIN_PASSWORD_HASH`)
- Login rate-limit (10 attempts per 5min per IP)
- SSRF defense on user-supplied URLs (private/link-local IPs blocked, scheme allowlist)
- Cookies: httpOnly, sameSite=lax, secure in production
- All sensitive operations behind `requireAuth` middleware

## What's still TBD (PRs welcome)

- CSP headers
- CSRF tokens (currently relying on sameSite=lax + Fetch credentials)
- Per-user audit log (single-admin today, so audit = git history of admin actions)
- 2FA / SSO (depends on demand)
- Per-tenant key rotation tooling

## Disclosure timeline

I'll credit you in the fix commit + the release notes unless you ask me not to. I won't publish details before the fix ships.

Thank you for helping keep BYOR safe.
