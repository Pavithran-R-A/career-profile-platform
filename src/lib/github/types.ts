// ─── GitHub API Response Types ────────────────────────────────

export interface GitHubUser {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  type: 'User' | 'Organization';
  site_admin: boolean;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubUser;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  forks_url: string;
  keys_url: string;
  collaborators_url: string;
  teams_url: string;
  hooks_url: string;
  issue_events_url: string;
  events_url: string;
  assignees_url: string;
  branches_url: string;
  tags_url: string;
  blobs_url: string;
  git_tags_url: string;
  git_refs_url: string;
  trees_url: string;
  statuses_url: string;
  languages_url: string;
  stargazers_url: string;
  contributors_url: string;
  subscribers_url: string;
  subscription_url: string;
  commits_url: string;
  git_commits_url: string;
  comments_url: string;
  issue_comment_url: string;
  contents_url: string;
  compare_url: string;
  merges_url: string;
  archive_url: string;
  downloads_url: string;
  issues_url: string;
  pulls_url: string;
  milestones_url: string;
  notifications_url: string;
  labels_url: string;
  releases_url: string;
  deployments_url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  git_url: string;
  ssh_url: string;
  clone_url: string;
  svn_url: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  forks_count: number;
  mirror_url: string | null;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license: GitHubLicense | null;
  allow_forking: boolean;
  is_template: boolean;
  topics: string[];
  visibility: 'public' | 'private' | 'internal';
  forks: number;
  open_issues: number;
  watchers: number;
  default_branch: string;
}

export interface GitHubLicense {
  key: string;
  name: string;
  spdx_id: string | null;
  url: string | null;
  node_id: string;
}

export interface GitHubLanguage {
  [language: string]: number;
}

export interface GitHubCommit {
  sha: string;
  node_id: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
    tree: {
      sha: string;
      url: string;
    };
    url: string;
    comment_count: number;
    verification: {
      verified: boolean;
      reason: string;
      signature: string | null;
      payload: string | null;
    };
  };
  url: string;
  html_url: string;
  comments_url: string;
  author: GitHubUser | null;
  committer: GitHubUser | null;
  parents: Array<{
    sha: string;
    url: string;
    html_url: string;
  }>;
}

export interface GitHubPullRequest {
  id: number;
  node_id: string;
  url: string;
  html_url: string;
  diff_url: string;
  patch_url: string;
  issue_url: string;
  number: number;
  state: 'open' | 'closed';
  locked: boolean;
  title: string;
  user: GitHubUser;
  body: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  head: {
    label: string;
    ref: string;
    sha: string;
    user: GitHubUser;
    repo: GitHubRepository | null;
  };
  base: {
    label: string;
    ref: string;
    sha: string;
    user: GitHubUser;
    repo: GitHubRepository;
  };
  merged: boolean;
  mergeable: boolean | null;
  merged_by: GitHubUser | null;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface GitHubIssue {
  id: number;
  node_id: string;
  url: string;
  html_url: string;
  number: number;
  state: 'open' | 'closed';
  title: string;
  body: string | null;
  user: GitHubUser;
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description: string | null;
  }>;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  milestone: {
    title: string;
    state: 'open' | 'closed';
  } | null;
  locked: boolean;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number;
}

export interface GitHubRelease {
  id: number;
  node_id: string;
  tag_name: string;
  target_commitish: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  author: GitHubUser;
  assets: Array<{
    name: string;
    size: number;
    download_count: number;
    content_type: string;
    browser_download_url: string;
  }>;
  tarball_url: string;
  zipball_url: string;
  html_url: string;
}

export interface GitHubCodeReview {
  id: number;
  node_id: string;
  user: GitHubUser;
  body: string | null;
  commit_id: string;
  submitted_at: string;
  state: 'approved' | 'changes_requested' | 'commented' | 'dismissed' | 'pending';
  html_url: string;
  pull_request_url: string;
}

export interface GitHubInstallation {
  id: number;
  account: GitHubUser;
  repository_selection: 'all' | 'selected';
  access_tokens_url: string;
  repositories_url: string;
  html_url: string;
  target_id: number;
  permissions: Record<string, string>;
  events: string[];
  created_at: string;
  updated_at: string;
  single_file_name: string | null;
  has_multiple_single_files: boolean;
  suspended_by: string | null;
  suspended_at: string | null;
}

// ─── Internal DB Model Types ──────────────────────────────────

export interface GitHubConnection {
  id: string;
  profile_id: string;
  installation_id: number;
  github_account_id: number;
  github_account_login: string;
  github_account_type: string;
  status: 'active' | 'inactive' | 'pending' | 'error';
  connected_at: string;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepositoryRecord {
  id: string;
  connection_id: string;
  github_repo_id: number;
  owner_login: string;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  is_private: boolean;
  is_fork: boolean;
  is_archived: boolean;
  default_branch: string;
  primary_language: string | null;
  languages: string[];
  topics: string[];
  stars_count: number;
  forks_count: number;
  github_created_at: string | null;
  github_updated_at: string | null;
  github_pushed_at: string | null;
  default_branch_sha: string | null;
  selected_for_evidence: boolean;
  show_publicly: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileEvidence {
  id: string;
  profile_id: string;
  github_repository_id: string | null;
  evidence_type:
    'commit' | 'pull_request' | 'issue' | 'release' | 'code_review' | 'contribution' | 'project';
  subject: string;
  summary: string;
  source_path: string | null;
  source_url: string | null;
  source_commit_sha: string | null;
  metadata: Record<string, unknown>;
  is_public: boolean;
  observed_at: string;
  created_at: string;
  updated_at: string;
}

// ─── Utility Types ────────────────────────────────────────────

export interface SyncResult {
  commits: GitHubCommit[];
  pullRequests: GitHubPullRequest[];
  issues: GitHubIssue[];
  releases: GitHubRelease[];
  languages: GitHubLanguage[];
  topics: string[];
  defaultBranchSha: string | null;
}

export interface GitHubAppConfig {
  appId: number;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
}

export interface InstallationTokenResult {
  token: string;
  expires_at: string;
  permissions: Record<string, string>;
  repositories: Array<{ id: number; name: string }>;
}
