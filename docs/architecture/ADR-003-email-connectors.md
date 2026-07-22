# ADR-003: Email connectors create drafts but never send automatically

**Status:** Accepted for connector implementation

**Date:** 22 July 2026

## Context

Flowcraft’s flagship workflow turns a new inbox message into a grounded reply. A live version needs access to a user’s mailbox, but email is an external communication channel with privacy, impersonation, duplication, and accidental-send risk.

## Decision

The first live connector will support one provider selected by the user: Gmail or Outlook. Authentication will use server-side OAuth. Refresh tokens and provider secrets will never be stored in browser storage, workflow JSON, logs, or node configuration.

The initial permission boundary is:

- read explicitly selected inbox messages or a narrowly configured inbox scope;
- create a draft reply;
- read connection and draft-creation status;
- no automatic send permission.

Every provider run will preserve the provider message ID as an idempotency key. A repeated event must update or reuse the existing workflow run rather than create duplicate drafts.

The workflow ends at **Save draft**. The resulting email remains in the provider for human review and manual sending.

## Product states

- **Demo mailbox:** local, deterministic, and clearly labeled.
- **Provider selected but not connected:** execution blocked with a setup message.
- **Connected:** last sync time, account identity, granted scopes, and draft result are visible.
- **Expired or revoked:** execution blocked until reconnection.

## Consequences

- The local demo remains fully runnable without credentials.
- Live email access requires a backend callback URL, encrypted token storage, provider-specific OAuth configuration, and a user authorization step.
- Gmail and Outlook cannot be treated as interchangeable at implementation time; the user must choose which provider is first.
- Automatic sending is deliberately excluded from the initial connector.
