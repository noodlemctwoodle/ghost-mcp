# Security Policy

## Supported Versions

This project is an actively maintained fork; security fixes land on the latest
released version.

| Version | Supported |
| ------- | --------- |
| 0.4.x   | Yes       |
| < 0.4   | No        |

## Reporting a Vulnerability

Please report security vulnerabilities **privately**. Do not open a public issue,
pull request, or discussion for a suspected vulnerability.

Use GitHub's **private vulnerability reporting** on this repository: open the
**Security** tab and click **Report a vulnerability**. This creates a private
advisory visible only to you and the maintainer.

When you report, please include where possible:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- the affected version and relevant configuration.

You will get an acknowledgement as soon as is practical. This is a small,
single-maintainer project, so responses are best effort, but security reports are
prioritised over other work.

## Handling credentials in reports

This server holds **Ghost Admin API credentials** and acts on a live Ghost site, so
credential handling and request safety are the primary concern. Never include real
API keys, tokens, or production URLs in a report or in any reproduction steps; redact
them or use throwaway values.

The existing controls (an upload SSRF guard, credential redaction across all output,
response validation on every tool, and dual-token least-privilege routing) are
described in the [README security section](README.md#security).

## Disclosure

Please allow a reasonable window to investigate and ship a fix before any public
disclosure. Fixes are released as a new version and noted in the release.
