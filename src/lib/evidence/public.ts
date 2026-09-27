/**
 * Evidence presentation language.
 *
 * Evidence attaches to specific facts (a project, a skill) and names its
 * source — never a generic "verified" badge. The public portfolio view
 * exposes only `is_public = true` evidence on published profiles; these
 * mappers turn raw evidence rows into small, citable affordances:
 *
 *   Source: GitHub repository   → owner/name link
 *   Source: release             → latest release link
 *   Source: project link        → the project's own URL
 *   Source: public repository   → for skills backed by repo language/topics
 */

export const EVIDENCE_SOURCE_LABELS = {
  repository: 'GitHub repository',
  release: 'Release',
  projectLink: 'Project link',
} as const;

export interface PublicEvidenceItem {
  id: string;
  evidence_type: string;
  subject: string;
  summary: string;
  source_url: string | null;
  source_commit_sha: string | null;
  observed_at: string;
  repository_full_name: string | null;
  repository_url: string | null;
  repository_language: string | null;
  repository_topics: string[] | null;
}

export interface EvidenceRef {
  source: (typeof EVIDENCE_SOURCE_LABELS)[keyof typeof EVIDENCE_SOURCE_LABELS];
  label: string;
  url: string;
}

export interface ProjectEvidenceRefs {
  repository?: EvidenceRef;
  release?: EvidenceRef;
  projectLink?: EvidenceRef;
}

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const clean = url.trim().replace(/\/+$/, '');
  return clean.length > 0 ? clean.toLowerCase() : null;
}

function repoName(fullName: string | null): string | null {
  if (!fullName) return null;
  const parts = fullName.split('/');
  return parts[parts.length - 1] || null;
}

interface ProjectLike {
  name: string;
  project_url: string | null;
  repository_url: string | null;
}

/** Distinct repositories mentioned by the evidence rows. */
export function repositoriesFromEvidence(
  evidence: PublicEvidenceItem[]
): Array<{ fullName: string; url: string }> {
  const seen = new Set<string>();
  const out: Array<{ fullName: string; url: string }> = [];
  for (const item of evidence) {
    if (!item.repository_full_name || !item.repository_url) continue;
    const key = normalizeUrl(item.repository_url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ fullName: item.repository_full_name, url: item.repository_url });
  }
  return out;
}

function matchRepository(
  project: ProjectLike,
  evidence: PublicEvidenceItem[]
): PublicEvidenceItem | null {
  const repos = repositoriesFromEvidence(evidence);
  if (repos.length === 0) return null;

  const projectUrls = [normalizeUrl(project.project_url), normalizeUrl(project.repository_url)];
  const byUrl = repos.find((repo) =>
    projectUrls.some((u) => u !== null && u === normalizeUrl(repo.url))
  );
  if (byUrl) {
    return evidence.find((item) => normalizeUrl(item.repository_url) === normalizeUrl(byUrl.url)) ?? null;
  }

  const nameKey = project.name.trim().toLowerCase();
  const byName = repos.find(
    (repo) => repoName(repo.fullName)?.toLowerCase() === nameKey
  );
  if (byName) {
    return (
      evidence.find((item) => normalizeUrl(item.repository_url) === normalizeUrl(byName.url)) ??
      null
    );
  }

  return null;
}

/**
 * Evidence affordances for one profile project. Only items with a real
 * source URL are returned; missing evidence yields an empty result.
 */
export function evidenceForProject(
  evidence: PublicEvidenceItem[],
  project: ProjectLike
): ProjectEvidenceRefs {
  if (!Array.isArray(evidence) || evidence.length === 0) return {};

  const match = matchRepository(project, evidence);
  const repoKey = match ? normalizeUrl(match.repository_url) : null;
  const repoFullName = match?.repository_full_name ?? null;
  const refs: ProjectEvidenceRefs = {};

  if (match?.repository_url) {
    refs.repository = {
      source: EVIDENCE_SOURCE_LABELS.repository,
      label: repoFullName ?? 'Source repository',
      url: match.repository_url,
    };
  }

  const release = evidence.find(
    (item) =>
      item.evidence_type === 'release' &&
      (repoKey === null || normalizeUrl(item.repository_url) === repoKey) &&
      item.source_url
  );
  if (release?.source_url) {
    refs.release = {
      source: EVIDENCE_SOURCE_LABELS.release,
      label: release.subject || 'Latest release',
      url: release.source_url,
    };
  }

  const projectLinkUrl = normalizeUrl(project.project_url)
    ? project.project_url
    : match?.repository_url ?? null;
  if (projectLinkUrl && !refs.repository) {
    refs.projectLink = {
      source: EVIDENCE_SOURCE_LABELS.projectLink,
      label: project.name,
      url: projectLinkUrl,
    };
  }

  return refs;
}

/**
 * Evidence for a skill: the skill name matches a connected public
 * repository's primary language or topics. Returns a single subtle ref.
 */
export function evidenceForSkill(
  evidence: PublicEvidenceItem[],
  skillName: string
): EvidenceRef | null {
  if (!Array.isArray(evidence) || !skillName) return null;
  const key = skillName.trim().toLowerCase();
  if (!key) return null;

  for (const item of evidence) {
    if (!item.repository_url) continue;
    const language = (item.repository_language ?? '').trim().toLowerCase();
    const topics = (item.repository_topics ?? []).map((t) => String(t).trim().toLowerCase());
    if (language === key || topics.includes(key)) {
      return {
        source: EVIDENCE_SOURCE_LABELS.repository,
        label: item.repository_full_name ?? 'public repository',
        url: item.repository_url,
      };
    }
  }
  return null;
}
