# Roadmap

## Stage 0 - Foundation

- [x] Project scaffold and tooling
- [x] Canonical profile types and validation
- [x] Username/subdomain policy
- [x] Supabase migration with RLS
- [x] AI provider abstraction
- [x] App shell UI
- [x] Worker API health endpoint
- [x] Documentation and threat model

## Stage 1 - Authentication + Profile

- [x] Supabase Auth integration (email/password)
- [x] Email verification handling
- [x] Password reset flow
- [x] Profile creation and editing UI
- [x] Username reservation on signup
- [x] Canonical profile with experience, education, projects, skills, links
- [x] RLS policies for all tables
- [x] Client-side routing with React Router

## Stage 2 - Resume Ingestion

- Resume file upload to Supabase Storage
- AI-powered resume parsing
- Structured profile extraction
- Manual review and correction flow

## Stage 3 - Portfolio Templates + Publishing

- Public profile rendering
- Wildcard subdomain routing (username.ourdomain.com)
- Multiple template options
- Mobile-responsive layouts

## Stage 4 - GitHub Evidence

- GitHub OAuth
- Repository import
- Language/tech evidence extraction
- GitHub Actions / Docker config detection

## Stage 5 - Recruiter AI

- Recruiter-facing question interface
- AI answers grounded in profile + evidence
- Conversation history
- Rate limiting

## Stage 6 - ATS Resume + Job Tailoring

- ATS-friendly resume PDF generation
- Job-specific profile variants
- Keyword optimization hints

## Stage 7 - Monetization / Domains

- Premium tier
- Optional .cv domain add-on (paid)
- Custom domain support
- Subscription management

## Stage 8 - Real-User Validation

- Beta testing
- Analytics
- Feedback loops
- Performance optimization
