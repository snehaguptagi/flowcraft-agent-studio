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

The local workflow ends at **Preview draft** and has no external side effect. A live workflow may end at **Create provider draft** only when the referenced credential is authenticated and the connector is operational. The resulting email remains in the provider for human review and manual sending.

Credentials are first-class resources stored separately from workflow graphs. Nodes reference a credential ID; they never carry tokens or treat a provider label as proof of authentication. Saving connection metadata does not mark a credential connected. The server must complete OAuth and test the provider before assigning `connected` status.

## Product states

- **Sample input / preview output:** local, deterministic, and explicitly not a mailbox connection.
- **Setup saved but not authenticated:** `Authentication required`; execution blocked.
- **Connected:** last sync time, account identity, granted scopes, and draft result are visible.
- **Expired or revoked:** execution blocked until reconnection.

## Consequences

- The local demo remains fully runnable without credentials.
- Live email access requires a backend callback URL, encrypted token storage, provider-specific OAuth configuration, and a user authorization step.
- Gmail and Outlook cannot be treated as interchangeable at implementation time; the user must choose which provider is first.
- Automatic sending is deliberately excluded from the initial connector.
