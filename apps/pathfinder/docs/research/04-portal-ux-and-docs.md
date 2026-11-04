# Research Brief — Portal UX & Documentation Conventions

*B2B portal UX/feature best practices and professional documentation conventions. Prepared June 2026.*

## PART A — B2B portal UX & feature recommendations

### 1. Information architecture for a deep org > facility > building hierarchy
Treat the tenant hierarchy as the architectural backbone, not cosmetics — it shapes data isolation, auth scoping, and navigation. Use a vertical sidebar as primary nav for complex multi-module products (reserve top bars for 4-7 sections). Cap nesting at three levels and compensate with location-based breadcrumbs that mirror IA (not browsing history). A standout pattern: make breadcrumb segments double as dropdown switchers — clicking "Lincoln High" opens a menu of sibling buildings. Govern menu growth aggressively. For large flat lists, lean on search-centric navigation, saved views/favorites (manual starring), and progressive disclosure.

### 2. Role-based access & client-facing professionalism
The admin/staff/client split maps to fine-grained, org-scoped roles. Clients infer engineering/QA/security quality from product polish — empty states, permission screens, partial data, and multi-step approvals must be deliberately designed. Clients expect clear project-progress visibility, a logged auditable review trail, role-based approvals, and secure document sharing.

### 3. Collaboration/review features that delight
- Inline comment threads anchored to a specific map region/document area, with nested replies.
- Resolve workflow with an easy resolve action; hide resolved comments, do not delete (preserves audit trail).
- @-mentions triggering targeted email notifications with a deep link.
- Version history with comments tied to each version — model the loop: staff uploads V1 -> client notified -> client annotates -> staff revises -> V2 -> approval recorded.
- Activity feed / notifications for thread participants, with batching to avoid notification fatigue.
- Export/share links for stakeholders outside the portal.

### 4. Onboarding, empty states & trust for gov/edu buyers
Empty states are a high-leverage onboarding moment — show what "working" looks like (sample facility, preview of a completed map) and offer one clear first action. A dedicated security/trust page is table stakes — its absence is a procurement disqualifier in regulated sectors. Surface the right certifications: SOC 2 Type II / ISO 27001 broadly; FedRAMP (federal) and GovRAMP (the Feb-2025 rename of StateRAMP) for government; FERPA / COPPA / SOPIPA for K-12. Hosting on a compliant cloud does NOT equal compliance — application-level controls must be implemented and stated. Place trust badges near conversion/sign-in points.

### 5. Common pitfalls
Menu sprawl; breadcrumbs as a substitute for primary nav; breadcrumbs on shallow 2-level pages; ungoverned notification volume; brand discontinuity between marketing site and logged-in product; treating empty/error states as an afterthought.

## PART B — Documentation & specification templates

### 1. Technical specification document structure
1. Title + metadata (status: Draft/Under-review/Approved; reviewers; version)
2. Overview / Summary / Scope
3. Background & problem statement
4. Goals and non-goals
5. Requirements (functional + non-functional)
6. Proposed solution / high-level design (1-2 diagrams)
7. Detailed design (architecture, data model, APIs, components)
8. Security & privacy considerations
9. Testing strategy
10. Rollout / deployment / migration plan
11. Risks, dependencies, mitigations
12. Alternatives considered
13. Open questions & revision history

Layer detail for mixed audiences: high-level solution + diagrams should let a PM/VP stop reading before the deep technical sections. Anchor to ISO/IEC/IEEE 29148 if needed. Favor living docs (Markdown alongside code) + ADRs for major decisions.

### 2. User stories & acceptance criteria
Pair a story (the business need) with Gherkin scenarios (validation):

> **User Story:** As a [client reviewer], I want to [comment on a specific room in a floorplan] so that [staff can correct the marker before sign-off].
>
> **Acceptance Criteria (Given/When/Then):** *Given* a registered client viewing facility map V2, *When* they place a pin and submit a comment, *Then* the comment is saved against V2, the assigned staff member receives an @-mention email with a deep link, and the pin renders for all participants.

Keep stories to 1-3 acceptance criteria (4+ means split). Describe behavior/outcomes, not implementation. Cover edge cases (boundary, error, permission).

### 3. Sprint plan / roadmap document
Roadmap = strategic, 2-4 month horizon, progress over deadlines; a Now/Next/Later format suits agile. Sprint plan = execution-focused: sprint goal, selected backlog items, task breakdown, owner assignment, capacity/velocity estimate, closed by review + retrospective.

### 4. AI agent "context guardrail" file (AGENTS.md / CLAUDE.md)
Golden rule: document only what the agent cannot infer. Auto-generated files measurably hurt (an ETH Zurich study found ~3% lower success, 20%+ higher cost); human-curated files improve success ~4% and cut bugs 35-55%. Keep it under ~150 lines. Recommended sections: Commands (exact, with flags), Boundaries (three-tier Always / Ask first / Never — "Never commit secrets" was the single most common helpful rule across 2,500+ repos), Project Structure (flat map with purpose annotations + tech versions), Code Style (3-10 line real snippets, only what differs from defaults), Testing, Git Workflow. Use decision tables to resolve tool ambiguity. Document counterintuitive rules.

### 5. Professional branded PDF rendering
For print-quality output with cover page, auto TOC, and section numbering: Pandoc + Eisvogel LaTeX template, or HTML+CSS via a print engine (WeasyPrint / Chrome). Set brand fonts via @font-face; YAML/metadata carries title, subtitle, author, version. Always test with real content — tables overflow margins at default settings. For branding: custom titlepage, brand color, logo, consistent section numbering.

## Sources

- https://lollypop.design/blog/2025/december/saas-navigation-menu-design/
- https://www.eleken.co/blog-posts/breadcrumbs-ux
- https://clerk.com/blog/how-to-design-multitenant-saas-architecture
- https://www.everything.design/blog/trust-signals-b2b-website
- https://www.moxo.com/blog/project-management-client-portal-workflow
- https://postnext.io/glossary/comment-thread
- https://vercel.com/docs/workflow-collaboration/comments/managing-comments
- https://www.appcues.com/blog/saas-onboarding-screens
- https://secureframe.com/blog/govramp
- https://newsletter.pragmaticengineer.com/p/software-engineering-rfc-and-design
- https://testquality.com/gherkin-user-stories-acceptance-criteria-guide/
- https://www.altexsoft.com/blog/acceptance-criteria-purposes-formats-and-best-practices/
- https://www.aha.io/roadmapping/guide/agile/agile-roadmap
- https://www.augmentcode.com/guides/how-to-build-agents-md
- https://www.morphllm.com/agents-md-guide
