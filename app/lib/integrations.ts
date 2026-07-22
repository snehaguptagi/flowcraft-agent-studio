export type ConnectionProvider =
  | "gmail"
  | "outlook"
  | "slack"
  | "google-calendar"
  | "notion"
  | "webhook";

export type ConnectionStatus = "needs_auth" | "connected" | "expired" | "error";

export type ConnectionKind = "email" | "messaging" | "calendar" | "knowledge" | "http";

export type IntegrationProvider = {
  id: ConnectionProvider;
  label: string;
  shortLabel: string;
  kind: ConnectionKind;
  mark: string;
  authType: "oauth2" | "webhook";
  capabilities: string[];
  deniedCapabilities: string[];
  envPrefix?: string;
};

export type ConnectionRecord = {
  id: string;
  name: string;
  provider: ConnectionProvider;
  status: ConnectionStatus;
  createdAt: string;
  accountLabel?: string | null;
  statusReason?: string | null;
  lastTestedAt?: string | null;
  scopes?: string[];
};

export const integrationProviders: IntegrationProvider[] = [
  {
    id: "gmail",
    label: "Gmail",
    shortLabel: "Gmail",
    kind: "email",
    mark: "G",
    authType: "oauth2",
    envPrefix: "GMAIL",
    capabilities: ["Read inbox messages", "Create draft replies", "Refresh access securely"],
    deniedCapabilities: ["Send email automatically"],
  },
  {
    id: "outlook",
    label: "Microsoft Outlook",
    shortLabel: "Outlook",
    kind: "email",
    mark: "O",
    authType: "oauth2",
    envPrefix: "OUTLOOK",
    capabilities: ["Read inbox messages", "Create draft replies", "Refresh access securely"],
    deniedCapabilities: ["Send email automatically"],
  },
  {
    id: "slack",
    label: "Slack",
    shortLabel: "Slack",
    kind: "messaging",
    mark: "S",
    authType: "oauth2",
    envPrefix: "SLACK",
    capabilities: ["Read channel metadata", "Prepare messages for review"],
    deniedCapabilities: ["Post without an explicit action node"],
  },
  {
    id: "google-calendar",
    label: "Google Calendar",
    shortLabel: "Calendar",
    kind: "calendar",
    mark: "C",
    authType: "oauth2",
    envPrefix: "GOOGLE_CALENDAR",
    capabilities: ["Read calendars", "Create draft event payloads"],
    deniedCapabilities: ["Invite attendees without a calendar node"],
  },
  {
    id: "notion",
    label: "Notion",
    shortLabel: "Notion",
    kind: "knowledge",
    mark: "N",
    authType: "oauth2",
    envPrefix: "NOTION",
    capabilities: ["Read selected workspace pages", "Prepare page updates"],
    deniedCapabilities: ["Publish changes without a Notion node"],
  },
  {
    id: "webhook",
    label: "Generic Webhook",
    shortLabel: "Webhook",
    kind: "http",
    mark: "W",
    authType: "webhook",
    capabilities: ["Store an endpoint reference", "Use as a future trigger or action"],
    deniedCapabilities: ["Store browser-side secrets"],
  },
];

export const emailProviderIds: ConnectionProvider[] = ["gmail", "outlook"];

export function getIntegrationProvider(provider: ConnectionProvider) {
  return integrationProviders.find((candidate) => candidate.id === provider) ?? integrationProviders[0];
}

export function providerLabel(provider: ConnectionProvider) {
  return getIntegrationProvider(provider).label;
}

export function connectionStatusLabel(status: ConnectionStatus) {
  if (status === "connected") return "Connected";
  if (status === "expired") return "Expired";
  if (status === "error") return "Connection error";
  return "Authentication required";
}

export function isEmailProvider(provider: ConnectionProvider) {
  return emailProviderIds.includes(provider);
}
