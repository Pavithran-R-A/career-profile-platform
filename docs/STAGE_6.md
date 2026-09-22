# Stage 6: ATS Resume Builder & Job Tailoring

## Overview

Stage 6 introduces an ATS-optimized resume builder that helps users create parseable, ATS-friendly resumes and tailor them to specific job descriptions. The system analyzes job requirements, provides match scoring, and generates tailoring suggestions.

## Architecture

### Core Modules

| Module              | File                                         | Responsibility                                                          |
| ------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| ATS View Model      | `src/tests/unit/ats-view-model.test.ts`      | Validates ATS data, serializes for export, computes character counts    |
| Job Parser          | `src/tests/unit/job-parser.test.ts`          | Parses job descriptions into structured requirements, extracts keywords |
| Requirement Matcher | `src/tests/unit/requirement-matcher.test.ts` | Matches job requirements against profile data with confidence scoring   |
| PDF Renderer        | `src/tests/unit/pdf-renderer.test.ts`        | Generates structured PDF document with page-break aware layout          |
| Variant Manager     | `src/tests/unit/variant-manager.test.ts`     | Creates, updates, duplicates, and manages resume variants per job       |

### Pages

| Page               | File                             | Purpose                                                                     |
| ------------------ | -------------------------------- | --------------------------------------------------------------------------- |
| ATS Resume Builder | `src/pages/ATSResumeBuilder.tsx` | Main builder UI: section selection, overrides, preview, and export          |
| Job Tailoring      | `src/pages/JobTailoring.tsx`     | Paste job description, analyze requirements, generate tailoring suggestions |

### Components

| Component            | File                                     | Purpose                                                           |
| -------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| ATS Preview          | `src/components/ATSPreview.tsx`          | Renders ATS-optimized resume preview with plain text, no graphics |
| Requirement Analysis | `src/components/RequirementAnalysis.tsx` | Displays match score, requirements with matched/unmatched status  |
| Tailoring Review     | `src/components/TailoringReview.tsx`     | Shows tailoring suggestions with accept/reject controls           |

## Data Flow

```
Job Description ─► Job Parser ─► Requirement Analysis
                                      │
                                      ▼
Profile ──────────► Requirement Matcher ──► Match Score + Suggestions
                                              │
                                              ▼
                                      Tailoring Review (accept/reject)
                                              │
                                              ▼
                                      ATS Resume Builder (filtered data)
                                              │
                                              ▼
                                      ATS Preview ─► PDF Export
```

## ATS Resume Design Principles

1. **Plain text layout** — No tables, columns, or graphics that confuse parsers
2. **Standard headings** — Uses recognized section names (Experience, Education, Skills)
3. **Linear structure** — Top-to-bottom reading order, no sidebars
4. **Consistent formatting** — No custom fonts, colors, or decorative elements
5. **Keyword optimization** — Skills section prominently displays technical keywords
6. **Character limit awareness** — Validates content stays within ATS parsing limits

## Job Description Parser

The parser handles various job posting formats:

- Structured headers (`Job Title:`, `Company:`, `Location:`)
- List-based requirements (bullet points with `-`, `•`, `*`, `–`)
- Section detection (Requirements, Nice to Have, Responsibilities)
- Employment type detection (Full-time, Part-time, Contract, etc.)
- Keyword extraction with frequency ranking

### Keyword Extraction

Keywords are extracted by:

1. Lowercasing and cleaning text
2. Removing stop words (common English words)
3. Counting word frequency
4. Returning top 20 keywords by frequency
5. Preserving technical tokens (`C++`, `C#`)

## Requirement Matching

Requirements are matched against profile data in priority order:

1. **Skills** (confidence: 0.95) — Direct skill name match
2. **Experience** (confidence: 0.6) — Keyword found in experience text
3. **Education** (confidence: 0.5) — Keyword found in education text

Match results include:

- Boolean match status
- Confidence score (0–1)
- Source of match (skill/experience/education)
- Matched term

## PDF Rendering

The PDF renderer generates a structured document:

- **Page size**: US Letter (612×792 points)
- **Margins**: 50 points on all sides
- **Font sizes**: 18pt name, 11pt headings, 10pt body, 9pt metadata
- **Page breaks**: Automatic when content exceeds page bounds
- **Section separators**: Horizontal lines under headings

### Page Layout

```
┌──────────────────────────────┐
│  [Name - 18pt bold]         │
│  [Headline - 11pt]          │
│  [Location - 10pt gray]     │
│  [Links - 9pt gray]         │
│  ───────────────────────────│
│  PROFESSIONAL SUMMARY       │
│  [About text]               │
│                              │
│  EXPERIENCE                  │
│  ───────────────────────────│
│  [Role] | [Company]         │
│  [Date range]               │
│  [Description]              │
│                              │
│  EDUCATION                   │
│  [Institution]              │
│  [Degree — Field]           │
│                              │
│  SKILLS                      │
│  [Skill1 · Skill2 · ...]   │
│                              │
│  PROJECTS                    │
│  [Project name]             │
│  [Description]              │
└──────────────────────────────┘
```

## Variant Management

Resume variants allow users to maintain multiple tailored versions:

### Operations

| Operation   | Description                              |
| ----------- | ---------------------------------------- |
| Create      | New variant with custom overrides        |
| Read        | Retrieve by ID or filter by profile      |
| Update      | Modify any variant property              |
| Delete      | Remove a variant                         |
| Duplicate   | Clone with new name                      |
| Set Default | Mark one variant as default per profile  |
| Sort        | By name, creation date, or update date   |
| Search      | By name, job title, or company name      |
| Export      | Serialize variant config to JSON         |
| Import      | Deserialize JSON config into new variant |

### Variant Properties

```typescript
interface ResumeVariant {
  id: string;
  name: string;
  profileId: string;
  jobTitle: string;
  companyName: string;
  sectionOrder: string[];
  hiddenSections: string[];
  headlineOverride: string | null;
  aboutOverride: string | null;
  selectedSkills: string[];
  selectedExperienceIndices: number[];
  selectedEducationIndices: number[];
  selectedProjectIndices: number[];
  isDefault: boolean;
}
```

## Routes

| Route                  | Page               | Auth Required |
| ---------------------- | ------------------ | ------------- |
| `/dashboard/ats`       | ATS Resume Builder | Yes           |
| `/dashboard/tailoring` | Job Tailoring      | Yes           |

## Tests

| Test File                                    | Coverage                                                   |
| -------------------------------------------- | ---------------------------------------------------------- |
| `src/tests/unit/ats-view-model.test.ts`      | Validation, filtering, character count, serialization      |
| `src/tests/unit/job-parser.test.ts`          | Job parsing, keyword extraction, employment type detection |
| `src/tests/unit/requirement-matcher.test.ts` | Skill/experience/education matching, scoring, ranking      |
| `src/tests/unit/pdf-renderer.test.ts`        | PDF generation, layout, page breaks, section rendering     |
| `src/tests/unit/variant-manager.test.ts`     | CRUD, duplication, defaults, search, import/export         |

## Future Enhancements

- [ ] AI-powered resume rewriting for unmatched requirements
- [ ] ATS score simulation (simulating real ATS parsing behavior)
- [ ] Multi-format export (DOCX, plain text)
- [ ] Batch tailoring for multiple job applications
- [ ] Version history and diff view between variants
- [ ] Integration with job boards for automatic description import
