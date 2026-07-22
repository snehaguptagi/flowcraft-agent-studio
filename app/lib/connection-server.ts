import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import { connections, oauthStates } from "../../db/schema";
import {
  getIntegrationProvider,
  integrationProviders,
  isEmailProvider,
  type ConnectionProvider,
  type ConnectionRecord,
  type ConnectionStatus,
} from "./integrations";

type RuntimeEnv = {
  DB?: D1Database;
  CONNECTION_ENCRYPTION_KEY?: string;
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  OUTLOOK_CLIENT_ID?: string;
  OUTLOOK_CLIENT_SECRET?: string;
  SLACK_CLIENT_ID?: string;
  SLACK_CLIENT_SECRET?: string;
  GOOGLE_CALENDAR_CLIENT_ID?: string;
  GOOGLE_CALENDAR_CLIENT_SECRET?: string;
  NOTION_CLIENT_ID?: string;
  NOTION_CLIENT_SECRET?: string;
};

type ConnectionRow = typeof connections.$inferSelect;

type OAuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
  [key: string]: unknown;
};

type OAuthConfig = {
  provider: Exclude<ConnectionProvider, "webhook">;
  clientIdKey: keyof RuntimeEnv;
  clientSecretKey: keyof RuntimeEnv;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  authParams?: Record<string, string>;
  tokenAuth?: "body" | "basic";
};

const oauthConfigs: Record<Exclude<ConnectionProvider, "webhook">, OAuthConfig> = {
  gmail: {
    provider: "gmail",
    clientIdKey: "GMAIL_CLIENT_ID",
    clientSecretKey: "GMAIL_CLIENT_SECRET",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
    authParams: {
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    },
  },
  outlook: {
    provider: "outlook",
    clientIdKey: "OUTLOOK_CLIENT_ID",
    clientSecretKey: "OUTLOOK_CLIENT_SECRET",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["offline_access", "User.Read", "Mail.Read", "Mail.ReadWrite"],
  },
  slack: {
    provider: "slack",
    clientIdKey: "SLACK_CLIENT_ID",
    clientSecretKey: "SLACK_CLIENT_SECRET",
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: ["channels:read", "chat:write"],
  },
  "google-calendar": {
    provider: "google-calendar",
    clientIdKey: "GOOGLE_CALENDAR_CLIENT_ID",
    clientSecretKey: "GOOGLE_CALENDAR_CLIENT_SECRET",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    authParams: {
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    },
  },
  notion: {
    provider: "notion",
    clientIdKey: "NOTION_CLIENT_ID",
    clientSecretKey: "NOTION_CLIENT_SECRET",
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    scopes: [],
    authParams: {
      owner: "user",
    },
    tokenAuth: "basic",
  },
};

async function getRuntimeEnv() {
  const workers = await import("cloudflare:workers");
  return workers.env as unknown as RuntimeEnv;
}

async function getDb() {
  const runtimeEnv = await getRuntimeEnv();
  if (!runtimeEnv.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database.",
    );
  }
  return drizzle(runtimeEnv.DB, { schema });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function base64UrlEncode(value: string) {
  return bytesToBase64(new TextEncoder().encode(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return new TextDecoder().decode(base64ToBytes(padded));
}

async function getEncryptionKey() {
  const runtimeEnv = await getRuntimeEnv();
  const configured = runtimeEnv.CONNECTION_ENCRYPTION_KEY?.trim();
  if (!configured) throw new Error("CONNECTION_ENCRYPTION_KEY is not configured.");

  let material: Uint8Array;
  try {
    material = base64ToBytes(configured);
  } catch {
    material = new Uint8Array();
  }

  if (material.length !== 32) {
    material = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(configured)));
  }

  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptJson(value: unknown) {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return `${bytesToBase64(iv)}.${bytesToBase64(ciphertext)}`;
}

async function decryptJson<T>(value: string) {
  const [ivValue, ciphertextValue] = value.split(".");
  if (!ivValue || !ciphertextValue) throw new Error("Stored token payload is malformed.");
  const key = await getEncryptionKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivValue) },
    key,
    base64ToBytes(ciphertextValue),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

function validProvider(value: unknown): value is ConnectionProvider {
  return typeof value === "string" && integrationProviders.some((provider) => provider.id === value);
}

function ownerEmailFrom(request: Request) {
  return request.headers.get("oai-authenticated-user-email")?.trim() || "local-user";
}

function parseScopes(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((scope): scope is string => typeof scope === "string") : [];
  } catch {
    return [];
  }
}

function publicConnection(row: ConnectionRow): ConnectionRecord {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider as ConnectionProvider,
    status: row.status as ConnectionStatus,
    createdAt: row.createdAt,
    accountLabel: row.accountLabel,
    statusReason: row.statusReason,
    lastTestedAt: row.lastTestedAt,
    scopes: parseScopes(row.scopes),
  };
}

function routeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("D1 binding `DB` is unavailable")) {
    return "The connection vault needs the deployed database binding. Set `.openai/hosting.json` d1 to DB and deploy.";
  }
  if (message.includes("no such table") || message.includes("connections")) {
    return "The connection tables are not available yet. Generate and deploy the D1 migration before using live connections.";
  }
  return message;
}

function jsonError(error: unknown, status = 500) {
  return Response.json({ error: routeErrorMessage(error) }, { status });
}

function getOAuthConfig(provider: ConnectionProvider) {
  if (provider === "webhook") return null;
  return oauthConfigs[provider];
}

function requiredSetup(provider: ConnectionProvider) {
  const oauth = getOAuthConfig(provider);
  const setup = ["CONNECTION_ENCRYPTION_KEY"];
  if (oauth) setup.unshift(String(oauth.clientSecretKey));
  if (oauth) setup.unshift(String(oauth.clientIdKey));
  return setup;
}

async function oauthReady(provider: ConnectionProvider) {
  const oauth = getOAuthConfig(provider);
  if (!oauth) return { ready: false, missing: [] as string[] };
  const runtimeEnv = await getRuntimeEnv();
  const missing = requiredSetup(provider).filter((key) => !runtimeEnv[key as keyof RuntimeEnv]);
  return { ready: missing.length === 0, missing };
}

function redirectUriFor(request: Request) {
  return new URL("/api/connections/oauth/callback", request.url).toString();
}

function safeReturnPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

async function getOwnedConnection(id: string, ownerEmail: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, id), eq(connections.ownerEmail, ownerEmail)))
    .limit(1);
  return row;
}

async function updateConnectionStatus(
  id: string,
  ownerEmail: string,
  values: Partial<ConnectionRow>,
) {
  const db = await getDb();
  const [row] = await db
    .update(connections)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(and(eq(connections.id, id), eq(connections.ownerEmail, ownerEmail)))
    .returning();
  return row;
}

async function exchangeToken(config: OAuthConfig, code: string, redirectUri: string) {
  const runtimeEnv = await getRuntimeEnv();
  const clientId = runtimeEnv[config.clientIdKey];
  const clientSecret = runtimeEnv[config.clientSecretKey];
  if (!clientId || !clientSecret) throw new Error(`${config.provider} OAuth is not configured.`);

  let response: Response;
  if (config.tokenAuth === "basic") {
    response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        authorization: `Basic ${bytesToBase64(new TextEncoder().encode(`${clientId}:${clientSecret}`))}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
  } else {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  }

  const token = (await response.json()) as OAuthTokenResponse;
  if (!response.ok || token.error || !token.access_token) {
    throw new Error(token.error_description || token.error || "OAuth token exchange failed.");
  }
  return token;
}

async function refreshToken(config: OAuthConfig, refreshTokenValue: string) {
  const runtimeEnv = await getRuntimeEnv();
  const clientId = runtimeEnv[config.clientIdKey];
  const clientSecret = runtimeEnv[config.clientSecretKey];
  if (!clientId || !clientSecret) throw new Error(`${config.provider} OAuth is not configured.`);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshTokenValue,
  });
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const token = (await response.json()) as OAuthTokenResponse;
  if (!response.ok || token.error || !token.access_token) {
    throw new Error(token.error_description || token.error || "Refreshing the provider token failed.");
  }
  return token;
}

function tokenExpiry(token: OAuthTokenResponse) {
  return token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
}

async function accountLabel(provider: ConnectionProvider, token: string) {
  try {
    if (provider === "gmail" || provider === "google-calendar") {
      const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as { email?: string };
      return data.email ?? null;
    }
    if (provider === "outlook") {
      const response = await fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as { displayName?: string; mail?: string; userPrincipalName?: string };
      return data.mail || data.userPrincipalName || data.displayName || null;
    }
    if (provider === "slack") {
      const response = await fetch("https://slack.com/api/auth.test", {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as { ok?: boolean; team?: string; user?: string };
      return data.ok ? [data.team, data.user].filter(Boolean).join(" / ") : null;
    }
    if (provider === "notion") {
      const response = await fetch("https://api.notion.com/v1/users/me", {
        headers: { authorization: `Bearer ${token}`, "notion-version": "2022-06-28" },
      });
      const data = (await response.json()) as { name?: string; person?: { email?: string } };
      return data.person?.email || data.name || null;
    }
  } catch {
    return null;
  }
  return null;
}

async function getAccessToken(row: ConnectionRow) {
  if (row.status !== "connected" || !row.tokenCiphertext) {
    throw new Error(`${row.name} is not connected.`);
  }

  const provider = row.provider as ConnectionProvider;
  const config = getOAuthConfig(provider);
  if (!config) throw new Error(`${getIntegrationProvider(provider).label} does not use OAuth.`);

  const token = await decryptJson<OAuthTokenResponse & { stored_at?: string }>(row.tokenCiphertext);
  const expiresAt = row.expiresAt ? new Date(row.expiresAt).getTime() : 0;
  if (token.access_token && (!expiresAt || expiresAt > Date.now() + 60_000)) return token.access_token;

  if (!row.refreshTokenCiphertext) {
    await updateConnectionStatus(row.id, row.ownerEmail, {
      status: "expired",
      statusReason: "The provider token expired and no refresh token is stored.",
    });
    throw new Error(`${row.name} needs to be re-authenticated.`);
  }

  const refresh = await decryptJson<{ refresh_token?: string }>(row.refreshTokenCiphertext);
  if (!refresh.refresh_token) throw new Error(`${row.name} has no refresh token.`);
  const refreshed = await refreshToken(config, refresh.refresh_token);
  const nextToken = {
    ...refreshed,
    refresh_token: undefined,
    stored_at: new Date().toISOString(),
  };
  await updateConnectionStatus(row.id, row.ownerEmail, {
    tokenCiphertext: await encryptJson(nextToken),
    expiresAt: tokenExpiry(refreshed),
    status: "connected",
    statusReason: null,
  });
  return refreshed.access_token!;
}

async function testProvider(provider: ConnectionProvider, token: string) {
  if (provider === "gmail") {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Gmail rejected the connection test.");
    return;
  }
  if (provider === "outlook") {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=1&$select=id", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Microsoft Graph rejected the connection test.");
    return;
  }
  if (provider === "slack") {
    const response = await fetch("https://slack.com/api/auth.test", {
      headers: { authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (!data.ok) throw new Error(data.error || "Slack rejected the connection test.");
    return;
  }
  if (provider === "google-calendar") {
    const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Google Calendar rejected the connection test.");
    return;
  }
  if (provider === "notion") {
    const response = await fetch("https://api.notion.com/v1/users/me", {
      headers: { authorization: `Bearer ${token}`, "notion-version": "2022-06-28" },
    });
    if (!response.ok) throw new Error("Notion rejected the connection test.");
  }
}

function gmailPartBody(part: {
  mimeType?: string;
  body?: { data?: string };
  parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>;
}): string {
  if (part.mimeType === "text/plain" && part.body?.data) return base64UrlDecode(part.body.data);
  for (const child of part.parts ?? []) {
    const value = gmailPartBody(child);
    if (value) return value;
  }
  return part.body?.data ? base64UrlDecode(part.body.data) : "";
}

function gmailRawMessage(to: string, subject: string, body: string) {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    body,
  ].join("\r\n");
  return base64UrlEncode(message);
}

export async function listConnections(request: Request) {
  const db = await getDb();
  const ownerEmail = ownerEmailFrom(request);
  const rows = await db
    .select()
    .from(connections)
    .where(eq(connections.ownerEmail, ownerEmail))
    .orderBy(desc(connections.createdAt), desc(connections.id));
  return rows.map(publicConnection);
}

export async function createConnection(request: Request, payload: unknown) {
  const data = payload as { provider?: unknown; name?: unknown };
  if (!validProvider(data.provider)) throw new Error("Choose a supported provider.");
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) throw new Error("Connection name is required.");

  const db = await getDb();
  const providerMeta = getIntegrationProvider(data.provider);
  const scopes = getOAuthConfig(data.provider)?.scopes ?? [];
  const [row] = await db
    .insert(connections)
    .values({
      id: crypto.randomUUID(),
      ownerEmail: ownerEmailFrom(request),
      provider: data.provider,
      name,
      status: providerMeta.authType === "webhook" ? "needs_auth" : "needs_auth",
      scopes: JSON.stringify(scopes),
      statusReason:
        providerMeta.authType === "webhook"
          ? "Webhook endpoint storage is defined, but secret storage is not enabled yet."
          : "OAuth authentication has not completed.",
    })
    .returning();
  return publicConnection(row);
}

export async function deleteConnection(request: Request, id: string) {
  const db = await getDb();
  const ownerEmail = ownerEmailFrom(request);
  await db.delete(connections).where(and(eq(connections.id, id), eq(connections.ownerEmail, ownerEmail)));
}

export async function startOAuth(request: Request, payload: unknown) {
  const data = payload as { provider?: unknown; name?: unknown; connectionId?: unknown; returnTo?: unknown };
  const ownerEmail = ownerEmailFrom(request);

  let row: ConnectionRow | undefined;
  let provider: ConnectionProvider | undefined;
  if (typeof data.connectionId === "string" && data.connectionId) {
    row = await getOwnedConnection(data.connectionId, ownerEmail);
    if (!row) throw new Error("Connection not found.");
    provider = row.provider as ConnectionProvider;
  } else {
    const connection = await createConnection(request, data);
    row = await getOwnedConnection(connection.id, ownerEmail);
    provider = connection.provider;
  }

  if (!row || !provider) throw new Error("Connection could not be prepared.");
  const config = getOAuthConfig(provider);
  if (!config) {
    await updateConnectionStatus(row.id, ownerEmail, {
      status: "needs_auth",
      statusReason: "This provider is saved as metadata only until webhook secret storage is added.",
    });
    return {
      connection: publicConnection((await getOwnedConnection(row.id, ownerEmail))!),
      authorizationUrl: null,
      setupRequired: requiredSetup(provider),
    };
  }

  const readiness = await oauthReady(provider);
  if (!readiness.ready) {
    const db = await getDb();
    const [updated] = await db
      .update(connections)
      .set({
        status: "needs_auth",
        statusReason: `Server is missing ${readiness.missing.join(", ")}.`,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(connections.id, row.id), eq(connections.ownerEmail, ownerEmail)))
      .returning();
    return {
      connection: publicConnection(updated),
      authorizationUrl: null,
      setupRequired: readiness.missing,
    };
  }

  const state = crypto.randomUUID();
  const db = await getDb();
  await db.insert(oauthStates).values({
    state,
    ownerEmail,
    connectionId: row.id,
    provider,
    returnTo: safeReturnPath(data.returnTo),
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });

  const runtimeEnv = await getRuntimeEnv();
  const authorization = new URL(config.authUrl);
  authorization.searchParams.set("client_id", String(runtimeEnv[config.clientIdKey]));
  authorization.searchParams.set("redirect_uri", redirectUriFor(request));
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("state", state);
  if (config.scopes.length) authorization.searchParams.set("scope", config.scopes.join(" "));
  Object.entries(config.authParams ?? {}).forEach(([key, value]) => authorization.searchParams.set(key, value));

  return {
    connection: publicConnection(row),
    authorizationUrl: authorization.toString(),
    setupRequired: [] as string[],
  };
}

export async function finishOAuth(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (!state) throw new Error("OAuth callback is missing state.");
  const db = await getDb();
  const [stateRow] = await db.select().from(oauthStates).where(eq(oauthStates.state, state)).limit(1);
  if (!stateRow) throw new Error("OAuth state was not found or has already been used.");
  await db.delete(oauthStates).where(eq(oauthStates.state, state));

  const returnTo = new URL(stateRow.returnTo || "/", request.url);
  if (providerError) {
    await updateConnectionStatus(stateRow.connectionId, stateRow.ownerEmail, {
      status: "error",
      statusReason: providerError,
    });
    returnTo.searchParams.set("connection", "error");
    returnTo.searchParams.set("reason", providerError);
    return returnTo.toString();
  }
  if (!code) throw new Error("OAuth callback is missing code.");
  if (stateRow.expiresAt.getTime() < Date.now()) throw new Error("OAuth sign-in expired. Try again.");

  const provider = stateRow.provider as ConnectionProvider;
  const config = getOAuthConfig(provider);
  if (!config) throw new Error("Provider does not support OAuth.");

  const token = await exchangeToken(config, code, redirectUriFor(request));
  const label = await accountLabel(provider, token.access_token!);
  const storedToken = {
    ...token,
    refresh_token: undefined,
    stored_at: new Date().toISOString(),
  };

  await updateConnectionStatus(stateRow.connectionId, stateRow.ownerEmail, {
    status: "connected",
    accountLabel: label,
    scopes: JSON.stringify(token.scope ? token.scope.split(/\s+/).filter(Boolean) : config.scopes),
    tokenCiphertext: await encryptJson(storedToken),
    refreshTokenCiphertext: token.refresh_token ? await encryptJson({ refresh_token: token.refresh_token }) : undefined,
    expiresAt: tokenExpiry(token),
    lastTestedAt: new Date().toISOString(),
    statusReason: null,
  });

  returnTo.searchParams.set("connection", "connected");
  return returnTo.toString();
}

export async function testConnection(request: Request, id: string) {
  const ownerEmail = ownerEmailFrom(request);
  const row = await getOwnedConnection(id, ownerEmail);
  if (!row) throw new Error("Connection not found.");
  const provider = row.provider as ConnectionProvider;
  const token = await getAccessToken(row);
  await testProvider(provider, token);
  const updated = await updateConnectionStatus(row.id, ownerEmail, {
    status: "connected",
    lastTestedAt: new Date().toISOString(),
    statusReason: null,
  });
  return publicConnection(updated);
}

export async function readLatestEmail(request: Request, connectionId: string) {
  const ownerEmail = ownerEmailFrom(request);
  const row = await getOwnedConnection(connectionId, ownerEmail);
  if (!row) throw new Error("Connection not found.");
  const provider = row.provider as ConnectionProvider;
  if (!isEmailProvider(provider)) throw new Error(`${getIntegrationProvider(provider).label} cannot read email.`);
  const token = await getAccessToken(row);

  if (provider === "gmail") {
    const listResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=in%3Ainbox", {
      headers: { authorization: `Bearer ${token}` },
    });
    const list = (await listResponse.json()) as { messages?: Array<{ id: string }>; error?: { message?: string } };
    if (!listResponse.ok) throw new Error(list.error?.message || "Could not read Gmail inbox.");
    const messageId = list.messages?.[0]?.id;
    if (!messageId) return "No inbox messages found.";

    const messageResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const message = (await messageResponse.json()) as {
      payload?: { headers?: Array<{ name?: string; value?: string }>; body?: { data?: string }; parts?: unknown[]; mimeType?: string };
      snippet?: string;
      error?: { message?: string };
    };
    if (!messageResponse.ok || !message.payload) throw new Error(message.error?.message || "Could not read Gmail message.");
    const headers = new Map((message.payload.headers ?? []).map((header) => [header.name?.toLowerCase() ?? "", header.value ?? ""]));
    const body = gmailPartBody(message.payload) || message.snippet || "";
    return `From: ${headers.get("from") ?? "Unknown"}\nTo: ${headers.get("to") ?? row.accountLabel ?? ""}\nSubject: ${headers.get("subject") ?? "(no subject)"}\n\n${body}`;
  }

  const response = await fetch("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=1&$orderby=receivedDateTime%20desc&$select=from,toRecipients,subject,bodyPreview,body", {
    headers: { authorization: `Bearer ${token}` },
  });
  const data = (await response.json()) as {
    value?: Array<{
      from?: { emailAddress?: { address?: string; name?: string } };
      toRecipients?: Array<{ emailAddress?: { address?: string; name?: string } }>;
      subject?: string;
      bodyPreview?: string;
      body?: { content?: string };
    }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message || "Could not read Outlook inbox.");
  const message = data.value?.[0];
  if (!message) return "No inbox messages found.";
  const from = message.from?.emailAddress?.address || message.from?.emailAddress?.name || "Unknown";
  const to = message.toRecipients?.map((recipient) => recipient.emailAddress?.address || recipient.emailAddress?.name).filter(Boolean).join(", ") ?? "";
  const body = (message.body?.content || message.bodyPreview || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return `From: ${from}\nTo: ${to}\nSubject: ${message.subject ?? "(no subject)"}\n\n${body}`;
}

export async function createEmailDraft(request: Request, payload: unknown) {
  const data = payload as { connectionId?: unknown; to?: unknown; subject?: unknown; body?: unknown };
  if (typeof data.connectionId !== "string") throw new Error("Connection id is required.");
  const to = typeof data.to === "string" ? data.to.trim() : "";
  const subject = typeof data.subject === "string" ? data.subject.trim() : "";
  const body = typeof data.body === "string" ? data.body.trim() : "";
  if (!to || !subject || !body) throw new Error("Draft recipient, subject, and body are required.");

  const ownerEmail = ownerEmailFrom(request);
  const row = await getOwnedConnection(data.connectionId, ownerEmail);
  if (!row) throw new Error("Connection not found.");
  const provider = row.provider as ConnectionProvider;
  if (!isEmailProvider(provider)) throw new Error(`${getIntegrationProvider(provider).label} cannot create email drafts.`);
  const token = await getAccessToken(row);

  if (provider === "gmail") {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: { raw: gmailRawMessage(to, subject, body) } }),
    });
    const result = (await response.json()) as { id?: string; message?: { id?: string }; error?: { message?: string } };
    if (!response.ok) throw new Error(result.error?.message || "Gmail could not create the draft.");
    return `GMAIL DRAFT CREATED\nConnection: ${row.name}${row.accountLabel ? ` (${row.accountLabel})` : ""}\nDraft id: ${result.id ?? "unknown"}\nMessage id: ${result.message?.id ?? "unknown"}\n\nStatus: Created as a draft only. Nothing was sent.`;
  }

  const response = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      subject,
      body: { contentType: "Text", content: body },
      toRecipients: [{ emailAddress: { address: to } }],
    }),
  });
  const result = (await response.json()) as { id?: string; webLink?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message || "Outlook could not create the draft.");
  return `OUTLOOK DRAFT CREATED\nConnection: ${row.name}${row.accountLabel ? ` (${row.accountLabel})` : ""}\nDraft id: ${result.id ?? "unknown"}${result.webLink ? `\nLink: ${result.webLink}` : ""}\n\nStatus: Created as a draft only. Nothing was sent.`;
}

export { jsonError, oauthReady, requiredSetup };
