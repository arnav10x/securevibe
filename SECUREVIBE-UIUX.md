# SECUREVIBE: UI/UX SCORING MODULE

**Extension to `SECUREVIBE.md`. Load both. This file supersedes any UI/UX scoring logic in the master document.**

**Read Part 12 first if you only read one part.** It supersedes Sections 6.3, 6.5, and Appendix B based on calibration against twenty hand-labeled real sites, and it adds an eighth dimension and a second generation of tells that the original rubric missed entirely.

**What this file is for:** the master doc defines the product thesis, scope, and output contract. This file defines the actual grading engine for the UI/UX half. It gives you the signal bank, the detection method for each signal against static repository source, the weights, the score ceilings, the false-positive guards, and the phrasing rules for findings.

**The problem this file exists to solve:** the current scanner returns scores above 90 for repositories that any working designer would identify as machine-generated in under five seconds. That is not a prompt-tuning problem. It is a scoring-architecture problem, and Section 6.2 explains the four structural causes and the replacement model.

**Non-negotiable constraint:** every rule in this file must be decidable from source code, configuration files, and repository metadata. No live rendering. No screenshot analysis. No fetching the deployed site. If a rule cannot be evaluated by reading files in the repo, it does not belong in v1 and must not be inferred, guessed, or hallucinated into a finding.

---

## PART 6: THE SCORING ENGINE

### 6.1 What the score is supposed to mean

The UI/UX score answers one question: **how much evidence is there in this repository that a human with design judgment made decisions here?**

It is not a beauty rating. It is not a measure of how much AI was used. Plenty of excellent products are built almost entirely with agents by people who then exercise judgment over the output. Plenty of hand-written codebases are ugly. The score measures **evidence of intent**, and intent leaves specific, countable traces in source code.

This framing matters because it determines what you look for. You are not asking "does this look AI-generated." You are asking "did anyone make a decision here, or did every value fall out of a default?" That question has file-and-line answers.

### 6.2 Why the current scanner over-scores, and the replacement

Four structural causes. All four need fixing together. Fixing one leaves the score inflated.

**Cause 1: subtractive scoring from a high floor.** A rubric that starts at 100 and deducts small penalties cannot produce a low score unless dozens of penalties fire simultaneously. A repository with no design tokens, no focus states, no empty states, and emoji icons will lose maybe 18 points under a subtractive model and land at 82. That is the exact failure being observed.

**Replacement:** score is **earned from zero**. Points exist only where positive evidence of a decision exists in the source. Absence of evidence is not a small penalty. It is zero points for that criterion. A repository with no design token layer does not lose 5 points for tokens. It earns 0 of the 20 available.

**Cause 2: no ceilings.** Under a purely additive model, a repository can accumulate points across easy criteria and still land high despite a disqualifying absence. Score ceilings fix this. Certain absences represent a hard boundary on how good the work can possibly be, and they cap the maximum regardless of everything else.

**Cause 3: models grade generously against their own output.** You are an LLM evaluating artifacts that were largely produced by LLMs. The default aesthetic in the repository is the default aesthetic in your own priors, so it reads as correct rather than as a default. Counteract this explicitly: **when a value in the repository matches the most statistically common value for its role, treat that as evidence of absent decision-making, not as evidence of good taste.** An `indigo-600` primary button is not a good color choice you happen to agree with. It is the absence of a color choice.

**Cause 4: no distinctiveness term.** A repository can technically satisfy accessibility and state-coverage criteria while still being visually indistinguishable from ten thousand others. The tell-density multiplier in Section 6.5 handles this and is the single largest correction to the current over-scoring.

### 6.3 The seven dimensions

Raw score out of 100, earned from zero.

| # | Dimension | Points | What it measures |
|---|-----------|--------|------------------|
| D1 | Design system foundation | 20 | Does a token layer exist, and do components consume it |
| D2 | Typography | 12 | Deliberate type choices, scale, and hierarchy |
| D3 | Color and contrast | 12 | Semantic color, verified contrast, not-color-alone |
| D4 | Layout and spacing intent | 12 | Variation with purpose, responsive decisions, rhythm |
| D5 | Interaction and motion | 14 | States, feedback, purposeful animation |
| D6 | State coverage | 15 | Empty, loading, error, edge, and boundary states |
| D7 | Accessibility | 15 | Focus, semantics, labels, keyboard, motion preference |

**D6 is weighted heavily on purpose.** State coverage is the strongest available proxy for human iteration. Generated code produces the happy path because the prompt described the happy path. Empty states, error states, and loading states get added when someone actually used the thing and hit a wall. It is the hardest signal to fake and the one that correlates best with real product work. Weight it accordingly and never let a repository score well without it.

### 6.4 Score ceilings

Apply after computing the raw dimension total. Take the **lowest** applicable ceiling. Ceilings are not cumulative penalties. They are boundaries.

| Condition | Ceiling |
|-----------|---------|
| No visible focus indication anywhere in the codebase, or `outline: none` / `focus:outline-none` applied without a replacement indicator | 65 |
| No design token layer at all (no CSS custom properties, no theme config extension, no equivalent) and raw color literals appear directly in three or more component files | 60 |
| Zero empty-state handling across all list or collection renders | 70 |
| Zero error-path handling in any data-fetching code | 70 |
| No responsive handling whatsoever (no breakpoints, no media queries, no container queries, fixed pixel widths on layout containers) | 55 |
| Emoji used as functional iconography in three or more distinct components | 75 |
| Interactive behavior attached to non-interactive elements (`onClick` on `div` or `span`) in three or more places with no keyboard handler and no role | 68 |
| Viewport meta disables zoom (`user-scalable=no`, or `maximum-scale=1`) | 60 |

A repository can hit several ceilings. It takes the lowest one. A repository with no focus states, no tokens, and no error handling is capped at 60, not penalized three times.

### 6.5 The tell-density multiplier

This is the correction that does the most work. After ceilings, apply a multiplier derived from how many independent generic-default tells fire.

Count distinct tells from the Part 7 signal bank. Distinct means different signal IDs, not repeated instances of the same signal. Five occurrences of `T-EMOJI-ICON` counts as one tell.

| Distinct tells | Multiplier | Reading |
|----------------|------------|---------|
| 0–1 | 1.00 | Specific choices throughout |
| 2–3 | 0.95 | Mostly deliberate, some defaults left standing |
| 4–5 | 0.88 | Recognizable default character |
| 6–8 | 0.78 | Reads as generated to a trained eye |
| 9–11 | 0.68 | Reads as generated to anyone |
| 12+ | 0.58 | Untouched tool output |

**Worked example.** A repository earns D1 6, D2 4, D3 5, D4 5, D5 4, D6 3, D7 7. Raw total 34. No ceiling is lower than the raw score, so the raw score stands. Nine distinct tells fire, giving 0.68. Final score 23.

**Second worked example, the case that currently breaks.** A competently generated Next.js and Tailwind app with clean code, TypeScript throughout, and passing lint. Under the old model it scored 92. Under this one: D1 8 (Tailwind config exists but `theme.extend.colors` is empty, components use default palette classes), D2 3 (Inter via `next/font`, no scale definition, three weights used inconsistently), D3 4 (no semantic tokens, contrast unverified, two pairs fail 4.5:1), D4 6 (responsive breakpoints present and consistent, but uniform `py-24` on eleven sections and one radius value throughout), D5 4 (hover states present, no focus-visible, no reduced-motion, one generic fade-in class applied to everything), D6 2 (loading spinner on one route, no empty states, no error boundaries), D7 6 (semantic HTML mostly correct, alt text present, no focus indication, two icon-only buttons unlabeled). Raw 33. Focus ceiling of 65 does not bind. Seven distinct tells fire, giving 0.78. **Final score 26.** That is the correct answer for that repository and it is the behavior the current scanner fails to produce.

### 6.6 Percentile mapping

Report the percentile alongside the raw number. It reframes the score as a position in a distribution rather than a grade, which is both more honest and more motivating.

| Score | Percentile | Band label |
|-------|-----------|------------|
| 0–15 | Bottom 25% | Untouched generation |
| 16–30 | Bottom 50% | Generated, unreviewed |
| 31–45 | Top 50% | Generated, lightly edited |
| 46–60 | Top 30% | Real decisions in some areas |
| 61–75 | Top 15% | Deliberate throughout, gaps remain |
| 76–88 | Top 5% | Design-led |
| 89–100 | Top 1% | Distinctive and complete |

Calibrate the distribution against real submissions as volume accumulates and update this table rather than the scoring math. The scoring math should stay stable so that scores are comparable over time.

Present it the way the master doc specifies: "You scored 34, which puts you in the top 50%. Fixing the three highest-weighted findings below moves you to roughly the top 20%." Give the user a target, not just a verdict.

### 6.7 Confidence and abstention

Every finding carries a confidence level. Report only `high` and `medium` findings to the user. Log `low` internally for calibration and do not surface them.

- **high.** The signal is directly present in source with an exact file and line, and the guard conditions in Part 7 do not apply.
- **medium.** The signal is present but the guard conditions are ambiguous, or detection required inference across two or more files.
- **low.** Pattern-matched but not confirmed, or the repository structure prevented reliable evaluation.

**Abstain rather than guess.** If a repository uses a framework, styling approach, or build setup you cannot parse confidently, say so and reduce the scored dimensions rather than inventing findings. A scanner that admits it could not evaluate the styling layer of a Svelte project with a custom preprocessor is more credible than one that fabricates findings. State which dimensions were skipped and score out of the remaining points, normalized.

Never report a file and line you have not actually read. A fabricated citation destroys the product's credibility permanently and is worse than no finding at all.

---

## PART 7: THE SIGNAL BANK

Every signal has an ID, a plain-language description, a static detection method, guard conditions that prevent false positives, and its effect on scoring.

**Read the guards.** They exist because the difference between a credible scanner and a annoying one is entirely in the false positive rate. A founder who gets one wrong finding stops trusting all of them.

**Standing guard across the entire bank:** the presence of `CLAUDE.md`, `.cursorrules`, `AGENTS.md`, `.github/copilot-instructions.md`, or any other agent configuration file is **never** a penalty and never contributes to tell density. Skilled engineers use agents. The product's thesis is about the quality of the output, not the provenance of the keystrokes. Penalizing the presence of agent config would make the scanner a plagiarism detector, which is a different and much worse product.

### 7.1 Design system tells

---

**`T-NO-TOKENS`: No token layer**

Colors, spacing, and radii are written as literals directly in components rather than referenced from a defined layer.

*Detection:* Search component files (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.astro`, `.html`) for hex literals (`#[0-9a-fA-F]{3,8}`), `rgb(`, `rgba(`, and `hsl(`. Count distinct values and the number of files containing them. Cross-reference against the existence of a token source: a `:root` block with custom properties, a `tailwind.config` with a populated `theme.extend.colors`, a `theme.ts` or `tokens.ts`, a CSS-in-JS theme object, or design token JSON.

*Fires when:* three or more component files contain raw color literals and no token source exists.

*Guards:* Do not fire on literals inside SVG path fills, chart configuration objects, email templates, or generated files. Do not fire when the literals resolve to a small consistent set that is clearly acting as an informal palette (five or fewer distinct values used consistently). That is a weak system, not an absent one. Score it lower in D1 but do not count the tell.

*Effect:* Tell. Triggers the 60 ceiling when the file count is three or more. D1 capped at 4 of 20.

---

**`T-DEFAULT-PALETTE`: Framework default palette used unmodified**

The color palette is entirely the framework's shipped defaults with no brand values introduced.

*Detection:* For Tailwind, check whether `theme.extend.colors` is empty or absent in `tailwind.config.{js,ts,mjs}` while color utility classes across the codebase draw exclusively from default scale names (`slate`, `gray`, `zinc`, `neutral`, `stone`, `red` through `rose`). For Material UI, check for an unmodified `createTheme()` with no `palette` override. For Bootstrap, check for absence of Sass variable overrides. For shadcn/ui, check whether the generated CSS variables in `globals.css` still hold the values written by `shadcn init`.

*Guards:* **Do not treat any specific hue as a tell on its own.** Purple is not a red flag. Twitch is purple. Stripe is indigo-adjacent. Figma is multicolored. The signal is *structural*: the absence of any modification to the default scale, not the presence of a particular color. A repository that defines `--brand-violet: #6E3AFF` in a token layer and uses it consistently has made a decision and must not be penalized for the decision landing on purple.

*Effect:* Tell. D1 capped at 10 of 20, D3 capped at 5 of 12.

---

**`T-GRADIENT-DEFAULT`: Gradient as an undifferentiated default**

Gradients applied across multiple unrelated element types as a substitute for a visual system rather than as a specific choice.

*Detection:* Count elements carrying gradient utilities or `linear-gradient(` declarations. Classify by element role: hero background, CTA button, card accent, section divider, text fill, icon background, border. Fires when gradients appear across **four or more distinct roles** in the same codebase.

*Guards:* A single gradient used consistently for one role is a legitimate and often good choice. Do not fire on it. Do not fire on gradient use in data visualization, where gradients encode value. Do not fire on a documented brand gradient defined once in the token layer and referenced by name.

*Effect:* Tell. D3 capped at 8 of 12.

---

**`T-UNIFORM-GEOMETRY`: One radius, one shadow, one padding everywhere**

Every surface in the interface has identical corner radius, identical elevation, and identical internal padding, indicating the values were never revisited after the first component was written.

*Detection:* Extract all border-radius values (utility classes and CSS declarations) across components. Compute the distribution. Fires when a single value accounts for **more than 90% of usages across 15 or more distinct elements**. Apply the same test independently to box-shadow values and to card-level padding.

*Guards:* Minimalist and brutalist design systems legitimately use a single radius (often 0). Check for corroborating intent before firing: if the token layer defines a radius scale with multiple named steps and the design simply uses one of them predominantly, that is a choice. If there is no scale defined at all and the value is the framework default (Tailwind `rounded-lg` at 8px, shadcn default `0.5rem`), fire. Do not apply the padding test to table cells, list items, or grid children, where uniformity is correct.

*Effect:* Tell. D4 capped at 7 of 12.

---

**`T-DEFAULT-TYPEFACE`: Default typeface, no type decision**

Typography falls through to the framework or system default with no loaded face and no defined scale.

*Detection:* Look for evidence of a type decision: `next/font` imports, `@font-face` declarations, `<link>` to a font CDN, a `fontFamily` extension in theme config, or a variable font file in the repo. Then check whether a type scale is defined anywhere (named steps in the token layer, a `typography` theme key, or consistent use of a limited size set). Fires when no face is loaded **and** no scale is defined, or when the only loaded face is Inter with no scale defined.

*Guards:* Inter is a good typeface and its presence alone is not a tell. The tell is Inter *plus* no scale *plus* no second face for any role. A repository using Inter as body with a distinct display face has made a decision. A repository using a system font stack deliberately (documented, or paired with a defined scale) has also made a decision. Do not fire on documentation sites, internal tools, or CLI-adjacent projects where a system stack is the appropriate convention.

*Effect:* Tell. D2 capped at 4 of 12.

---

### 7.2 Content and copy tells

---

**`T-EMOJI-ICON`: Emoji standing in for iconography**

Emoji characters used in functional icon positions: feature list markers, card headers, navigation, status indicators, button affixes.

*Detection:* Scan JSX text nodes, template literals, string constants in data arrays, and HTML text content for emoji codepoint ranges (U+1F300–U+1FAFF, U+2600–U+27BF, U+2190–U+21FF, U+2B00–U+2BFF, plus U+FE0F variation selectors). Classify position: adjacent to a heading, first character of a list item, inside a button, inside a card header, or mapped from a features/benefits data array. Fires when three or more occur in functional positions.

*Guards:* Do not fire on emoji in README files, commit messages, code comments, log output, test fixtures, or genuine user-generated-content features such as reaction pickers or emoji-based reactions where emoji are the actual subject matter. Do not fire on a single decorative emoji in a footer or a 404 page.

*Rationale to give the user:* emoji do not inherit `currentColor`, so they cannot respond to dark mode, hover state, or disabled state. They render differently on every operating system, so the design is not the same design for every visitor. They do not scale cleanly. Give the mechanical reason, not the aesthetic one, because the mechanical reason is not arguable.

*Effect:* Tell. Triggers the 75 ceiling at three or more. D2 capped at 8 of 12.

---

**`T-PLACEHOLDER-SOCIAL`: Fabricated social proof**

Testimonials, logo walls, or metrics that are placeholder content shipped as if real.

*Detection:* Multiple independent checks, any two of which firing together produce the signal.
- Testimonial author names matching a high-frequency generic set: Sarah Johnson, Michael Chen, Emily Rodriguez, David Kim, Jessica Martinez, Alex Miller, John Smith, Jane Doe, Michael Brown, Priya Sharma, and structurally similar first-plus-surname pairs drawn from the most common names in the training distribution.
- Job titles from the generic set: "Head of Operations", "Product Lead", "Verified User", "CEO, TechCorp", "Founder, StartupX", "Marketing Director".
- Avatar sources pointing at `i.pravatar.cc`, `randomuser.me`, `ui-avatars.com`, `avatar.vercel.sh`, `dicebear` with seeded random input, or Unsplash portrait IDs.
- Company names that are obvious placeholders: TechCorp, Acme, InnovateCo, CloudFlow, DataSync, plus single-word invented SaaS names in a logo wall with no corresponding image assets.
- Metrics with suspiciously round values presented as fact: "10,000+ users", "99.9% uptime", "5x faster", "Trusted by 500+ teams", with no data source anywhere in the repo.

*Guards:* Do not fire on files under `__tests__`, `*.test.*`, `*.spec.*`, `mocks/`, `fixtures/`, `stories/`, `.storybook/`, or seed scripts. Test fixtures are supposed to contain fake people. Do not fire on demo or example directories that are clearly labeled as such. Check whether the component is actually rendered in a route before flagging.

*Effect:* Tell. D-level effect is indirect, but this is among the highest-severity findings for the user because it is a trust and in some jurisdictions a legal problem, not just an aesthetic one. Report it prominently.

---

**`T-VAGUE-COPY`: Copy that names no product**

Headlines and body copy that could be moved to any other product in any other category without editing.

*Detection:* Extract user-facing string literals from hero sections, section headings, and CTA buttons. Test each against the substitution rule: replace the product name with a different product name from a different category. If the sentence remains equally true, it fails. Implement as pattern matching over a maintained phrase set: "build the future", "all-in-one platform", "at the speed of thought", "scale without limits", "supercharge your", "unlock the power of", "ship faster", "next-generation", "revolutionize", "transform the way you", "everything you need to", "the modern way to", "built for teams who", "effortlessly", "seamlessly", "powerful yet simple", "reimagine". Also flag hero headlines under four words that contain no product-specific noun.

*Guards:* Score density, not presence. One instance of "ship faster" is fine and might be accurate. Fires at **three or more distinct instances** across primary user-facing copy. Do not scan documentation, changelogs, or blog content. Do not flag copy inside i18n files for locales other than the default without checking the default first.

*Effect:* Tell. Report with a concrete rewrite, not just the flag. Show them Stripe's "Financial infrastructure for the internet" against "Build the future of payments" so the difference is visible rather than asserted.

---

**`T-UNIFORM-COPY-LENGTH`: Mechanically equal content blocks**

Every card in a set contains descriptions of near-identical length, indicating copy was padded or trimmed to fill a template rather than written to say something.

*Detection:* For each array of objects rendered through a `.map()` into a card or feature grid, compute the character-length standard deviation of the primary description field. Fires when the coefficient of variation is **below 0.12 across four or more items** and each description is between 60 and 200 characters. Apply the same test to heading word counts.

*Guards:* Do not fire on genuinely structured data where uniformity is correct: pricing tier feature lists, specification tables, comparison matrices, or any content where the fields are enumerable facts rather than prose. Do not fire on arrays with fewer than four items, where the statistic is meaningless.

*Effect:* Tell. D4 contribution reduced.

---

**`T-TYPOGRAPHIC-ARTIFACTS`: Copy pasted from a model without editing**

Punctuation patterns characteristic of model output appearing in interface copy.

*Detection:* In user-facing string literals only, count em dashes (U+2014), curly quotes (U+201C, U+201D, U+2018, U+2019), and the "not just X, but Y" construction. Compute density per hundred words.

*Guards:* This is the weakest signal in the bank and must never fire alone. It requires corroboration from at least two other content tells before it is reported. Curly quotes are correct typography and many careful writers use them deliberately, often inserted automatically by a CMS or a smart-quotes build step. Check for the presence of a typography plugin or smart-quote transform before firing. Em dashes are legitimate punctuation. Confidence is **medium at best**, never high.

*Effect:* Contributes to tell density only when corroborated. Never report as a standalone finding to the user. It reads as pedantic and it is frequently wrong.

---

### 7.3 Interaction and state tells

---

**`T-NO-FOCUS`: No keyboard focus indication**

Interactive elements have no visible focus state, or the default outline is removed without replacement.

*Detection:* Search for `outline: none`, `outline: 0`, `focus:outline-none`, and `*:focus { outline: none }`. For each occurrence, check whether a replacement exists in the same rule, the same component, or an adjacent `focus-visible` selector: a ring utility, a `box-shadow` on focus, a border change, or a background change. Separately, count total `focus-visible:` and `:focus-visible` occurrences across the codebase against the count of interactive elements.

*Guards:* Component libraries handle focus internally. If the repository uses Radix, Headless UI, Ark, React Aria, or shadcn/ui components that wrap them, check the component source or the CSS layer for the ring definitions before firing. `focus:outline-none` immediately followed by `focus-visible:ring-2` is **correct practice**, not a violation, because it removes the outline for mouse users while preserving it for keyboard users. Firing on that pattern is the single most common false positive in accessibility linting and it will make the product look uninformed.

*Effect:* Tell. Triggers the 65 ceiling. D7 capped at 5 of 15.

---

**`T-NO-STATES`: Happy path only**

Data-dependent views render only the success case. No empty, loading, or error branches exist.

*Detection:* Three independent sub-checks.
- **Empty:** for each `.map()` over a collection that renders list or grid items, check for a zero-length branch in the same component (`length === 0`, `length ? :`, `isEmpty`, an `EmptyState` component, or a conditional wrapper).
- **Loading:** for each data fetch (`useQuery`, `useSWR`, `fetch` in an effect, server component await, loader function), check for a pending branch that renders something other than `null`. A `Suspense` boundary with a real fallback counts. A `Suspense` with `fallback={null}` does not.
- **Error:** for each fetch, check for a `.catch`, a `try/catch` with user-facing output, an `error` field consumed in render, an error boundary component, or a framework error file (`error.tsx`, `+error.svelte`).

*Guards:* Static marketing pages have no data and must be excluded entirely from this check. Only evaluate components that actually consume async or collection data. Do not fire on a component that receives already-resolved props from a parent that does handle states. Trace one level up before concluding.

*Effect:* Two separate tells (`T-NO-EMPTY`, `T-NO-ERROR`) if both fire. Triggers the 70 ceiling. D6 scores near zero.

*Why this matters most:* say this to the user directly. Empty, loading, and error states are what get added after someone uses the product and hits a wall. Their absence is the clearest evidence in a codebase that nobody has used the thing they built. It is the finding most worth fixing and the one that most changes how the product feels.

---

**`T-DEAD-INTERACTION`: Interactive elements with no feedback**

Buttons, cards, and links that change nothing visually on hover, press, or disabled state.

*Detection:* Enumerate interactive elements (`button`, `a`, `[role="button"]`, `onClick` handlers). For each, check for any state variant: `hover:`, `active:`, `disabled:`, `:hover`, `:active`, `[disabled]`, or a state-driven class. Compute the proportion with zero state variants. Fires above **40%**.

*Guards:* A design system that handles all interaction states in a base layer or a shared `Button` component means individual usages correctly carry no variants. Resolve component definitions before counting. Do not count elements inside `.map()` renders more than once.

*Effect:* Tell. D5 capped at 6 of 14.

---

**`T-DIV-BUTTON`: Interactive behavior on non-interactive elements**

Click handlers attached to `div` or `span` without role, tabindex, or keyboard handling.

*Detection:* Find `onClick`, `@click`, `on:click` on `div`, `span`, `li`, or `img` elements. For each, check for `role="button"` or equivalent, `tabIndex={0}`, and an `onKeyDown` or `onKeyUp` handler covering Enter and Space.

*Guards:* A `div` with a click handler that is a genuine click-outside overlay, a canvas surface, a drag region, or a map interaction is not a button and should not be forced into one. Check whether a real interactive element exists inside the div (a card wrapper with a button inside it is fine, if slightly redundant). Do not fire when `role` and `tabIndex` and a key handler are all present, which is the correct manual pattern.

*Effect:* Tell. Triggers the 68 ceiling at three or more instances. D7 capped at 8 of 15.

---

**`T-NO-MOTION-PREF`: Motion preference ignored**

Animation exists in the codebase with no `prefers-reduced-motion` handling anywhere.

*Detection:* Count animation and transition declarations, keyframe definitions, and animation library imports (Framer Motion, GSAP, Motion One, `react-spring`, `auto-animate`). If any exist, search for `prefers-reduced-motion` in CSS, `useReducedMotion` in JS, or a `MotionConfig` with `reducedMotion` set.

*Guards:* Do not fire if the only animation is a loading spinner or a skeleton shimmer, which are generally exempt and often should keep moving. Do not fire on transitions under 150ms on color or opacity only, which do not trigger vestibular responses.

*Effect:* Tell. D5 capped at 9 of 14, D7 capped at 11 of 15.

---

**`T-GENERIC-MOTION`: One animation applied to everything**

A single fade-in or slide-up applied uniformly to every section regardless of what the section is or does.

*Detection:* Identify animation class or component usage. Fires when a single animation definition is applied to **six or more elements** with identical duration, identical easing, and no stagger, or when a scroll-reveal wrapper is applied to every top-level section in a page.

*Guards:* A consistent entrance animation for list items with a stagger is deliberate and correct. Do not fire on staggered sequences. Do not fire when durations or easings vary by element role.

*Effect:* Tell. D5 capped at 8 of 14.

---

### 7.4 Layout tells

---

**`T-UNIFORM-RHYTHM`: Identical vertical spacing on every section**

Every top-level section carries the same vertical padding, so the page has no rhythm and no signal about which sections matter.

*Detection:* Extract vertical padding and margin on top-level layout sections. Fires when a single value covers **eight or more sections** with no variation, particularly the framework-default heavy values (`py-24`, `py-20`, `py-32`, `5rem`, `6rem`).

*Guards:* A defined spacing scale with named section-rhythm tokens applied consistently is a system, not an absence. Check the token layer. Do not fire when spacing varies by section role even if the set of values is small.

*Effect:* Tell. D4 capped at 8 of 12.

---

**`T-RIGID-GRID`: Template geometry regardless of content**

Three-column feature grids, 2×2 benefit blocks, and sequential `01 / 02 / 03` numbering applied where the content is not actually a sequence or a set of three.

*Detection:* Find grid containers with fixed column counts rendering a mapped array. Flag where the array length exactly matches the column count and the content items are not naturally enumerable. Separately, find zero-padded sequential numbering in section eyebrows or card headers and check whether the surrounding content describes an ordered process. If order does not carry meaning, the numbering is decoration pretending to be structure.

*Guards:* Three pricing tiers should be three columns. A four-step onboarding flow should be numbered. Do not fire when the count is dictated by the domain. Do not fire on numbered lists in documentation.

*Effect:* Tell. D4 capped at 9 of 12.

---

**`T-NO-RESPONSIVE`: No responsive decisions**

*Detection:* Count breakpoint prefixes (`sm:`, `md:`, `lg:`, `xl:`), `@media` queries, and container queries. Check layout containers for fixed pixel widths. Check for `width=device-width` in the viewport meta.

*Guards:* Some projects are legitimately desktop-only (internal dashboards, developer tools, design software). Check the README and package description before firing at full weight. Reduce to medium confidence when the project self-describes as desktop-targeted.

*Effect:* Tell. Triggers the 55 ceiling. D4 near zero.

---

**`T-VIEWPORT-LOCK`: Zoom disabled**

*Detection:* `user-scalable=no`, `maximum-scale=1`, or `minimum-scale=1` in viewport meta.

*Guards:* None. This is always wrong. It breaks the product for every low-vision user and it is a WCAG 1.4.4 failure.

*Effect:* Tell. Triggers the 60 ceiling.

---

**`T-VH-MOBILE`: `100vh` on mobile layouts**

*Detection:* `100vh`, `h-screen`, or `min-h-screen` on full-height containers with no `dvh` equivalent and no fallback.

*Guards:* Fine on desktop-only projects. Fine when paired with a `@supports (height: 100dvh)` fallback or when the element is not a primary scroll container.

*Effect:* Contributes to D4 scoring, does not count as a distinct tell. It is a bug, not a taste signal.

---

### 7.5 Accessibility signals

These are not "tells" in the generated-code sense. They are correctness failures, and they affect dimension scores and ceilings but are reported in their own section with WCAG references so the user can act on them without arguing about taste.

---

**`A-CONTRAST`: Contrast below threshold**

*Detection:* Resolve foreground and background pairs where both are statically determinable: utility class pairs on the same element or a parent chain, CSS rules with both properties, or token pairs. Compute the WCAG relative luminance ratio. Flag normal text below **4.5:1** and large text (18.66px bold or 24px regular and above) below **3:1**. Flag interactive component boundaries and graphical objects below **3:1** per WCAG 1.4.11.

*Common failures worth naming explicitly, because they appear constantly:* `text-gray-400` on white is roughly 2.8:1 and fails. `text-gray-500` on white is roughly 4.6:1 and passes body text but fails as a border. `text-white` on `bg-yellow-400` is roughly 1.7:1 and fails badly. Placeholder text at `text-gray-400` fails and is exempt from nothing.

*Guards:* Do not flag pairs you cannot resolve statically. Do not flag decorative text, logotypes, or disabled controls, which WCAG exempts. Report the computed ratio and both resolved colors so the finding is verifiable rather than assertable.

*Effect:* D3 and D7. Each distinct failing pair is one finding, deduplicated by color pair rather than by occurrence.

---

**`A-UNLABELED-CONTROL`: Icon-only control with no accessible name**

*Detection:* Buttons and links whose only children are an icon component, an SVG, or an image, with no `aria-label`, `aria-labelledby`, `title`, or visually-hidden text child.

*Guards:* Check for a visually-hidden utility (`sr-only`, `visually-hidden`, `clip-path` pattern) providing the name. Check whether the icon component itself renders a `<title>` element. Component library icon buttons often take a `label` prop that resolves correctly.

*Effect:* D7.

---

**`A-PLACEHOLDER-LABEL`: Placeholder used instead of a label**

*Detection:* `input`, `textarea`, or `select` with a `placeholder` and no associated `<label for>`, no wrapping label, no `aria-label`, and no `aria-labelledby`.

*Guards:* Search inputs with an adjacent icon and an `aria-label` are fine. Check the whole form component, since labels are frequently rendered by a shared field wrapper.

*Effect:* D7. Explain the reason: the label disappears the moment the user starts typing, so anyone who is interrupted loses the field's meaning, and screen readers treat placeholder as a hint rather than a name.

---

**`A-HEADING-SKIP`: Heading hierarchy broken**

*Detection:* Per rendered page or route, extract heading levels in document order. Flag skips (h2 to h4), multiple h1 elements, and pages with no h1.

*Guards:* Heading level is often a prop on a shared component. Resolve the default before flagging. Components rendered in multiple contexts may legitimately vary. Confidence is medium when the level is dynamic.

*Effect:* D7.

---

**`A-MISSING-ALT`: Images without alt attributes**

*Detection:* `img`, `Image`, and equivalent framework components lacking an `alt` prop entirely. Distinguish from `alt=""`, which is **correct** for decorative images and must not be flagged.

*Guards:* Do not flag `alt=""` on decorative images. Do not flag background images in CSS. Do flag `alt` values that are filenames, `"image"`, `"photo"`, or the same string repeated across many images, which is worse than empty because it adds noise to a screen reader.

*Effect:* D7.

---

**`A-COLOR-ONLY`: Meaning carried by color alone**

*Detection:* Status indicators, validation messages, chart series, and diff views where the only differentiator between states is a color class, with no icon, no text label, no pattern, and no shape difference.

*Guards:* Requires reading the component to confirm no secondary cue exists. Confidence is medium unless the component is simple enough to be certain.

*Effect:* D3 and D7. Roughly 8% of men have some form of color vision deficiency, so this is not an edge case.

---

### 7.6 Positive signals

The scanner must be able to award points, or every repository trends toward zero and the score carries no information. These are the specific traces that a decision was made. Each is worth points in the named dimension.

| ID | Signal | Detection | Dimension |
|----|--------|-----------|-----------|
| `P-TOKENS` | Semantic token layer with role-named values (`--color-action-primary`, not `--color-blue-500`) consumed by components | Token source exists, components reference it, names encode function | D1, up to 12 |
| `P-SCALE` | Defined spacing or type scale with named steps used consistently | Named steps in config or `:root`, consistent usage | D1, D2, up to 6 |
| `P-TYPE-PAIR` | Two or more typefaces with distinct roles, loaded properly with `font-display` handling | Font loading plus role separation in usage | D2, up to 8 |
| `P-FOCUS-VISIBLE` | Deliberate `focus-visible` treatment distinct from hover | `focus-visible` rules with a visible indicator | D7, up to 6 |
| `P-EMPTY-STATE` | Empty states with an action, not just "No results" | Zero-length branch rendering guidance or a CTA | D6, up to 6 |
| `P-ERROR-STATE` | Error states that describe what failed and what to do | Error branch with actionable copy, not a raw message | D6, up to 5 |
| `P-LOADING-SKELETON` | Skeleton or progressive loading rather than a blocking spinner | Skeleton components or `Suspense` with real fallbacks | D6, up to 4 |
| `P-REDUCED-MOTION` | Motion preference respected | `prefers-reduced-motion` or `useReducedMotion` | D5, D7, up to 4 |
| `P-MOTION-INTENT` | Motion varying by role, with stagger, and durations in the 150–300ms band for micro-interactions | Multiple distinct animation definitions tied to element roles | D5, up to 6 |
| `P-REAL-CONTENT` | Product screenshots, real og images, custom illustration, non-placeholder assets | Image assets beyond favicon and framework defaults, referenced in routes | D4, up to 4 |
| `P-SPECIFIC-COPY` | Copy that names the product's actual domain and cannot be transplanted | Passes the substitution test | D2, D4, up to 4 |
| `P-CONTRAST-VERIFIED` | Evidence contrast was checked: a contrast utility, a token comment recording ratios, or an a11y test | Test files, comments, or CI a11y checks | D3, D7, up to 4 |
| `P-DARK-MODE-DESIGNED` | Dark mode with separately chosen tonal values rather than inverted or auto-derived | Distinct token values per theme, not filter inversion | D3, up to 4 |
| `P-A11Y-CI` | Accessibility checks in CI (`axe`, `pa11y`, `eslint-plugin-jsx-a11y` with real config, Lighthouse CI with a11y budgets) | CI config plus the dependency | D7, up to 5 |

Positive signals are how a repository climbs out of the bottom bands. A user who fixes findings should see the score move, and it will only move if there is something to earn.

---

## PART 8: WHY THESE RULES ARE THE RULES

This part exists so the scanner can explain itself. A finding that cites research is a finding a founder acts on. A finding that asserts taste is a finding a founder argues with. When you write output, reach into this section for the reason, and keep it to one sentence.

### 8.1 The judgment happens before anyone reads anything

Lindgaard and colleagues showed in 2006 that people form stable aesthetic judgments of a web page from a 50-millisecond exposure, and that those judgments correlate strongly with judgments made after unrestricted viewing. Tuch, Presslaber, Stöcklin, Opwis, and Bargas-Avila extended this in 2012 across 119 real website screenshots and found that both **visual complexity** and **prototypicality** move aesthetic ratings at 50ms, and that visual complexity still moves them at **17 milliseconds**. Visual complexity is processed at an earlier stage than prototypicality, consistent with Leder's information-processing model of aesthetic appreciation.

Two operational consequences for scoring.

**First:** the score should weight what is visible in the first screen far more heavily than what is buried three routes deep. When evaluating a repository, identify the landing route and the primary authenticated view, and weight findings in those files roughly double.

**Second, and this is the subtle one:** low complexity plus high prototypicality rates as most beautiful. Familiar and simple wins on first impression. This is exactly why generated interfaces feel acceptable at a glance and hollow after ten seconds. They are maximally prototypical, which is the local optimum for a 50ms judgment and a dead end for everything after it. Do not tell users to make their product weird. Tell them that prototypicality gets them past the first half-second and specificity is what gets them the rest, and that the tells in Part 7 are places where they are paying the cost of genericness without getting anything for it.

### 8.2 Design look is the dominant credibility input

Fogg and the Stanford Persuasive Technology Lab studied how 2,684 people evaluated the credibility of real websites across ten content categories. When asked what drove their judgment, **46.1% cited "design look"**, the single largest category, ahead of information design at 28.5%, and well ahead of anything about the organization behind the site. People do not run rigorous credibility checks. They look at the layout, the typography, the font size, and the color scheme, and they decide.

Use this to frame the entire product to the user. Their interface is not a coat of paint on the real product. For roughly half of the people who land on it, the interface **is** the evidence they use to decide whether the company is real. Broken contrast, emoji standing in for icons, and fabricated testimonials are not aesthetic complaints. They are credibility leaks, and that is the language to write findings in.

Handle the frequently-cited "75% judge credibility by design" figure carefully. It circulates widely attributed to Stanford but traces back through secondary sources with drift. The 46.1% figure is the one from the published study and is the one to cite. **Never inflate a statistic to make a finding land harder.** The product's entire value is that it is more rigorous than the model that wrote the code.

### 8.3 The aesthetic-usability effect, and why it cuts both ways

Users perceive attractive interfaces as more usable, and they tolerate more friction in an attractive interface before complaining. Kurosu and Kashimura established the correlation, and Tractinsky replicated it across cultures.

The consequence for grading: visual polish buys tolerance for functional problems, which means a generated interface with no error states can feel fine right up until something fails, and then feels much worse than an unpolished interface with good error handling. That is a specific and predictable failure curve, and D6 is weighted at 15 points because of it.

### 8.4 The laws worth encoding, with their actual numbers

Only use these where a number in the repository can be checked against them.

**Fitts's Law.** Time to acquire a target is a function of distance and target size. Operationally: minimum touch targets of 44×44pt (Apple HIG) or 48×48dp (Material), minimum 8px between adjacent targets, and hit areas extended beyond visual bounds where the visual element must be small. Detect: interactive elements with computed dimensions under threshold, icon buttons with `p-1` on a 16px icon, adjacent links with no spacing.

**Hick's Law.** Decision time grows with the logarithm of the number of choices. Operationally: primary navigation beyond seven items, bottom navigation beyond five, a screen with more than one primary call to action. Detect: count nav children, count elements carrying the primary button variant per route.

**Miller's Law.** Working memory holds roughly four to seven chunks. Operationally: chunk long forms, group related fields, break sequences into steps. Detect: forms with more than eight inputs and no fieldset, grouping, or step structure.

**Doherty Threshold.** System response under 400ms keeps a user in a productive loop. Below roughly 100ms an interaction feels instantaneous. Operationally: visual feedback within 100ms of any tap, a loading indicator for anything exceeding 400ms, skeletons rather than spinners past one second. Detect: transitions with `duration-0` or absent on interactive elements, fetches with no pending state.

**Jakob's Law.** People spend most of their time on other products, so they expect yours to work like those. Operationally: standard gestures behave as standard, back navigation works, links are links. This is the law that argues *for* prototypicality, and it is why the answer is never "be different everywhere." Be conventional in mechanics, specific in identity.

**Peak-End Rule.** People remember the most intense moment and the ending, not the average. Operationally: the moments worth designing hardest are the first successful action, the error, and the completion. Detect indirectly through D6 coverage.

**Von Restorff / Isolation Effect.** The item that differs is the item remembered. Operationally: uniform styling across an entire interface means nothing is emphasized, which is what `T-UNIFORM-GEOMETRY` and `T-UNIFORM-RHYTHM` are really measuring. When every card has the same weight, the interface tells the user nothing about what matters.

**Tesler's Law.** Complexity is conserved. It moves between the interface and the user, but it does not vanish. Operationally: an interface that looks simple because it omits states has pushed that complexity onto the user, who now has to guess what happened when a request fails.

### 8.5 Engagement and retention, and the line the product does not cross

The master doc's positioning is that users should end up with products people trust. Trust and engagement mechanics overlap but they are not the same thing, and the ones worth recommending are the ones that stay honest.

**Recommend these.**

*Reduce time-to-first-value.* The strongest retention lever available and almost entirely a design problem. Detect: onboarding flows requiring account creation before any value is visible, signup forms with more than four fields, empty dashboards with no seeded example or guided first action.

*Progressive disclosure.* Show what is needed now, reveal depth on demand. Detect: settings pages with thirty controls at one level, forms exposing every optional field.

*Zeigarnik effect, used honestly.* Incomplete tasks stay in memory. A visible progress indicator on a genuinely incomplete setup increases completion. It becomes manipulative when the task is invented to create the pull.

*Endowed progress.* A progress bar that starts partially complete increases completion rates, and it is honest when the completed steps are real.

*Recognition over recall.* Show options rather than requiring memory. Detect: command palettes with no discoverable entry point, keyboard shortcuts with no reference.

*Immediate, specific feedback.* Every action confirms in the user's own vocabulary. The button that says "Publish" produces a toast that says "Published." Detect: mutations with no success feedback, generic "Success!" toasts.

**Never recommend these, and flag them when found.**

Countdown timers on offers that reset on reload. Fake scarcity ("3 people are viewing this"). Confirmshaming, where the decline option is worded to make the user feel bad. Roach motels, where signup takes one click and cancellation takes six. Disguised ads. Pre-checked consent. Interstitials that interrupt a task to demand an email. Notification patterns designed to create compulsive checking.

These raise short-term metrics and destroy the thing the product is supposed to be selling, which is a founder's ability to put their work in front of people without embarrassment. If the scanner finds them, they are **findings, not features**, and they belong in the report under a heading that names them as trust damage.

### 8.6 The thresholds table

Every number the scanner is allowed to assert, with its source. Do not invent numbers outside this table. If a check needs a threshold that is not here, add it here first with a source.

| Property | Threshold | Source |
|----------|-----------|--------|
| Text contrast, normal | 4.5:1 | WCAG 2.2 SC 1.4.3 (AA) |
| Text contrast, large (24px, or 18.66px bold) | 3:1 | WCAG 2.2 SC 1.4.3 (AA) |
| Text contrast, AAA normal | 7:1 | WCAG 2.2 SC 1.4.6 |
| Non-text and UI component contrast | 3:1 | WCAG 2.2 SC 1.4.11 |
| Focus indicator contrast against adjacent | 3:1 | WCAG 2.2 SC 1.4.11 |
| Target size minimum | 24×24 CSS px (WCAG AA), 44×44pt (Apple), 48×48dp (Material) | WCAG 2.2 SC 2.5.8, Apple HIG, Material |
| Spacing between adjacent targets | 8px minimum | Apple HIG, Material |
| Text resize without loss of function | 200% | WCAG 2.2 SC 1.4.4 |
| Body text on mobile | 16px minimum (below this iOS auto-zooms on focus) | Platform behavior |
| Body line height | 1.5 to 1.75 | WCAG 1.4.12, typographic convention |
| Line length | 45–75 characters desktop, 35–60 mobile | Typographic convention |
| Micro-interaction duration | 150–300ms | Material motion |
| Complex transition duration | up to 400ms | Material motion |
| Exit animation relative to enter | 60–70% of enter duration | Material motion |
| List stagger interval | 30–50ms per item | Material motion |
| Feedback after input | within 100ms | Apple HIG, Doherty |
| Loading indicator required after | 400ms; skeleton past 1s | Doherty, Material |
| Cumulative Layout Shift | below 0.1 | Core Web Vitals |
| Largest Contentful Paint | below 2.5s | Core Web Vitals |
| Interaction to Next Paint | below 200ms | Core Web Vitals |
| Frame budget | 16ms for 60fps | Platform |
| List virtualization threshold | 50+ items | Convention |
| Primary CTAs per screen | 1 | Apple HIG |
| Bottom navigation items | 5 maximum | Material, Apple HIG |
| Color vision deficiency prevalence | ~8% of men, ~0.5% of women | Clinical |

---

## PART 9: WHAT NOT TO PENALIZE

The false-positive list. Violating anything here makes the product look like it does not know what it is talking about, and one bad finding costs more trust than five good findings earn.

**Never a penalty:**

1. **The presence of AI agent configuration.** `CLAUDE.md`, `.cursorrules`, `AGENTS.md`, `copilot-instructions.md`. Skilled engineers use agents. This product grades output, not tooling.

2. **Any specific color.** Purple is not a tell. Blue is not a tell. Only the *absence of a decision* about color is a tell. Twitch, Stripe, Linear, and Figma would all be penalized by a naive hue check, which would immediately expose the scanner as unserious.

3. **Tailwind itself.** Or shadcn, or Material UI, or Bootstrap, or any framework. The framework is not the problem. Shipping the framework's defaults unmodified is the problem, and those are different findings.

4. **Inter, or any system font stack, on its own.** Inter is a well-made typeface. The tell is Inter plus no scale plus no role separation.

5. **`focus:outline-none` paired with `focus-visible:ring-*`.** This is correct practice. Flagging it is the most common accessibility-tooling false positive and it will be noticed.

6. **Consistency in a defined system.** A design system that deliberately uses one radius across all surfaces is a system. Check for a scale definition before firing uniformity signals.

7. **Test fixtures, mocks, stories, and seed data.** Fake names belong there. Never scan them for placeholder social proof.

8. **Documentation, README content, and changelogs.** Different register, different rules. Emoji in a README is fine.

9. **Minimalism.** Restraint is a choice and often the right one. Distinguish "few elements, each considered" from "few elements, none considered" by checking whether the elements that exist show evidence of decisions.

10. **Desktop-only scope where declared.** Internal tools and developer software are sometimes legitimately desktop-only. Check the README before applying the responsive ceiling at full weight.

11. **Server-rendered or template-based stacks.** Rails with ERB, Django with templates, Laravel with Blade, PHP, Go templates. These are not worse. Adapt the detection method rather than penalizing the stack. If you cannot parse the styling layer confidently, abstain and say so.

12. **Older repositories.** Do not penalize a 2019 codebase for lacking `dvh` units or container queries.

13. **Prototypes and learning projects.** Read the README. If a project self-describes as a tutorial, a course exercise, or a weekend experiment, report findings but frame the score as calibrated for shipped products and say so explicitly.

14. **Genuine accessibility exemptions.** `alt=""` on decorative images is correct. Disabled controls are exempt from contrast requirements. Logotypes are exempt.

**Two things the scanner must never do:**

**Never cite a file or line you did not read.** If you are inferring a pattern rather than pointing at code, either read the file or downgrade the finding to a general observation without a citation.

**Never claim to have evaluated something you could not evaluate.** Rendered appearance, actual contrast in a runtime theme, real performance numbers, and anything requiring a browser are outside v1 scope. Say what was checked, statically, and stop there. The credibility of every finding depends on none of them being invented.

---

## PART 10: OUTPUT

### 10.1 The finding format

Per the master doc's contract, three parts: problem, evidence, fix prompt. Expanded here for UI/UX findings.

```
### [Severity] Short title naming the problem

**What we found:** One or two sentences in plain language. No jargon
unless it is defined in the same breath. Describe the effect on the
person using the product, not the abstract violation.

**Where:** path/to/file.tsx:47, path/to/other.tsx:12
(up to 3 locations, then "and N more")

**Why it matters:** One sentence, grounded in Part 8. Cite the
mechanism or the standard, not an opinion.

**Score impact:** Costs N points in [dimension]. [If a ceiling applies:
"Caps your maximum score at N until fixed."]

**Fix this:**
> [Copy-pasteable prompt for their coding agent. Written as an
> instruction to an agent, specific to their files, with the
> constraint that makes the fix correct rather than superficial.]
```

### 10.2 How to write the fix prompts

The fix prompt is the product. The score gets attention, the prompt gets the money. Four rules.

**Name their actual files.** "Update the Button component in `src/components/ui/button.tsx`" beats "add focus states to your buttons."

**Include the constraint that prevents a superficial fix.** An agent told to "add focus states" will add `focus:ring-2` and stop. An agent told to "add a focus-visible ring that meets 3:1 contrast against both the button background and the surrounding surface, and verify it against the dark theme tokens as well" produces a fix that holds.

**Ask for the system, not the instance, where the system is the problem.** For `T-NO-TOKENS`, the prompt should establish the token layer and migrate the literals, not patch one component.

**Never write a prompt that would introduce a different tell.** Do not tell someone to add a gradient. Do not tell them to pick a specific color. For anything requiring taste, the prompt should ask the agent to derive the choice from the product's actual subject matter and constraints, and to state the reasoning before writing code.

**Worked example, for `T-NO-STATES`:**

> In `src/app/dashboard/page.tsx` and `src/components/ProjectList.tsx`, the collection renders assume data exists. Add three branches to each: an empty state that explains what the user would see here and gives them the action that would create the first item, a loading state using a skeleton that matches the shape of the loaded content rather than a centered spinner, and an error state that says what failed and what the user can do about it. Write the copy in the same voice as the rest of the interface, in sentence case, with no apology and no exclamation marks. Do not use a generic "Something went wrong" string. Name the operation that failed.

**Worked example, for `T-DEFAULT-PALETTE`:**

> The Tailwind config at `tailwind.config.ts` has no color extension, so every color in the app is a framework default. Before writing any code, propose a palette of five to seven values derived from what this product actually is and who uses it, name each one by its function rather than its hue (`--color-surface`, `--color-action`, `--color-critical`), and state why each value was chosen. Then extend the theme with those tokens and migrate the existing default-scale utility classes to them. Verify every text-on-surface pair against 4.5:1 and report the computed ratios. Do not reach for an indigo-to-violet gradient.

### 10.3 Report ordering

1. **Score, percentile, and band.** One line each. No preamble.
2. **The three findings with the largest score impact.** These are what the user acts on. Full format.
3. **Ceilings in effect,** if any, stated as "your maximum possible score is currently N because X."
4. **Trust and credibility findings.** Fabricated social proof and dark patterns go here, separated from everything else, because they are a different kind of problem.
5. **Accessibility findings,** grouped, with WCAG references.
6. **Remaining findings,** by score impact.
7. **What the repository does well.** Every positive signal that fired. This section is not padding. It tells the user which decisions to protect while fixing the rest, and it is the section that makes the report readable rather than punishing.
8. **What we could not check.** Named explicitly. Rendered appearance, runtime performance, real user behavior, anything outside static analysis.

### 10.4 Voice

The report should read like a senior design engineer did a code review, because that is what it is claiming to be.

**Do:** state the problem directly. Give the mechanical reason. Assume the reader is competent and busy. Use their file names and their component names. Be specific about severity, including when something is minor.

**Do not:** apologize. Hedge with "might" and "could potentially" on things that are definitely true. Praise before criticizing as a softening device. Use "unfortunately." Explain what a button is. Write more than four sentences before the fix prompt. Use the words this product is about avoiding: seamless, robust, delve, leverage, game-changer, elevate, unlock, supercharge. A report full of the same vocabulary as the generated copy it is criticizing has no standing.

**Calibration for the whole report:** if a founder reads it and thinks "a person who knows what they are doing looked at my code," it worked. If they think "an AI ran a linter," it failed, and the score being accurate does not save it.

---

## PART 11: SELF-CHECK BEFORE RETURNING A SCORE

Run these before emitting. If any fails, fix the analysis rather than the output.

1. **Does every finding cite a file I actually read?** If not, remove the citation or remove the finding.
2. **Did I apply the tell-density multiplier?** The single most common way this rubric fails is by computing the raw score and stopping.
3. **Did I check for ceilings?** Take the lowest, not the sum.
4. **Would this score have been above 80 under a subtractive rubric?** If yes, re-examine whether the earned points are actually earned. Points come from positive evidence, not from absence of problems.
5. **Did I penalize anything on the Part 9 list?** Remove it.
6. **Did I penalize a color for being a color?** Remove it.
7. **Did I award D6 points without confirming empty, loading, or error branches exist in source?** If yes, revoke them. This dimension is the one most easily assumed.
8. **Is every number I asserted in the Part 8.6 table?** If not, either source it or drop it.
9. **Does every fix prompt name a real file in this repository?** Generic prompts are worthless.
10. **Does any fix prompt introduce a tell?** Rewrite it.
11. **Did I say what I could not check?** If the report implies full coverage it did not have, add the limitation.
12. **Would a designer who reads this agree with the three highest-severity findings?** If any of the three are arguable taste rather than mechanical fact, demote it and promote something defensible. The top of the report has to be unarguable.

---

## APPENDIX A: DETECTION COVERAGE BY STACK

Detection methods differ. Where a stack is not covered, abstain on the affected dimensions and normalize the score across the remainder rather than guessing.

| Stack | Tokens | Type | Contrast | States | A11y |
|-------|--------|------|----------|--------|------|
| React + Tailwind | Config parse | `next/font`, `@font-face` | Class pair resolution | JSX branch analysis | JSX attribute scan |
| React + CSS Modules | `:root` and module scan | `@font-face` | Rule-level pair resolution | JSX branch analysis | JSX attribute scan |
| React + styled-components / Emotion | Theme object | Theme typography key | Template literal parse, partial | JSX branch analysis | JSX attribute scan |
| Vue SFC | `<style>` and config | Same as React | Style block parse | Template directive analysis | Template attribute scan |
| Svelte / SvelteKit | `app.css`, config | Same | Style block parse | `{#if}` / `{#await}` analysis | Template attribute scan |
| Next.js App Router | Same as React | Same | Same | Plus `loading.tsx`, `error.tsx`, `not-found.tsx` | Same |
| Astro | Config and global CSS | Same | Same | Component-level | Same |
| Rails / Django / Laravel templates | Stylesheet scan | `@font-face` | Rule-level, partial | Template conditional analysis | Template attribute scan |
| SwiftUI / Jetpack Compose | Theme or asset catalog | Font extension | Asset catalog, partial | View state enum analysis | Accessibility modifier scan |
| Plain HTML + CSS | `:root` scan | `@font-face` | Rule-level | Usually N/A | Attribute scan |

For any stack where contrast resolution is marked partial, findings are **medium confidence at most** and must be phrased as "these pairs appear to fall below threshold" rather than asserted.

---

## APPENDIX B: CALIBRATION SET

Build and maintain a fixed set of repositories with hand-assigned target scores. Run the scanner against it after every change to the rubric or the prompt. If a change moves a calibration score by more than 8 points, that change needs justification.

Suggested composition, ten to fifteen repositories:

- Two untouched outputs from a code-generation tool, single prompt, no editing. **Target 10–25.**
- Two generated apps with a few hours of human editing. **Target 30–45.**
- Two competent internal tools built by engineers with no designer. **Target 45–60.**
- Two open-source projects with a real design system. **Target 70–85.**
- Two design-led products with distinctive identity. **Target 85–95.**
- One deliberately adversarial case: a well-designed product that happens to use purple, Inter, and Tailwind. **Target above 75.** If the scanner penalizes this repository, the hue guard is broken and must be fixed before shipping.
- One accessibility-excellent but visually plain repository. **Target 60–70.** Tests that D7 alone cannot carry a score.
- One visually striking repository with no accessibility work. **Target below 60.** Tests that the focus ceiling actually binds.

The last three are the important ones. They are the cases where a naive rubric produces obviously wrong answers, and they are the fastest way to catch a regression.

---

## APPENDIX C: V2 BACKLOG

Out of scope for v1, recorded so scope stays honest.

- **Rendered analysis.** Headless browser against a domain allowlist, screenshot capture, computed-style contrast, real layout measurement. Removes most of the "partial" and "medium confidence" caveats in this document and roughly doubles what can be detected. Blocked on the sandboxing and allowlist work described in the master doc.
- **Visual distinctiveness scoring.** Perceptual hashing of rendered landing pages against a corpus, producing a real similarity percentile instead of the proxy tell-density multiplier.
- **Motion evaluation.** Frame capture of transitions, measured durations and easing curves against the Part 8.6 thresholds.
- **Real percentile distribution.** Replace the estimated Section 6.6 table with the actual distribution once submission volume supports it.
- **Longitudinal scoring.** Re-scan on each push, show the score moving. This is the feature that converts a one-time scan into a subscription.

---

## PART 12: CALIBRATION AGAINST A LABELED SET

**This part supersedes Sections 6.3, 6.5, and Appendix B. Apply it over the earlier text.**

Twenty real sites were hand-labeled by a human evaluator into "does not look vibe coded" and "obviously vibe coded." Running the Part 6 and Part 7 rubric against them produced four disagreements. Every disagreement was the rubric being wrong, and each one exposes a structural gap. This part is the correction.

### 12.1 The single most important finding: the rubric was measuring the wrong thing

The human labels do not track "was this built with AI." They track two other things, and separating them is what makes the scanner accurate.

There are three independent axes in play, and the earlier parts of this document conflated all three.

**Axis 1: Provenance.** Was a language model involved in producing this code? **Undetectable, and irrelevant.** Skilled teams ship agent-written code. Users do not care and cannot verify. Any rule that tries to detect provenance produces false positives on good work and false negatives on bad work.

**Axis 2: Design intentionality.** Did anyone make decisions, or did every value fall out of a default? This is what Parts 6 and 7 measure, and they measure it correctly.

**Axis 3: Operational evidence.** Is there a real operation behind this, and does the interface show it? Physical address, real photographs of real work, actual pricing documents, named staff, specific durations, a phone number that a person answers.

The labeled set makes the gap obvious. Both lists contain an auto detailing business in the same metropolitan area.

**Accutint Bellevue** (labeled human) is a WordPress site. On the raw Part 7 rubric it would score unremarkably. What it has: a street address in Bellevue, a phone number in the header and the footer and a click-to-call button, eight photographs of their own staff working on identifiable cars including a Lamborghini and a G-Wagon, two linked PDF price sheets with a revision date, a vehicle size chart, a service duration table with real ranges (basic detail 1.5 to 8 hours, paint correction 1 to 2+ days), a named managing member, a Seahawks promotion partnership, and an agency credit in the footer. None of that is design. All of it is evidence that a business exists.

**AD Diamond Finish** (labeled AI) serves an HTML document containing metadata and nothing else. The body renders client-side. Its social preview image is hosted at `vibe.filesafe.space`, which is a build-platform asset CDN.

The design-intentionality axis barely separates these two. The operational-evidence axis separates them completely. **The rubric needs Axis 3 as a first-class dimension, and it was missing.**

Say this to users plainly, because it reframes the whole product in their favor: the scanner is not accusing them of using AI. It is telling them which parts of their interface fail to demonstrate that a real operation stands behind it. That is a problem they want solved and can act on.

### 12.2 Revised dimensions (supersedes 6.3)

Eight dimensions, still summing to 100.

| # | Dimension | Points | Change |
|---|-----------|--------|--------|
| D1 | Design system foundation | 18 | was 20 |
| D2 | Typography | 10 | was 12 |
| D3 | Color and contrast | 10 | was 12 |
| D4 | Layout and spacing intent | 10 | was 12 |
| D5 | Interaction and motion | 12 | was 14 |
| D6 | State coverage | 13 | was 15 |
| D7 | Accessibility | 12 | was 15 |
| **D8** | **Operational evidence** | **15** | **new** |

D8 is worth as much as state coverage because the labeled set says it carries as much signal. It is also the dimension a founder can improve fastest, which makes the report actionable rather than demoralizing.

**D8 scoring, earned from zero:**

| Evidence | Points | Static detection |
|----------|--------|------------------|
| Physical address in markup, ideally with structured data | 2 | `PostalAddress` schema, address in footer, map embed or link |
| Direct phone or contact method with a `tel:` or `mailto:` link | 1 | `href="tel:"`, `href="mailto:"` |
| Own photography: images of the team, the work, the product, or the premises | 3 | Image count and paths outside `/placeholder`, `/stock`, and CDN stock hosts, with descriptive filenames and non-generic alt text |
| Specific verifiable numbers: durations, dimensions, capacities, ranges | 2 | Tables or lists with units, ranges, and non-round values |
| Real documents: price sheets, spec sheets, menus, PDFs with revision dates | 2 | Linked PDFs or documents in the asset tree |
| Named individuals with real roles, not stock testimonials | 2 | Named person tied to a title and an image not from an avatar service |
| Structured business data | 1 | `LocalBusiness`, `Organization`, or `Product` JSON-LD with populated fields |
| Operational depth beyond the landing page: a real blog, changelog, docs, or case studies with dated entries | 2 | Route or content directory with more than three dated entries |

Every one of those is detectable in a repository. None require rendering.

**D8 guards.** Pre-launch products legitimately have no customers, no photographs, and no case studies. Do not punish honesty. If a repository is clearly pre-launch (no pricing, no testimonials at all, a waitlist form rather than a signup), score D8 out of the subset that applies and normalize. Punish **fabricated** operational evidence far harder than **absent** operational evidence. A site with no testimonials is honest. A site with three invented ones is lying, and that is the finding.

### 12.3 Second-generation tells (new, and the largest gap in Part 7)

**Part 7's tell bank is tuned to the 2024 and 2025 generation of AI output: indigo-to-violet gradients, Inter with no scale, emoji icons, three-card grids. Anyone using a current model with a decent prompt no longer produces that.** A rubric that only knows generation-one tells will score generation-two output highly, which is a worse failure than the original over-scoring problem because it is invisible.

The labeled set contains a clean example. **LeadFlux** was labeled AI-built by the human evaluator, and its copy is genuinely excellent: first-person, specific, names actual statutes in Utah and Maine, discloses its own vendor margin, includes an FAQ entry that invites the reader to call the number and hang up if it sounds bad. On `T-VAGUE-COPY` it scores perfectly. Part 7 would have rated it well.

What gives it away is the visual and structural register, which is the current default:

---

**`T2-EDITORIAL-DEFAULT`: The warm-cream editorial look**

Near-white warm background (roughly `#FAF9F7` to `#F4F1EA`), a high-contrast serif display face, a terracotta or warm-clay accent (often near `#D97757`), generous leading, hairline rules.

*Detection:* Background token or `theme-color` meta in the warm off-white band, combined with a serif display face and an accent in the clay or terracotta range. All three together.

*Guards:* This is a legitimate and often beautiful direction. It fires as a tell only when combined with the absence of any other identity anchor: no logo mark, no photography, no custom illustration, no second structural idea. The look is the entire identity.

*Note for the report:* say the palette appears in a large share of current AI output, so it reads as a default rather than a choice to anyone who looks at a lot of these. Do not say it is ugly. It is not.

---

**`T2-DOCUMENT-COSPLAY`: Faux-bureaucratic detail as texture**

Invented form numbers, revision codes, and filing metadata used decoratively to signal craft. LeadFlux's footer carries "Form LF-01 · Rev. Aug 2026." Related: fake terminal prompts, invented version stamps, `[REDACTED]` styling, monospace timestamps on content that is not a log.

*Detection:* Regex for form and revision patterns (`Form [A-Z]{1,4}-\d{2}`, `Rev\.? [A-Z][a-z]{2} \d{4}`, `Doc \d{3}`, `v\d\.\d\.\d` in a footer) in user-facing copy with no corresponding real document. Monospace font applied to non-technical content.

*Guards:* Genuine version numbers on software, real document control systems, and actual changelogs are fine. The tell is a reference number that refers to nothing.

*Why it reads as generated:* it is a texture that mimics the appearance of institutional history without the history. It has become a strong current-generation signature precisely because it is a cheap way to make a page feel considered.

---

**`T2-MANUFACTURED-VOICE`: Performed authenticity**

First-person founder voice, deliberate sentence fragments, self-deprecation, and a confession of a flaw, all deployed as a persuasion pattern rather than because someone wrote it.

*Detection:* Genuinely difficult, and confidence must be capped at **medium**. Look for structural markers appearing together: first-person singular throughout a commercial page, three or more one-sentence paragraphs used for emphasis, an explicit "here is what I am not good at" section, and an FAQ that answers an objection the reader had not raised. The combination is the signal, never any single element.

*Guards:* Real solo founders write like this, and it works. **Never report this as a standalone finding.** It contributes to tell density only when at least two other generation-two tells fire alongside it. If in doubt, leave it out. A false positive here insults the one thing a founder actually wrote themselves.

---

**`T2-EMPTY-SHELL`: Client-rendered document with no server content**

The HTML served contains metadata, a root element, and script tags. All content renders client-side.

*Detection:* Compare the byte count and text-node count of the served HTML body against the rendered route's expected content. In a repository: a Vite or CRA SPA with no prerender step, no SSG, no SSR, serving a marketing site.

*Guards:* Authenticated application shells are correctly client-rendered. This fires on **public marketing and content routes only**. Do not fire on dashboards behind a login.

*Effect:* Tell. Also a real SEO and social-preview problem, so lead with the business consequence rather than the architectural one.

---

**`T2-BUILDER-FINGERPRINT`: Build-platform artifacts left in production**

*Detection:* Asset hosts and paths belonging to generation platforms (`vibe.filesafe.space`, `lovable.app` asset paths, `bolt.new`, v0 blob storage, `*.builder.io` defaults), preview deployment domains serving as production (`*.vercel.app`, `*.netlify.app`, `*.pages.dev` as the canonical URL when a custom domain exists elsewhere), default framework og-images, and untouched generated favicons.

*Guards:* A `.vercel.app` domain for a genuine side project or a beta is fine and should be reported as low severity. The finding is sharper when a business has a custom domain but the canonical URL or the assets still point at the platform.

*Effect:* Tell. High confidence, since these are literal strings.

---

**`T2-DEAD-SCAFFOLD`: Unfinished scaffolding shipped**

Links, sections, and controls that exist visually but do nothing.

*Detection:* `href="#"` or `href=""` on navigation and social links, `onClick` handlers that are empty or only log, sections referencing anchors that do not exist on the page, form submits with no handler, and copyright years more than one year behind the most recent commit date.

*Guards:* `href="#"` on a genuine skip-link target or a JS-driven disclosure is fine. Check for a handler before firing.

*Effect:* Tell. High confidence and easy to fix, which makes it a good finding to place early in a report.

---

**`T2-INTERNAL-CONTRADICTION`: Claims on the same page that cannot both be true**

The clearest signal in the entire labeled set, and it was completely absent from Part 7.

Killa Marketing states "100+ happy clients" in its statistics band and "Join thousands of businesses who trust Killa Marketing" in its closing call to action. Both were generated to fill a slot. Neither was checked against the other.

*Detection:* Extract every quantitative claim from user-facing copy: user counts, client counts, uptime percentages, ratings, review counts, delivery times, years in business. Compare claims of the same kind across the page for order-of-magnitude conflicts. Also compare against each other for logical consistency, for example a rating of 4.9 stated alongside a review count of zero, or "48h average delivery" alongside "typically 1 to 2 weeks."

*Guards:* Different metrics can legitimately differ (customers versus users versus signups). Fire only on same-kind conflicts or on order-of-magnitude gaps.

*Effect:* Tell, **high severity**, and report it near the top. A visitor who notices this stops believing everything else on the page. Killa Marketing also carries a 2024 copyright on a 2026 site, dead `href="#"` social links, six emoji icons, "seamless" twice, and a testimonial from "Emily Chen, Director, Creative Agency" with an initials avatar. It is the reference specimen for the bottom band.

---

### 12.4 The category-template problem (why Trenchies breaks the rubric)

**Trenchies** was labeled AI-built. On the Part 7 rubric it scores **high**, and legitimately so: real product photography, a real Supplement Facts panel with actual milligram doses, verified customer reviews with photographs, embedded TikTok content from a real account, a comparison table against coffee and energy drinks, and an FAQ that directly addresses a negative review about aftertaste. That is a great deal of operational evidence and specific copy.

The rubric and the human are measuring different kinds of genericness.

- **AI genericness:** the output looks like every other model output. Part 7 detects this.
- **Category genericness:** the output looks like every other site in its vertical. Part 7 does not detect this at all.

Trenchies is a competent execution of the standard DTC supplement template: scrolling badge marquee, ingredient cards with dosages, a competitor comparison table with checks and crosses, UGC grid, subscription pricing with a "Most Popular" flag. Every direct-to-consumer supplement brand looks like this because the template converts. It reads as machine-made to a human evaluator not because a machine made it but because **the same pattern has been seen a thousand times**, which is exactly the perceptual mechanism Section 8.1 describes. Prototypicality reads as familiar, and past a threshold familiar reads as anonymous.

**Do not fold this into the main score.** Bending the primary score to rank Trenchies low would require penalizing real photography and specific copy, which would break every other case in the set.

**Report it as a separate axis instead.** Alongside the score, report a **Category Distinctiveness** rating on a three-point scale, evaluated against the conventions of the product's own vertical rather than against AI defaults.

| Rating | Meaning |
|--------|---------|
| Template | Follows the vertical's standard pattern section for section |
| Adapted | Standard pattern with at least two structural departures |
| Distinct | Structure derives from the product rather than the category |

Detect by identifying the vertical (from copy, schema type, and dependencies) and comparing the section sequence against the known convention for that vertical. Maintain a small library of vertical conventions: DTC supplement, B2B SaaS, local service business, agency, marketplace, developer tool, e-commerce apparel.

Trenchies scores well on the primary score and **Template** on distinctiveness. That pair of outputs is the honest and useful answer, and it tells the founder something they can act on: the execution is strong, the structure is borrowed.

### 12.5 The Vercel disagreement, and why I did not fit to it

`vercel.com` appears in the vibe-coded list. **I recommend excluding it from the calibration set rather than tuning the rubric toward it,** and the reason matters more than the exclusion.

Vercel commissioned its own typeface (Geist), maintains a published design system, and originated much of the near-black-with-geometric-accents visual language now in question. Any rule that scores Vercel low would necessarily fire on deliberate typography commissioning and a documented design system, which are the two strongest positive signals in the entire rubric. It would invert `P-TYPE-PAIR` and `P-TOKENS`. That breaks everything else.

There is a real perception behind the label, and it is worth naming precisely: **Vercel's aesthetic has been copied so widely that the original now pattern-matches to the copies.** The originator pays a reputational cost for having been imitated. That is a true observation about how the aesthetic landscape works in 2026, and it is genuinely relevant to the product's advice ("the look you are reaching for has been absorbed into the default"). It is not something a static analyzer can detect, because the evidence in the repository is identical for the originator and the imitator.

**Encode it as advice, not as detection.** In the fix prompts for `T2-EDITORIAL-DEFAULT` and similar generation-two tells, note that the direction may have been distinctive when the reference was chosen and has since become common. Do not attempt to score it.

Worth being direct about this: if you tune the rubric until it agrees with every label including this one, you will get a rubric that agrees with your intuitions today and produces indefensible results on submissions you have not seen. The four disagreements are where the value is, and three of them made the rubric better. This one should stay a disagreement.

### 12.6 Revised tell-density multiplier (supersedes 6.5)

Generation-two tells are weighted more heavily than generation-one tells, because they indicate a more capable build that still did not make an identity decision, and because they are what current submissions will actually contain.

Compute weighted tell count: each generation-one tell (`T-*`) counts 1.0. Each generation-two tell (`T2-*`) counts 1.5. `T2-INTERNAL-CONTRADICTION` counts 2.0.

| Weighted count | Multiplier |
|----------------|------------|
| 0–1 | 1.00 |
| 2–3 | 0.94 |
| 4–5.5 | 0.86 |
| 6–8 | 0.76 |
| 8.5–11 | 0.66 |
| 11.5+ | 0.56 |

### 12.7 Revised calibration set (supersedes Appendix B)

Use the labeled URLs directly. Targets are assigned from the rubric as revised in this part, which reproduces the human labels on sixteen of twenty with the two intentional disagreements noted.

**Should score high:**

| Site | Target | The signal that carries it |
|------|--------|---------------------------|
| notion.com | 85–95 | Semantic color system, custom type, real product imagery, deep state coverage |
| airbnb.com | 85–95 | Full design system, exhaustive state handling, accessibility investment |
| ycombinator.com | 70–85 | Restraint with a genuine identity, high information density, minimal decoration |
| reddit.com | 70–85 | Design system, extreme state coverage, dense real content |
| doordash.com | 75–88 | Design system, real photography, operational depth |
| shakeshack.com | 75–88 | Distinctive brand system predating and independent of web convention |
| express.com | 65–80 | Category-conventional but heavy real operational evidence |
| accutintbellevue.com | 55–70 | **The important one.** Modest design execution, exceptional D8. If this scores below 50, D8 is underweighted |
| marketbridge.com | 60–75 | Agency site with real case work |
| checkvibe.dev | 55–75 | Direct competitor. Score it and read the result as market intelligence |

**Should score low:**

| Site | Target | The signal that carries it |
|------|--------|---------------------------|
| killamarketing.com | 5–18 | **Reference specimen for the bottom.** Contradiction, emoji icons, generic testimonials, dead links, stale copyright |
| detailing.addiamondfinishllc.com | 10–25 | Empty shell, builder fingerprint, near-zero D8 |
| securevibe.org | 15–30 | Score it. It is a competitor operating under your product name |
| kulphis.com | 15–30 | |
| prometheus-website-beta.vercel.app | 15–30 | Preview domain as production |
| securevibe-peach.vercel.app | 15–30 | Your own early build. Keeping it in the set keeps you honest |
| leadflux.agency | 30–48 | **The hard case.** Excellent copy, generation-two visual defaults. Should land mid, not bottom. If it scores above 55 the generation-two tells are underweighted. If below 25, the copy scoring is broken |
| trenchies.co | 60–75 primary, **Template** on distinctiveness | **The other hard case.** Real evidence, borrowed structure. The two outputs disagree on purpose |
| vercel.com | Excluded | See 12.5 |

**Regression rule:** re-run all nineteen after any rubric change. Accutint, LeadFlux, and Trenchies are the three that catch regressions fastest, because each one breaks a different naive rule. If a change moves any target by more than 8 points, it needs a written justification.

### 12.8 What the labeled set says about weighting, in one paragraph

Across both lists, the property that separates them most cleanly is **information density backed by verifiable specifics**. Accutint publishes a duration table with real ranges. Trenchies publishes milligram doses. LeadFlux publishes its vendor's margin. Killa Marketing publishes "99.9% uptime guarantee" and "Lightning Fast," which are claims shaped like specifics that assert nothing. AD Diamond publishes an empty document. The generic sites are not distinguished by having bad taste. They are distinguished by **saying nothing checkable**. Every high-value finding in this rubric ultimately reduces to that: where does this interface make a claim a visitor could verify, and where does it merely occupy the space where such a claim would go?
