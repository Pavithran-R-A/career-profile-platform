import type {
  GitHubConnection,
  GitHubRepositoryRecord,
  GitHubRepository,
  GitHubInstallation,
  GitHubUser,
} from './types';
import { GitHubClient } from './client';

// ─── Types ────────────────────────────────────────────────────

export interface ConnectionResult {
  connection: GitHubConnection;
  repositories: GitHubRepositoryRecord[];
}

export interface ConnectionStatus {
  connectionId: string;
  status: GitHubConnection['status'];
  lastSyncedAt: string | null;
  repositoryCount: number;
}

// ─── In-Memory Connection Store ────────────────────────────────
// In production this would be backed by the database; the in-memory
// map keeps the module testable without a live Supabase connection.

const connections = new Map<string, GitHubConnection>();
const repoRecords = new Map<string, GitHubRepositoryRecord[]>();
const clients = new Map<number, GitHubClient>();

// ─── ID Generation ────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

// ─── Connection CRUD ──────────────────────────────────────────

export async function createConnection(
  profileId: string,
  installation: GitHubInstallation,
  account: GitHubUser
): Promise<ConnectionResult> {
  const existing = findByInstallationId(installation.id);
  if (existing && existing.profile_id === profileId) {
    return {
      connection: existing,
      repositories: repoRecords.get(existing.id) ?? [],
    };
  }

  if (existing && existing.profile_id !== profileId) {
    throw new Error(`Installation ${installation.id} is already linked to another profile.`);
  }

  const now = new Date().toISOString();
  const connection: GitHubConnection = {
    id: generateId(),
    profile_id: profileId,
    installation_id: installation.id,
    github_account_id: account.id,
    github_account_login: account.login,
    github_account_type: account.type,
    status: 'active',
    connected_at: now,
    last_synced_at: null,
    last_sync_status: null,
    last_error_code: null,
    created_at: now,
    updated_at: now,
  };

  connections.set(connection.id, connection);
  repoRecords.set(connection.id, []);

  return { connection, repositories: [] };
}

export function getConnection(connectionId: string): GitHubConnection | undefined {
  return connections.get(connectionId);
}

export function findByInstallationId(installationId: number): GitHubConnection | undefined {
  for (const conn of connections.values()) {
    if (conn.installation_id === installationId) return conn;
  }
  return undefined;
}

export function findByProfileId(profileId: string): GitHubConnection | undefined {
  for (const conn of connections.values()) {
    if (conn.profile_id === profileId) return conn;
  }
  return undefined;
}

export function listConnections(profileId: string): GitHubConnection[] {
  return [...connections.values()].filter((c) => c.profile_id === profileId);
}

export async function updateConnectionStatus(
  connectionId: string,
  status: GitHubConnection['status'],
  metadata?: { last_synced_at?: string; last_sync_status?: string; last_error_code?: string }
): Promise<GitHubConnection> {
  const conn = connections.get(connectionId);
  if (!conn) throw new Error(`Connection ${connectionId} not found`);

  const updated: GitHubConnection = {
    ...conn,
    status,
    last_synced_at: metadata?.last_synced_at ?? conn.last_synced_at,
    last_sync_status: metadata?.last_sync_status ?? conn.last_sync_status,
    last_error_code: metadata?.last_error_code ?? conn.last_error_code,
    updated_at: new Date().toISOString(),
  };

  connections.set(connectionId, updated);
  return updated;
}

export async function removeConnection(connectionId: string): Promise<void> {
  connections.delete(connectionId);
  repoRecords.delete(connectionId);
}

// ─── Repository Records ───────────────────────────────────────

export async function syncRepositoryRecords(
  connectionId: string,
  remoteRepos: GitHubRepository[]
): Promise<GitHubRepositoryRecord[]> {
  const now = new Date().toISOString();
  const existing = repoRecords.get(connectionId) ?? [];
  const existingByGithubId = new Map(existing.map((r) => [r.github_repo_id, r] as const));

  const merged: GitHubRepositoryRecord[] = remoteRepos.map((repo) => {
    const prev = existingByGithubId.get(repo.id);

    return {
      id: prev?.id ?? generateId(),
      connection_id: connectionId,
      github_repo_id: repo.id,
      owner_login: repo.owner.login,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      is_private: repo.private,
      is_fork: repo.fork,
      is_archived: repo.archived,
      default_branch: repo.default_branch,
      primary_language: repo.language,
      languages: [],
      topics: repo.topics,
      stars_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      github_created_at: repo.created_at,
      github_updated_at: repo.updated_at,
      github_pushed_at: repo.pushed_at,
      default_branch_sha: null,
      selected_for_evidence: prev?.selected_for_evidence ?? false,
      show_publicly: prev?.show_publicly ?? true,
      last_synced_at: now,
      created_at: prev?.created_at ?? now,
      updated_at: now,
    };
  });

  repoRecords.set(connectionId, merged);
  return merged;
}

export function getRepositoryRecords(connectionId: string): GitHubRepositoryRecord[] {
  return repoRecords.get(connectionId) ?? [];
}

export function toggleRepositoryEvidence(
  connectionId: string,
  githubRepoId: number,
  selected: boolean
): GitHubRepositoryRecord | undefined {
  const records = repoRecords.get(connectionId);
  if (!records) return undefined;

  const record = records.find((r) => r.github_repo_id === githubRepoId);
  if (!record) return undefined;

  record.selected_for_evidence = selected;
  record.updated_at = new Date().toISOString();
  return record;
}

export function toggleRepositoryVisibility(
  connectionId: string,
  githubRepoId: number,
  visible: boolean
): GitHubRepositoryRecord | undefined {
  const records = repoRecords.get(connectionId);
  if (!records) return undefined;

  const record = records.find((r) => r.github_repo_id === githubRepoId);
  if (!record) return undefined;

  record.show_publicly = visible;
  record.updated_at = new Date().toISOString();
  return record;
}

// ─── Client Factory ───────────────────────────────────────────

export function getClientForConnection(connectionId: string): GitHubClient {
  const conn = connections.get(connectionId);
  if (!conn) throw new Error(`Connection ${connectionId} not found`);

  let client = clients.get(conn.installation_id);
  if (!client) {
    client = new GitHubClient();
    clients.set(conn.installation_id, client);
  }
  return client;
}

export function getClientForInstallation(installationId: number): GitHubClient {
  let client = clients.get(installationId);
  if (!client) {
    client = new GitHubClient();
    clients.set(installationId, client);
  }
  return client;
}

// ─── Connection Status ────────────────────────────────────────

export function getConnectionStatus(connectionId: string): ConnectionStatus | undefined {
  const conn = connections.get(connectionId);
  if (!conn) return undefined;

  const repos = repoRecords.get(conn.id) ?? [];
  return {
    connectionId: conn.id,
    status: conn.status,
    lastSyncedAt: conn.last_synced_at,
    repositoryCount: repos.length,
  };
}
