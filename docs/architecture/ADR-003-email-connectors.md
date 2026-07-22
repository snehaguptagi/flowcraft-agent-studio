# ADR-003: Connections are separate credentials; email creates drafts but never sends

**Status:** Accepted and partially implemented

**Date:** 22 July 2026

## Context

Flowcraft’s flagship workflow turns a new inbox message into a grounded reply. A live version needs access to a user’s mailbox, but email is an external communication channel with privacy, impersonation, duplication, and accidental-send risk. The broader workflow builder also needs reusable third-party tool connections that are managed outside the graph, like n8n credentials.

## Decision

Connections are first-class resources stored separately from workflow graphs. Nodes reference a connection ID; they never carry tokens or treat a provider label as proof of authentication. Saving connection metadata does not mark a credential connected. The server must complete OAuth and test the provider before assigning `connected` status.

The connection vault supports setup records for Gmail, Outlook, Slack, Google Calendar, Notion, and webhooks. OAuth state and connection metadata are stored in D1. Provider tokens are encrypted server-side with `CONNECTION_ENCRYPTION_KEY`. Refresh tokens and provider secrets are never stored in browser storage, workflow JSON, logs, or node configuration.

The first live workflow actions are email-specific and support Gmail and Outlook connections. Authentication uses server-side OAuth.

The initial permission boundary is:

- read inbox messages through the selected provider connection;
- create a draft reply;
- read connection, test, and draft-creation status;
- no automatic email sending.

Every provider run will preserve the provider message ID as an idempotency key. A repeated event must update or reuse the existing workflow run rather than create duplicate drafts.

The local workflow ends at **Preview draft** and has no external side effect. A live workflow may end at **Create provider draft** only when the referenced credential is authenticated and the connector is operational. The resulting email remains in the provider for human review and manual sending.

## Product states

- **Sample input / preview output:** local, deterministic, and explicitly not a mailbox connection.
- **Setup saved but not authenticated:** `Authentication required`; execution blocked.
- **Connected:** last sync time, account identity, granted scopes, and draft result are visible.
- **Expired or revoked:** execution blocked until reconnection.

## Consequences

- The local demo remains fully runnable without credentials.
- Live email access requires a backend callback URL, encrypted token storage, provider-specific OAuth configuration, and a user authorization step.
- Non-email providers can be authenticated and tested before their corresponding workflow action nodes exist.
- Gmail and Outlook cannot be treated as interchangeable at runtime; email nodes must call provider-specific read and draft APIs.
- Automatic sending is deliberately excluded from the initial connector.
