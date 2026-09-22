import type { ATSResumeViewModel } from './ats-view-model';

export type ATSCheckSeverity = 'error' | 'warning' | 'info';

export interface ATSCheckResult {
  id: string;
  severity: ATSCheckSeverity;
  section: string;
  message: string;
}

const MAX_NAME_LENGTH = 50;
const MAX_LINE_LENGTH = 100;
const MAX_SKILLS = 30;
const SUMMARY_MIN_WORDS = 20;
const SUMMARY_MAX_WORDS = 100;

export function runATSChecks(viewModel: ATSResumeViewModel): ATSCheckResult[] {
  const results: ATSCheckResult[] = [];

  checkHeader(viewModel, results);
  checkSummary(viewModel, results);
  checkExperience(viewModel, results);
  checkEducation(viewModel, results);
  checkSkills(viewModel, results);
  checkProjects(viewModel, results);
  checkFormatting(viewModel, results);

  return results;
}

function checkHeader(viewModel: ATSResumeViewModel, results: ATSCheckResult[]): void {
  if (!viewModel.name || viewModel.name.trim().length === 0) {
    results.push({
      id: 'header-no-name',
      severity: 'error',
      section: 'header',
      message: 'Resume must include a full name.',
    });
  }

  if (viewModel.name && viewModel.name.length > MAX_NAME_LENGTH) {
    results.push({
      id: 'header-name-long',
      severity: 'warning',
      section: 'header',
      message: `Name exceeds ${MAX_NAME_LENGTH} characters. Consider shortening for better ATS parsing.`,
    });
  }

  if (!viewModel.headline || viewModel.headline.trim().length === 0) {
    results.push({
      id: 'header-no-headline',
      severity: 'warning',
      section: 'header',
      message: 'Include a professional headline to improve ATS keyword matching.',
    });
  }

  if (!viewModel.email) {
    results.push({
      id: 'header-no-email',
      severity: 'error',
      section: 'header',
      message: 'An email address is required for ATS contact extraction.',
    });
  }

  if (viewModel.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(viewModel.email)) {
    results.push({
      id: 'header-invalid-email',
      severity: 'error',
      section: 'header',
      message: 'Email address format is invalid.',
    });
  }
}

function checkSummary(viewModel: ATSResumeViewModel, results: ATSCheckResult[]): void {
  if (!viewModel.summary || viewModel.summary.trim().length === 0) {
    results.push({
      id: 'summary-missing',
      severity: 'warning',
      section: 'summary',
      message: 'A professional summary helps ATS systems identify your target role.',
    });
    return;
  }

  const wordCount = viewModel.summary.split(/\s+/).filter(Boolean).length;

  if (wordCount < SUMMARY_MIN_WORDS) {
    results.push({
      id: 'summary-too-short',
      severity: 'warning',
      section: 'summary',
      message: `Summary has ${wordCount} words. Aim for at least ${SUMMARY_MIN_WORDS} words for better ATS keyword density.`,
    });
  }

  if (wordCount > SUMMARY_MAX_WORDS) {
    results.push({
      id: 'summary-too-long',
      severity: 'warning',
      section: 'summary',
      message: `Summary has ${wordCount} words. Keep under ${SUMMARY_MAX_WORDS} words for better readability.`,
    });
  }
}

function checkExperience(viewModel: ATSResumeViewModel, results: ATSCheckResult[]): void {
  if (viewModel.experience.length === 0) {
    results.push({
      id: 'experience-missing',
      severity: 'error',
      section: 'experience',
      message: 'At least one work experience entry is required.',
    });
    return;
  }

  for (const [index, exp] of viewModel.experience.entries()) {
    if (!exp.role || exp.role.trim().length === 0) {
      results.push({
        id: `experience-${index}-no-role`,
        severity: 'error',
        section: 'experience',
        message: `Experience entry ${index + 1} is missing a job title/role.`,
      });
    }

    if (!exp.company || exp.company.trim().length === 0) {
      results.push({
        id: `experience-${index}-no-company`,
        severity: 'error',
        section: 'experience',
        message: `Experience entry ${index + 1} is missing a company name.`,
      });
    }

    if (!exp.startDate) {
      results.push({
        id: `experience-${index}-no-start`,
        severity: 'warning',
        section: 'experience',
        message: `Experience entry ${index + 1} is missing a start date.`,
      });
    }

    if (!exp.description || exp.description.trim().length === 0) {
      results.push({
        id: `experience-${index}-no-desc`,
        severity: 'warning',
        section: 'experience',
        message: `Experience entry ${index + 1} has no description. Add bullet points with achievements.`,
      });
    }

    if (exp.description && exp.description.split('\n').length < 2) {
      const sentences = exp.description.split(/[.!?]+/).filter(Boolean);
      if (sentences.length < 2) {
        results.push({
          id: `experience-${index}-weak-desc`,
          severity: 'info',
          section: 'experience',
          message: `Experience entry ${index + 1} description is brief. Add multiple bullet points with quantified results.`,
        });
      }
    }
  }
}

function checkEducation(viewModel: ATSResumeViewModel, results: ATSCheckResult[]): void {
  if (viewModel.education.length === 0) {
    results.push({
      id: 'education-missing',
      severity: 'warning',
      section: 'education',
      message: 'Consider adding education entries for ATS keyword matching.',
    });
    return;
  }

  for (const [index, edu] of viewModel.education.entries()) {
    if (!edu.degree || edu.degree.trim().length === 0) {
      results.push({
        id: `education-${index}-no-degree`,
        severity: 'error',
        section: 'education',
        message: `Education entry ${index + 1} is missing a degree name.`,
      });
    }

    if (!edu.institution || edu.institution.trim().length === 0) {
      results.push({
        id: `education-${index}-no-institution`,
        severity: 'error',
        section: 'education',
        message: `Education entry ${index + 1} is missing an institution name.`,
      });
    }

    if (!edu.startDate) {
      results.push({
        id: `education-${index}-no-date`,
        severity: 'warning',
        section: 'education',
        message: `Education entry ${index + 1} is missing dates.`,
      });
    }
  }
}

function checkSkills(viewModel: ATSResumeViewModel, results: ATSCheckResult[]): void {
  if (viewModel.skills.length === 0) {
    results.push({
      id: 'skills-missing',
      severity: 'error',
      section: 'skills',
      message: 'Add at least one skill for ATS keyword matching.',
    });
    return;
  }

  if (viewModel.skills.length > MAX_SKILLS) {
    results.push({
      id: 'skills-too-many',
      severity: 'info',
      section: 'skills',
      message: `${viewModel.skills.length} skills listed. Keep under ${MAX_SKILLS} for focused ATS matching.`,
    });
  }

  const skillNames = viewModel.skills.map((s) => s.name.toLowerCase());
  const duplicates = skillNames.filter((name, index) => skillNames.indexOf(name) !== index);

  if (duplicates.length > 0) {
    results.push({
      id: 'skills-duplicates',
      severity: 'warning',
      section: 'skills',
      message: `Duplicate skills detected: ${[...new Set(duplicates)].join(', ')}.`,
    });
  }
}

function checkProjects(viewModel: ATSResumeViewModel, results: ATSCheckResult[]): void {
  for (const [index, project] of viewModel.projects.entries()) {
    if (!project.name || project.name.trim().length === 0) {
      results.push({
        id: `projects-${index}-no-name`,
        severity: 'error',
        section: 'projects',
        message: `Project entry ${index + 1} is missing a name.`,
      });
    }

    if (!project.description || project.description.trim().length === 0) {
      results.push({
        id: `projects-${index}-no-desc`,
        severity: 'warning',
        section: 'projects',
        message: `Project entry ${index + 1} has no description.`,
      });
    }
  }
}

function checkFormatting(viewModel: ATSResumeViewModel, results: ATSCheckResult[]): void {
  if (viewModel.experience.length > 0) {
    for (const exp of viewModel.experience) {
      if (exp.description) {
        const longLines = exp.description
          .split('\n')
          .filter((line) => line.length > MAX_LINE_LENGTH);
        if (longLines.length > 0) {
          results.push({
            id: 'format-long-line',
            severity: 'info',
            section: 'formatting',
            message: `Some lines exceed ${MAX_LINE_LENGTH} characters. ATS systems may truncate long lines.`,
          });
          break;
        }
      }
    }
  }

  const allText = [
    viewModel.name,
    viewModel.headline,
    viewModel.summary,
    ...viewModel.experience.map((e) => e.description),
    ...viewModel.skills.map((s) => s.name),
  ].join(' ');

  const specialChars = allText.match(/[^\w\s.,;:!?\-–—'"/()#@&%$+={}\[\]|\\<>]/g);
  if (specialChars && specialChars.length > 5) {
    results.push({
      id: 'format-special-chars',
      severity: 'warning',
      section: 'formatting',
      message: 'Excessive special characters detected. ATS systems may not parse these correctly.',
    });
  }
}
