import type {
  GitHubCommit,
  GitHubPullRequest,
  GitHubIssue,
  GitHubRelease,
  GitHubCodeReview,
  ProfileEvidence,
} from './types';

/**
 * Extraction tuning. Passed explicitly by the pipeline (resolved from Env);
 * the extraction functions themselves stay pure and process.env-free.
 */
export interface EvidenceTuning {
  minCommitMessageLength: number;
  excludeMergeCommits: boolean;
  excludeBotCommits: boolean;
  excludeBuiltinBotNames: string[];
  classifyConventionalCommits: boolean;
}

export const DEFAULT_EVIDENCE_TUNING: EvidenceTuning = {
  minCommitMessageLength: 10,
  excludeMergeCommits: true,
  excludeBotCommits: true,
  excludeBuiltinBotNames: ['dependabot[bot]', 'renovate[bot]', 'github-actions[bot]'],
  classifyConventionalCommits: true,
};

// ─── Types ────────────────────────────────────────────────────

export type EvidenceSource =
  | { type: 'commit'; data: GitHubCommit }
  | { type: 'pull_request'; data: GitHubPullRequest }
  | { type: 'issue'; data: GitHubIssue }
  | { type: 'release'; data: GitHubRelease }
  | { type: 'code_review'; data: GitHubCodeReview };

export interface EvidenceExtractionResult {
  evidence: ProfileEvidence[];
  skipped: number;
  errors: string[];
}

export interface CommitClassification {
  type:
    | 'feat'
    | 'fix'
    | 'docs'
    | 'style'
    | 'refactor'
    | 'test'
    | 'chore'
    | 'ci'
    | 'perf'
    | 'build'
    | 'unknown';
  scope: string | null;
  description: string;
  isBreaking: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

function isMergeCommit(commit: GitHubCommit): boolean {
  return commit.parents.length > 1;
}

function isBotUser(login: string | null | undefined, tuning: EvidenceTuning): boolean {
  if (!login) return false;
  return login.endsWith('[bot]') || tuning.excludeBuiltinBotNames.includes(login);
}

const CONVENTIONAL_COMMIT_RE =
  /^(?<type>\w+)(?:\((?<scope>[^)]+)\))?\s*[!]?\s*:\s*(?<description>.+)$/m;

export function classifyCommit(message: string): CommitClassification {
  const match = message.match(CONVENTIONAL_COMMIT_RE);
  if (!match?.groups) {
    return { type: 'unknown', scope: null, description: message.split('\n')[0], isBreaking: false };
  }

  const rawType = match.groups.type.toLowerCase();
  const knownTypes = [
    'feat',
    'fix',
    'docs',
    'style',
    'refactor',
    'test',
    'chore',
    'ci',
    'perf',
    'build',
  ] as const;

  const type = (
    knownTypes.includes(rawType as (typeof knownTypes)[number]) ? rawType : 'unknown'
  ) as CommitClassification['type'];

  return {
    type,
    scope: match.groups.scope ?? null,
    description: match.groups.description.trim(),
    isBreaking: message.includes('!:'),
  };
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

function dedupeById(items: ProfileEvidence[]): ProfileEvidence[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.evidence_type}:${item.source_url ?? item.source_commit_sha ?? item.subject}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Commit Evidence ──────────────────────────────────────────

function extractCommitEvidence(
  commit: GitHubCommit,
  githubRepoId: string,
  ownerLogin: string,
  tuning: EvidenceTuning
): ProfileEvidence | null {
  const msg = commit.commit.message;

  if (isMergeCommit(commit) && tuning.excludeMergeCommits) return null;
  if (isBotUser(commit.author?.login, tuning) && tuning.excludeBotCommits) return null;
  if (msg.trim().length < tuning.minCommitMessageLength) return null;

  const firstLine = msg.split('\n')[0];
  const classification = tuning.classifyConventionalCommits ? classifyCommit(msg) : null;

  const subject = classification
    ? `[${classification.type}] ${classification.description}`
    : truncate(firstLine, 120);

  const summaryParts: string[] = [];
  if (classification) {
    summaryParts.push(`Type: ${classification.type}`);
    if (classification.scope) summaryParts.push(`Scope: ${classification.scope}`);
    if (classification.isBreaking) summaryParts.push('Breaking change');
  }
  summaryParts.push(`Author: ${commit.commit.author.name}`);
  summaryParts.push(`Date: ${commit.commit.author.date}`);

  return {
    id: generateId(),
    profile_id: '',
    github_repository_id: githubRepoId,
    evidence_type: 'commit',
    subject,
    summary: summaryParts.join(' | '),
    source_path: null,
    source_url: commit.html_url,
    source_commit_sha: commit.sha,
    metadata: {
      sha: commit.sha,
      author_email: commit.commit.author.email,
      authored_at: commit.commit.author.date,
      message: msg,
      classification,
      verified: commit.commit.verification?.verified ?? false,
      additions: null,
      deletions: null,
      owner_login: ownerLogin,
    },
    is_public: false,
    observed_at: commit.commit.author.date,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function extractCommitsEvidence(
  commits: GitHubCommit[],
  githubRepoId: string,
  ownerLogin: string,
  tuning: EvidenceTuning = DEFAULT_EVIDENCE_TUNING
): EvidenceExtractionResult {
  const result: EvidenceExtractionResult = { evidence: [], skipped: 0, errors: [] };

  for (const commit of commits) {
    try {
      const ev = extractCommitEvidence(commit, githubRepoId, ownerLogin, tuning);
      if (ev) {
        result.evidence.push(ev);
      } else {
        result.skipped++;
      }
    } catch (err) {
      result.errors.push(`commit ${commit.sha}: ${(err as Error).message}`);
    }
  }

  return result;
}

// ─── Pull Request Evidence ────────────────────────────────────

function extractPullRequestEvidence(
  pr: GitHubPullRequest,
  githubRepoId: string
): ProfileEvidence | null {
  const label = pr.merged ? 'Merged' : pr.state === 'closed' ? 'Closed' : 'Open';
  const subject = `${label} PR #${pr.number}: ${truncate(pr.title, 100)}`;
  const summaryParts: string[] = [
    `State: ${label}`,
    `+${pr.additions} -${pr.deletions} across ${pr.changed_files} files`,
    `Author: ${pr.user.login}`,
    `Created: ${pr.created_at}`,
  ];
  if (pr.merged_at) summaryParts.push(`Merged: ${pr.merged_at}`);

  return {
    id: generateId(),
    profile_id: '',
    github_repository_id: githubRepoId,
    evidence_type: 'pull_request',
    subject,
    summary: summaryParts.join(' | '),
    source_path: null,
    source_url: pr.html_url,
    source_commit_sha: null,
    metadata: {
      number: pr.number,
      state: pr.state,
      merged: pr.merged,
      additions: pr.additions,
      deletions: pr.deletions,
      changed_files: pr.changed_files,
      author_login: pr.user.login,
      created_at: pr.created_at,
      closed_at: pr.closed_at,
      merged_at: pr.merged_at,
      head_sha: pr.head.sha,
    },
    is_public: false,
    observed_at: pr.created_at,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function extractPullRequestsEvidence(
  pullRequests: GitHubPullRequest[],
  githubRepoId: string
): EvidenceExtractionResult {
  const result: EvidenceExtractionResult = { evidence: [], skipped: 0, errors: [] };

  for (const pr of pullRequests) {
    try {
      const ev = extractPullRequestEvidence(pr, githubRepoId);
      if (ev) result.evidence.push(ev);
      else result.skipped++;
    } catch (err) {
      result.errors.push(`PR #${pr.number}: ${(err as Error).message}`);
    }
  }

  return result;
}

// ─── Issue Evidence ───────────────────────────────────────────

function extractIssueEvidence(issue: GitHubIssue, githubRepoId: string): ProfileEvidence | null {
  const label = issue.state === 'closed' ? 'Closed' : 'Open';
  const subject = `${label} Issue #${issue.number}: ${truncate(issue.title, 100)}`;
  const summaryParts: string[] = [
    `State: ${label}`,
    `Comments: ${issue.comments}`,
    `Author: ${issue.user.login}`,
    `Created: ${issue.created_at}`,
  ];
  if (issue.labels.length > 0) {
    summaryParts.push(`Labels: ${issue.labels.map((l) => l.name).join(', ')}`);
  }

  return {
    id: generateId(),
    profile_id: '',
    github_repository_id: githubRepoId,
    evidence_type: 'issue',
    subject,
    summary: summaryParts.join(' | '),
    source_path: null,
    source_url: issue.html_url,
    source_commit_sha: null,
    metadata: {
      number: issue.number,
      state: issue.state,
      labels: issue.labels.map((l) => l.name),
      comments: issue.comments,
      author_login: issue.user.login,
      created_at: issue.created_at,
      closed_at: issue.closed_at,
    },
    is_public: false,
    observed_at: issue.created_at,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function extractIssuesEvidence(
  issues: GitHubIssue[],
  githubRepoId: string
): EvidenceExtractionResult {
  const result: EvidenceExtractionResult = { evidence: [], skipped: 0, errors: [] };

  for (const issue of issues) {
    try {
      const ev = extractIssueEvidence(issue, githubRepoId);
      if (ev) result.evidence.push(ev);
      else result.skipped++;
    } catch (err) {
      result.errors.push(`Issue #${issue.number}: ${(err as Error).message}`);
    }
  }

  return result;
}

// ─── Release Evidence ─────────────────────────────────────────

function extractReleaseEvidence(
  release: GitHubRelease,
  githubRepoId: string
): ProfileEvidence | null {
  const subject = `Release ${release.tag_name}: ${truncate(release.name ?? release.tag_name, 100)}`;
  const summaryParts: string[] = [
    `Tag: ${release.tag_name}`,
    `Published: ${release.published_at}`,
    `Author: ${release.author.login}`,
    `Assets: ${release.assets.length}`,
  ];
  if (release.prerelease) summaryParts.push('Pre-release');

  return {
    id: generateId(),
    profile_id: '',
    github_repository_id: githubRepoId,
    evidence_type: 'release',
    subject,
    summary: summaryParts.join(' | '),
    source_path: null,
    source_url: release.html_url,
    source_commit_sha: null,
    metadata: {
      tag_name: release.tag_name,
      name: release.name,
      prerelease: release.prerelease,
      draft: release.draft,
      published_at: release.published_at,
      author_login: release.author.login,
      asset_count: release.assets.length,
      tarball_url: release.tarball_url,
      zipball_url: release.zipball_url,
    },
    is_public: false,
    observed_at: release.published_at,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function extractReleasesEvidence(
  releases: GitHubRelease[],
  githubRepoId: string
): EvidenceExtractionResult {
  const result: EvidenceExtractionResult = { evidence: [], skipped: 0, errors: [] };

  for (const release of releases) {
    try {
      const ev = extractReleaseEvidence(release, githubRepoId);
      if (ev) result.evidence.push(ev);
      else result.skipped++;
    } catch (err) {
      result.errors.push(`Release ${release.tag_name}: ${(err as Error).message}`);
    }
  }

  return result;
}

// ─── Code Review Evidence ─────────────────────────────────────

function extractCodeReviewEvidence(
  review: GitHubCodeReview,
  githubRepoId: string
): ProfileEvidence | null {
  const subject = `Review (${review.state}): PR review by ${review.user.login}`;
  const summaryParts: string[] = [
    `State: ${review.state}`,
    `Reviewer: ${review.user.login}`,
    `Submitted: ${review.submitted_at}`,
  ];

  return {
    id: generateId(),
    profile_id: '',
    github_repository_id: githubRepoId,
    evidence_type: 'code_review',
    subject,
    summary: summaryParts.join(' | '),
    source_path: null,
    source_url: review.html_url,
    source_commit_sha: review.commit_id,
    metadata: {
      review_id: review.id,
      state: review.state,
      reviewer_login: review.user.login,
      commit_id: review.commit_id,
      submitted_at: review.submitted_at,
      pull_request_url: review.pull_request_url,
    },
    is_public: false,
    observed_at: review.submitted_at,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function extractCodeReviewsEvidence(
  reviews: GitHubCodeReview[],
  githubRepoId: string
): EvidenceExtractionResult {
  const result: EvidenceExtractionResult = { evidence: [], skipped: 0, errors: [] };

  for (const review of reviews) {
    try {
      const ev = extractCodeReviewEvidence(review, githubRepoId);
      if (ev) result.evidence.push(ev);
      else result.skipped++;
    } catch (err) {
      result.errors.push(`Review ${review.id}: ${(err as Error).message}`);
    }
  }

  return result;
}

// ─── Aggregate Extraction ─────────────────────────────────────

export function extractAllEvidence(
  sources: EvidenceSource[],
  githubRepoId: string
): EvidenceExtractionResult {
  const combined: EvidenceExtractionResult = { evidence: [], skipped: 0, errors: [] };

  for (const source of sources) {
    let partial: EvidenceExtractionResult;

    switch (source.type) {
      case 'commit':
        partial = extractCommitsEvidence(
          [source.data],
          githubRepoId,
          source.data.commit.author.name
        );
        break;
      case 'pull_request':
        partial = extractPullRequestsEvidence([source.data], githubRepoId);
        break;
      case 'issue':
        partial = extractIssuesEvidence([source.data], githubRepoId);
        break;
      case 'release':
        partial = extractReleasesEvidence([source.data], githubRepoId);
        break;
      case 'code_review':
        partial = extractCodeReviewsEvidence([source.data], githubRepoId);
        break;
      default:
        continue;
    }

    combined.evidence.push(...partial.evidence);
    combined.skipped += partial.skipped;
    combined.errors.push(...partial.errors);
  }

  combined.evidence = dedupeById(combined.evidence);
  return combined;
}

// ─── Language Inference from File Paths ────────────────────────

const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.py': 'Python',
  '.rb': 'Ruby',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.swift': 'Swift',
  '.c': 'C',
  '.cpp': 'C++',
  '.cs': 'C#',
  '.php': 'PHP',
  '.ex': 'Elixir',
  '.erl': 'Erlang',
  '.hs': 'Haskell',
  '.scala': 'Scala',
  '.dart': 'Dart',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.less': 'LESS',
  '.html': 'HTML',
  '.xml': 'XML',
  '.svg': 'SVG',
  '.sql': 'SQL',
  '.graphql': 'GraphQL',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.md': 'Markdown',
  '.rst': 'reStructuredText',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.json': 'JSON',
  '.dockerfile': 'Dockerfile',
  '.tf': 'Terraform',
};

export function inferLanguageFromPath(filePath: string): string | null {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return EXTENSION_MAP[ext] ?? null;
}

// ─── Skills Deduction from Evidence ───────────────────────────

export function deduceSkillsFromEvidence(evidence: ProfileEvidence[]): Map<string, number> {
  const skillCounts = new Map<string, number>();

  for (const item of evidence) {
    if (item.evidence_type === 'commit' && item.metadata.sha) {
      const classification = item.metadata.classification as CommitClassification | undefined;
      if (classification?.scope) {
        const scope = classification.scope;
        skillCounts.set(scope, (skillCounts.get(scope) ?? 0) + 1);
      }
    }
  }

  return skillCounts;
}

// ─── Export Deduplication ─────────────────────────────────────

export { dedupeById as dedupeEvidence };
