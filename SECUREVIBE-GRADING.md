# SecureVibe UI/UX Grading Spec

Purpose: replace the current UI/UX scoring in SecureVibe with a grader that detects the structural fingerprints of AI-generated landing pages inside a GitHub repo, and produces a score, a percentile, a dialect classification, and a copy-pasteable fix prompt for every finding.

This document is the source of truth for that grader. Everything in it comes from a direct comparison of 11 vibe-coded sites against professional sites (Stripe, Supabase, Add3, Slack, Vercel and others). Where a signal is described, the detection method is written so it can run against source files, not a live URL.

## 1. The core principle

Score the skeleton, not the paint.

The current scanner rates obviously vibe-coded repos above 90 because it evaluates the things AI is good at: clean code, consistent spacing, decent prose, a pleasant palette. Those are not what a human sees when they call a site "vibe coded." A human sees the same structure they have seen a thousand times, and content shaped like evidence with nothing behind it.

Three rules follow from this:

Rule 1. Prose quality never raises the score. LeadFlux has excellent, specific, personal copy and still carries every structural tell. A grader that rewards good writing will be fooled by exactly the sites that look best on the surface.

Rule 2. Color never lowers the score on its own. A purple site is not a vibe-coded site. A specific hex is only evidence when it co-occurs with structural signals (see Section 4).

Rule 3. Evidence beats claims. Every professional site links its claims to something clickable: a case study page, a status page, a tweet, a photograph. Every vibe-coded site renders a card shaped like evidence with nothing behind it. This single distinction explains most of the gap.

## 2. The template script

Vibe-coded landing pages follow a fixed section order. Detecting this order is the backbone of the grader.

The script, in order:

1. Hero: eyebrow tag, H1, subhead, primary button, secondary button
2. Stat strip: three or four round-number stats in a row
3. Logo cloud: "Trusted by" plus five or six logos
4. Feature grid: six cards in a 3x2 grid, each with icon, short title, one sentence
5. How it works: exactly three numbered steps
6. Pricing: three tiers, middle tier badged "Most Popular"
7. Testimonials: three or six cards, initials avatars, five stars each
8. FAQ: five or six accordion questions
9. Final CTA: H2 beginning "Ready to", restating the hero
10. Footer: three or four link columns plus a tagline restating the hero

Observed on: Killa Marketing, Impry OS, Yesler Media, DMC. Partial matches on LeadFlux, Aegis, Idle9.

Professional sites skip steps freely. Add3 has no FAQ, no pricing, no how-it-works. Supabase has no FAQ and no pricing tiers on the homepage. Stripe has no FAQ. Sections exist because the company has something specific to say there.

Detection: parse the main page component (app/page.tsx, pages/index.tsx, index.html, App.jsx or equivalent). Classify each top-level section by its content (heading text, child element types, presence of a mapped array). Produce the section sequence. Compute the longest common subsequence against the script. Report matched steps and their order.

## 3. Signal catalog

Each signal below has: what it is, where it was observed, how to detect it in a repo, a weight, and a fix prompt template. Weights are on a 100-point deduction scale. The grader starts at 100 and subtracts. Floor at 0.

### 3.1 Content-as-data arrays

The strongest single repo-level tell. Sections render from a mapped array of uniform objects: `const features = [{ icon, title, description }, ...]`, same for testimonials, steps, FAQs, pricing tiers, stats. Every item has identical shape, so every card has identical shape, so the section looks like a whiteboard of cards.

Professional sites hand-lay each block because each block carries different content, different size, different media.

Detection: find array literals whose elements are object literals sharing the same key set, where the array is consumed by `.map()` that returns JSX or an HTML template. Count sections rendered this way. Also flag shared card components used more than once on the same page with only prop differences.

Weight: 4 points per mapped section, cap 20.

Fix prompt template:
"Rewrite the [section name] section without a shared card component and without mapping over an array. Lay out each item by hand as its own block. Make the blocks different sizes. Put a real screenshot or photograph in at least one of them. Remove any item that has nothing specific to show."

### 3.2 Eyebrow labels above headings

A small uppercase label directly above an H2 that names the section type: "Why choose us", "Features", "Process", "Pricing", "FAQ", "The trust problem", "Quick start". The model generates a section from a prompt like "features section" and leaves the prompt on the page.

Observed: LeadFlux, Killa, Impry, Aegis, DMC, Yesler, Idle9. Ratio near 1:1 with H2 count. Add3 and Supabase: zero. Stripe: one or two on a page ten times longer.

Detection: find text elements with small font and uppercase or wide letter-spacing classes (`text-xs`, `uppercase`, `tracking-wide`, `tracking-widest`, `font-mono`, or CSS equivalents) that are the immediate previous sibling of an h2 or share a parent with an h2 as the first child. Divide count by total h2 count.

Weight: ratio above 0.5 subtracts 10. Ratio above 0.25 subtracts 5.

Fix prompt template:
"Remove every small uppercase label that sits above a section heading. The heading must carry the meaning on its own. If the heading cannot stand without the label, rewrite the heading."

### 3.3 Zero-padded counters

"01", "02", "03" applied to steps, FAQ questions, feature cards, principles, or a sideways section index. Numbering imposes order where no real hierarchy exists.

Observed: Aegis ("01 / CLAIM", "02 / CHANGE"), DMC (section index 01 to 05, FAQ numbered), Idle9 (sections numbered 01 to 05), Yesler (services numbered). Professional sites: none.

Detection: string literals matching `^0[1-9]` rendered as visible text, or `padStart(2, '0')`, or CSS counters with leading-zero formatting.

Weight: 8 if present anywhere. Additional 4 if applied to more than one section type.

Fix prompt template:
"Remove all numbered labels (01, 02, 03) from [section]. Only number items whose order carries meaning, such as literal sequential steps a user must perform. For those, use plain numerals inside the heading text, not decorative counters."

### 3.4 Copy fingerprints

Exact phrases that recur across unrelated companies because the model produced them.

Confirmed verbatim matches:
- "Everything you need. Nothing you don't." (Killa, a web agency, and Impry, a freelancer CRM)
- "Simple, transparent pricing"
- "No credit card required"
- "14-day free trial"
- "Trusted by" as a logo-cloud header
- "Ready to [verb]" as the final H2
- "Frequently Asked Questions" or "Your Questions, Answered"
- "How it works"
- "Why choose us"

Negation-defined value: H2 and H3 copy built as "X is not Y" or "X, not Y". Aegis: "A finding is not a verdict", "A patch is not proof", "Missing proof stays missing". Idle9: "A computer, not a sandbox".

Detection: case-insensitive grep across all string literals and text nodes for the phrase list. Separately, count h2 and h3 text containing " not " or " never " as the pivot of the sentence.

Weight: 2 per fingerprint phrase, cap 10. Negation construction in headings: 3 if two or more headings use it.

Fix prompt template:
"Replace the phrase '[phrase]' with a sentence that names what this product specifically does for this specific customer. Do not use a contrast construction (X not Y). State the thing directly."

### 3.5 One-liner restatement

The same sentence appears in the meta description, the hero subhead, the final CTA body, and the footer tagline. Four or five copies of one idea.

Observed: Impry, Killa, DMC, Idle9. Stripe, Add3, Supabase footers are links only with no tagline about what the company is.

Detection: extract meta description, hero paragraph (first p after h1), final CTA paragraph (p inside the last section before footer), footer tagline (first p inside footer). Compute pairwise token overlap or embedding similarity. Count pairs above 0.6.

Weight: 3 per duplicate pair, cap 9.

Fix prompt template:
"The product one-liner appears [n] times on this page. Keep it in the hero only. Delete the footer tagline entirely. Rewrite the final CTA to say something the hero did not say, such as a specific next step or a specific outcome."

### 3.6 Testimonial and social proof structure

Vibe pattern: avatar is a div with one or two capital letters in a colored circle. Every quote is two sentences. Every rating is five stars. Nothing links anywhere. Logo cloud shows companies with no relationship to the product (Impry, pre-launch, shows Vercel, Loom, Cash App, Zapier).

Professional pattern: headshot image file, full name, job title, company logo as its own asset, link to a full case study page. Supabase links every community tweet to the actual tweet URL. Add3 ships Costco and Fujitsu logos as separate greyscale image files and places its one quote on a photograph.

Detection: for each block that looks like a testimonial (contains a quote-length string plus a name-length string):
- avatar is `<img>` with a file that exists in the repo, or a div containing a 1 to 2 character uppercase string
- block contains an anchor to a non-# URL
- star rating rendered from a constant (five identical star glyphs per block)
- sentence count of the quote
For logo clouds: check whether logo images exist as files versus text spans or SVG inlined from an icon library.

Weight: initials avatars 6. No outbound link on any testimonial 4. All ratings identical 3. All quotes same sentence count 3. Logo cloud as text spans 4. Cap 20.

Fix prompt template:
"Rebuild the testimonials section with real evidence only. Each testimonial needs a headshot image file, full name, title, company, and a link to where this person said it (a case study page, a tweet, a review site). Remove star ratings. Remove any testimonial you cannot source. If that leaves zero, delete the section. Replace the logo cloud with actual logo files of companies that have used the product, or delete it."

### 3.7 Placeholder residue

Unfinished work that shipped.

Observed: Yesler ships a heading reading "Cases Section Test", counters stuck at "0%" and "0x", "View Live Site" pointing to "#". Killa social links all go to "#", copyright says 2024. Impry shows "Loading workspace..." on a marketing page and a CTA reading "Hey There, Create your free account", footer links to Integrations, Changelog, Documentation, API Reference, Community and Blog all go to "#". Prometheus ships an empty HTML body with canonical pointing to a different domain.

Detection:
- count `href="#"` and `href=""`
- hardcoded "0" adjacent to count-up or animation attributes
- string literals: "Test", "TODO", "Lorem", "Hey There", "placeholder", "coming soon", "Loading" in marketing components
- copyright year earlier than the repo's first commit year
- routes referenced in nav or footer that have no matching file in the app or pages directory
- canonical URL domain differing from configured site URL

Weight: 2 per dead link, cap 10. 5 per leaked test string. 3 for stale copyright. 3 per referenced route with no file, cap 9.

Fix prompt template:
"Remove every link whose href is '#'. For each footer link that points to a page that does not exist, either build that page with real content or delete the link. Remove the text '[leaked string]'. Update the copyright year. Do not leave any placeholder in a shipped file."

### 3.8 Stat strips

Three or four stats in a row under the hero, round numbers, no source. "4.9 rating, 100+ happy clients, 48h delivery." "From $7.99, ~30 seconds, Root on Ubuntu, Cancel any time."

Professional: specific and sourced. Stripe: $1.9T in 2025, 99.999% uptime linking to the status page, 200M+ subscriptions. Add3 mixes numbers and words in its row ("$150M+", "5+ YEARS", "GLOBAL", "Direct", "Reporting"), which is awkward and human. A template never produces an awkward row.

Detection: a flex or grid container of 3 or 4 children, each containing a short numeric string and a short label. Check whether any child links out. Check whether numbers are round (end in 0, 5, or "+", or are single-digit ratings).

Weight: 5 if present with no outbound links. 3 more if all numbers are round.

Fix prompt template:
"Remove the stat row unless every number is specific, true, and linked to its source. Replace '100+ happy clients' with the actual count and a link to where those clients are listed. If you cannot source a number, delete it."

### 3.9 Product screenshots built from divs

The model cannot take a screenshot, so it draws one out of cards: "Invoice Paid +$2,400.00", "Scope Guard Active", a fake search result, a fake Instagram post, a fake CRM pipeline. This is the whiteboard feel.

Observed: Impry, Yesler. Aegis uses real PNG captures and labels each one "Real Aegis product capture", which shows the builder knew the default looks fake.

Professional: Stripe, Supabase, Add3 embed real captures, photographs, video.

Detection:
- count raster and video files in public, assets, or static directories, excluding favicon, og image, apple-touch-icon, and logo files
- count `<img>` and `<video>` tags in page components versus card-like containers (`rounded`, `border`, `shadow` classes with nested text)
- detect hero visual: is it an image or video element, or a composed block of divs with mock data (currency strings, "Active", "Paid", "Just now")

Weight: fewer than 3 real media assets on a marketing site subtracts 10. Hero visual composed of divs subtracts 6.

Fix prompt template:
"Replace the mock UI built from divs in [section] with a real screenshot of the product exported as a PNG or WebP, or a real photograph. If the product does not exist yet, show nothing rather than a drawing of something that does not exist."

### 3.10 CTA label repetition

The hero button pair ("Get started" + "Learn more" or "Discover more") repeats identically three or four times down the page.

Professional: Stripe varies the verb per section (Start now, Contact sales, Read the story, Get the data, Watch video, Apply now). The label tells you what the section is for.

Detection: collect all button and anchor-styled-as-button text. Count occurrences of each label. Count distinct labels.

Weight: same primary label more than twice subtracts 4. Fewer than 4 distinct CTA labels on a page with 6 or more sections subtracts 4.

Fix prompt template:
"Give every section its own call to action that names what happens next in that section. Do not reuse 'Get started' more than once on the page. Delete secondary buttons that only scroll to the next section."

### 3.11 Route depth

Nav links go to #features, #pricing, #faq. Footer columns point to routes that do not exist. The whole site is one page pretending to be many.

Professional footers contain 40 to 100 working links to real pages, and the content proves the company existed before the homepage (Add3 lists blog posts from 2021, Supabase ships humans.txt and lawyers.txt).

Detection: count routes or page files. Count nav anchors starting with #. Count footer links versus footer links resolving to existing routes.

Weight: single route with anchor-only nav subtracts 6. Footer with more than half dead links subtracts 6.

Fix prompt template:
"The site has one route and a nav of anchor links. Either build the pages the nav promises (each with content that would not fit on the homepage) or collapse the nav to only what exists. A footer link column must only contain links to pages that exist."

### 3.12 Emoji and icon grids

Emoji used as feature icons. Icon-in-rounded-square wrappers around lucide-react or heroicons imports, one per card, in a uniform grid.

Observed: Killa (⚡ 💰 🎨 📱 🔒 🚀), Yesler (✓ ✓ ✓ under the hero CTA). Professional sites: none.

Detection: count emoji code points inside JSX text or HTML. Count icon library imports rendered inside a container with `rounded` plus fixed width and height classes, repeated more than twice.

Weight: emoji as icons subtracts 6. Uniform icon grid subtracts 4.

Fix prompt template:
"Remove all emoji used as icons. Remove the icon from each feature card. If a feature needs a visual, use a cropped screenshot of that feature. Cards without a visual should be text only."

### 3.13 Feature grid uniformity

Six cards in a 3x2 grid, each with icon, two to four word title, one sentence. Sometimes the same page has this twice (Killa has a "Benefits" grid and a "Features" grid).

Professional: features vary in size. Supabase uses a bento with one large card and several small. Stripe uses an accordion.

Detection: grid container with 6 children of identical structure. Count occurrences per page.

Weight: 5 per uniform 6-grid, cap 10.

Fix prompt template:
"Rebuild the features section so the blocks are different sizes. Give the most important feature the most space and a real screenshot. Give minor features one line each. Merge or delete any feature whose description is generic."

## 4. The two dialects

The user base will assume there is one AI look. There are two. Report which one the repo is in so users understand that switching between them does not move their score.

Dialect A (SaaS default): white or near-black background, gradient primary buttons, emoji or icon feature cards, rounded-2xl on everything, backdrop-blur, "Most Popular" badge, theme colors around #18181b or pure white. Observed: Killa, Impry, Yesler.

Dialect B (editorial): cream background, one italic serif word in the hero, monospace uppercase labels, generous whitespace, everything numbered 01 02 03, vermilion or warm accent. Observed: Aegis, DMC, LeadFlux, Idle9. Aegis and DMC, two unrelated companies in different industries, ship the identical theme color #f4f0e7. The palette came with the model.

Detection: theme-color meta tag, background hex in globals.css or tailwind config, presence of `font-serif italic` on a hero span, presence of `font-mono uppercase` labels, gradient button classes.

Scoring rule: dialect membership is reported, not deducted. The hexes #f4f0e7, #FAF9F7 and #18181b only count as a 3-point deduction when at least two structural signals from Section 3 are also present. This satisfies the constraint that a legitimately purple or cream brand is not penalized for color.

Output text for the user: "This repo is in Dialect [A/B]. Rebuilding it in the other dialect will change the paint and leave the skeleton. Your score will move by fewer than 5 points."

## 5. Scoring model

Start at 100. Apply deductions from Section 3 with the stated caps. Floor at 0.

Weight summary (maximum deduction per signal):
- Content-as-data arrays: 20
- Social proof structure: 20
- Placeholder residue: up to 27 (rarely maxes)
- Eyebrow ratio: 10
- Copy fingerprints: 13
- Zero-padded counters: 12
- Screenshots built from divs: 16
- Route depth: 12
- Feature grid uniformity: 10
- Emoji and icon grids: 10
- One-liner restatement: 9
- Stat strips: 8
- CTA repetition: 8
- Template script order match: see below

Template script: if 7 or more of the 10 steps appear in order, subtract 10. If 5 or 6, subtract 5. This is separate from the per-section deductions above and captures the "I have seen this before" feeling directly.

Percentile: maintain a distribution of scores across all scanned repos. Report "Score 61. That is top 78 percent of scanned repos. Top 50 percent starts at 74." The percentile is more motivating than the raw number and gives the user a concrete next target.

Never let prose quality, code quality, Lighthouse scores, or color choice raise the score. Those belong in a separate section of the report if reported at all.

## 6. Output format

For every finding, output exactly this structure:

```
[SIGNAL NAME] (-N points)
What we found: <one sentence, cite the file and line or component name>
Why it reads as vibe coded: <one sentence>
Fix prompt (paste into your AI tool):
"<filled-in template from Section 3, with section names and phrases substituted>"
```

Order findings by points deducted, largest first. After the findings, output the dialect classification and the percentile line.

End the report with the professional end state, restated as rules the user can hold up against their own page (Section 7).

## 7. The professional end state

Stated as audience-independent rules, since the goal is not to copy Stripe but to reach the properties Stripe, Add3 and Supabase share despite looking nothing alike.

- Each section exists because the company has something specific to show there. Sections with nothing specific get cut.
- Every claim links to its evidence: a case study page, a status page, a tweet, a photograph, a review site.
- Numbers are specific and traceable. A round number with no source is worse than no number.
- The product appears as real captures or real photography. Never as cards drawn to look like a product.
- Button text changes with the section's purpose.
- The page says its one-liner once, in the hero.
- No section carries a label describing what kind of section it is.
- Nothing is numbered unless the order carries meaning.
- Blocks within a section differ in size according to importance.
- The footer proves depth. Every link in it works and leads to real content.
- Nav items lead to pages, not anchors.
- No emoji as icons. No icon grid.
- Nothing shipped is a placeholder.

## 8. Implementation notes for Claude Code

Parsing targets, in priority order: Next.js app directory (app/page.tsx, app/layout.tsx), Next.js pages directory, Vite or CRA (src/App.jsx, src/pages), Astro (src/pages/index.astro), plain HTML (index.html). Use an AST parser for JSX and TSX (babel or swc), and an HTML parser for static files. Do not rely on regex for structure. Regex is fine for the copy fingerprint grep.

Tailwind class matching should also handle CSS modules and styled-components by looking for the equivalent properties (text-transform: uppercase, letter-spacing, font-size under 0.8rem).

For sites built from component libraries (shadcn, Chakra, MUI), the shared card component signal (3.1) should look at the consuming page, not the library. A `<Card>` used six times in a map with prop-only differences is the tell. A `<Card>` used once is not.

False positive guards:
- Documentation sites and dashboards are not landing pages. Only run this grader on marketing routes. Detect a marketing route by the presence of an h1 plus a CTA anchor above the fold and the absence of a sidebar nav or auth guard.
- A single numbered list of literal sequential setup steps (install, configure, run) is not a zero-padded counter violation if the numbers are plain digits inside the step heading and the steps are commands. Deduct only for decorative counters.
- One testimonial with initials is a weak signal. Three or more is strong. Scale 3.6 by count.
- Eyebrow detection must exclude breadcrumbs and date stamps.

Validation set. Use the sites from this analysis as fixtures where the source is available or where the rendered HTML can be captured for a test. Expected direction:

Should score low (vibe coded): leadflux.agency, killamarketing.com, securevibe-peach.vercel.app, yeslermedia.com, jdsproservices.org/detailing, impry-os.vercel.app, dmc.cc, idle9.com, prometheus-website-beta.vercel.app, aegistrustlayer.com, monicahq.com

Should score high (professional): vercel.com, slack.com, doordash.com, add3.com, stripe.com, supabase.com, lovable.dev, tesla.com, base44.com, apple.com, tradingview.com, crypto.com, chobani.com, relexsolutions.com

The grader is working when LeadFlux scores low despite its copy being the best on the list, and when Aegis scores low despite having real product screenshots. Both should lose most of their points on structure (eyebrows, counters, template order, restatement), not on media.

## 9. Fix prompt design rules

Every fix prompt the product emits must attack the skeleton, not the paint. Rules:

- Name the exact section and file.
- Tell the AI what to delete before what to add. Most fixes are deletions.
- Forbid the shared component and the mapped array explicitly. If the prompt does not forbid them, the AI will rebuild the same grid with new colors.
- Require real assets by name (a PNG screenshot, a headshot file, a link to a source). If the user cannot supply them, the prompt should instruct deletion, not substitution with a mock.
- Never suggest a color, font, or gradient change. Those are dialect swaps.
- Keep each prompt under 120 words so it fits in one paste.
