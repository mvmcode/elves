# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | Yes |
| Older releases | No |

## Reporting a Vulnerability

If you discover a security vulnerability in ELVES, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. **GitHub Security Advisories** (preferred): Go to the [Security tab](https://github.com/mvmcode/elves/security/advisories) and create a new advisory.
2. **Email**: Contact the maintainers directly.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

### Response Timeline

- **Acknowledge**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Fix for critical issues**: Within 7 days
- **Fix for non-critical issues**: Next release cycle

### Scope

ELVES runs locally on your machine. The primary security concerns are:

- **Process execution**: ELVES spawns Claude Code and Codex as child processes
- **Local data**: SQLite database and markdown files in `~/.elves/`
- **IPC boundary**: Communication between the Rust backend and WebView frontend

We take all reports seriously and will work with you to understand and address the issue.
