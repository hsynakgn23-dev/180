# Growth and Mobile Plan (2026 Q1)

## 1) Traffic Growth Strategy

### Technical SEO baseline
- Keep `sitemap.xml` and `robots.txt` updated in every release.
- Expand structured data (`WebSite`, `WebApplication`, `Movie`) on high-intent pages.
- Improve Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1) with chunk splitting and lazy-loading.
- Add dedicated, crawlable landing pages for intent clusters (top films, director pages, yearly collections).

### Content engine
- Publish 3 weekly SEO pages:
  - "Best films by mood"
  - "Daily curated picks"
  - "Director deep dives"
- Use internal linking from homepage showcase to evergreen pages.
- Reuse social snippets from user ritual comments and convert to indexable article blocks.

### Viral and referral loops
- Add share cards after actions (ritual submitted, streak milestone, rank up).
- Introduce invite rewards:
  - inviter: premium badge + XP boost
  - invited user: onboarding boost
- Track UTM-tagged links for all shared cards.

### Community loops
- Weekly "Arena challenge" with leaderboard recap.
- Creator/influencer seeding: 20 niche cinema creators with custom profile cards.
- Lightweight newsletter digest: "This week in 180".

## 2) KPI Framework

### North-star and funnel
- North-star: weekly active ritual creators.
- Funnel targets:
  - Visit -> Signup conversion
  - Signup -> First ritual completion
  - Day-7 retention
  - Share rate per active user

### Experiment cadence
- 2 growth experiments per sprint (A/B test copy, CTA, landing composition).
- Decision rule:
  - keep if statistically positive on primary KPI
  - rollback if retention drops

## 3) Mobile Application Plan

### Phase 0: Product validation (2-3 weeks)
- Define app goal: retention and daily habit strength, not feature parity.
- Select core MVP flows:
  - Daily showcase
  - Ritual write + publish
  - Notifications (replies, follows, streak)
  - Profile and streak tracking
- Set analytics schema identical to web events.

### Phase 1: MVP build (6-8 weeks)
- Stack: React Native + Expo (shared TypeScript domain layer with web where possible).
- Backend: existing Supabase auth and social tables.
- Push notifications: Expo push service.
- Offline-first:
  - cache daily list
  - queue ritual drafts for retry

### Phase 2: Beta and optimization (4 weeks)
- Closed beta with 200-500 users.
- Fix crash-free rate to >99.5%.
- Optimize onboarding and first ritual completion.
- Add deep links from web share cards to app screens.

### Phase 3: Launch and growth sync (ongoing)
- App Store Optimization:
  - keyword-rich title/subtitle
  - weekly screenshot refresh for experiments
- Run web-to-app prompts for high-intent users.
- Measure blended retention (web + mobile) and rebalance roadmap quarterly.

## 4) Gemini Collaboration Workflow

Use Gemini as a growth copilot while implementation stays in this repository:
- Prompt 1: "Generate 10 SEO landing page topic clusters for a cinephile social app."
- Prompt 2: "Propose 5 referral mechanisms with anti-abuse safeguards for invite rewards."
- Prompt 3: "Create an ASO keyword set for TR/EN audience in cinema discovery apps."

Bring outputs into backlog as hypotheses, then validate with A/B tests.
