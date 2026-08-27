# SECUREVIBE: MASTER REFERENCE DOCUMENT

**Purpose:** This is the domain knowledge file for SecureVibe. Load it into context before writing or changing any scoring logic. It defines what the product detects, why each signal is valid, how to weight it, what to refuse to flag, and how to phrase output so it reads like a senior design engineer wrote it rather than a model grading another model's homework.

**Product thesis:** Security scanning is a solved, crowded category with well-funded incumbents. UI/UX judgment is not. SecureVibe's wedge is that it looks at a repository and tells the owner, with evidence, why their product reads as machine-built to anyone with taste. Security stays in the product as table stakes and as a credibility anchor. UI/UX carries the differentiation and the pricing power.

**Scope for v1:** Public GitHub repositories only. Static analysis of source, config, and history. No live site fetching, no headless browser against arbitrary user-supplied URLs. Website scanning comes later behind a domain allowlist and a sandboxed renderer.

**Output contract:** Every finding ships as (1) the detected problem in plain language, (2) the evidence with file and line, (3) a copy-pasteable prompt the user drops into their own coding agent to fix it. See Part 5.

---

## PART 0: SCORING PHILOSOPHY

### 0.1 The calibration failure to fix first

The current scanner scores obviously vibe-coded submissions above 90. That happens for four reasons, and all four are structural rather than prompt-tuning problems.

**Reason 1: additive scoring with a high floor.** A rubric that starts at 100 and subtracts small penalties cannot produce a low score unless dozens of penalties fire. Replace it with evidence-accumulation scoring: start at an unknown prior and let each confirmed signal move a posterior. A repo with eight strong tells should land in the 20s, not the 80s.

**Reason 2: a model is asked to judge quality it was trained to produce.** When you prompt an LLM with "rate this UI from 1 to 100," it regresses toward the same statistical mean that generated the UI. It has no negative reference class. Fix this by never asking the model for a holistic score. Ask it only for binary or ternary judgments on named, defined signals, each with a required evidence citation. Compute the score in code from those judgments. The model becomes a detector, not a judge.

**Reason 3: absence of evidence treated as evidence of quality.** If the scanner cannot find a `tailwind.config` theme extension, the current logic assumes nothing is wrong. Invert it. For a large class of signals, absence is the tell. No custom design tokens, no empty states, no error boundaries, no focus styles: each of those absences is a finding in its own right.

**Reason 4: no negative calibration set.** Build the calibration corpus described in 5.6 before touching weights. Ten known-vibe-coded repos and ten known-craft repos, hand-labeled. Any rubric change must keep the two clusters separated.

### 0.2 What "vibe coded" means for scoring purposes

Vibe coding is the practice of building software by directing a model in natural language and shipping the output without reading it. The term comes from Andrej Karpathy in early 2025. Simon Willison drew the useful line: if a model wrote every line but a human reviewed, tested, and understood all of it, that is not vibe coding, that is using a model as a typing assistant.

SecureVibe does not detect AI authorship. AI authorship is now the default and detecting it is worthless. SecureVibe detects **unreviewed** AI authorship, which shows up as a specific and stable set of artifacts. The score answers one question: **how much human judgment was applied after generation?**

Frame every signal that way. A signal is only valid if it distinguishes reviewed AI output from unreviewed AI output. Signals that only prove a model was involved get dropped.

### 0.3 The two axes

Report two independent scores plus a headline. Never average them into a single number and never let one hide the other.

- **Craft score (0-100):** how much design and engineering judgment shows in the interface layer. This is the product's wedge.
- **Exposure score (0-100):** security and operational risk. Table stakes.
- **Headline verdict:** one of five bands, derived from the pair. See 5.3.

A repo can score 30 on craft and 85 on exposure. That is a common and useful result: safe, forgettable software. The opposite pattern (attractive, leaking) is rarer and more urgent.

---

## PART 1: THE 2026 VIBE-CODE FINGERPRINT

### 1.1 Why a fingerprint exists at all

A language model predicts the most probable continuation. Asked for a landing page, it returns the statistical average of every landing page it has seen. The average is by construction the least distinctive option available. This is not a defect in any one tool and no amount of prompt cleverness removes it, because the pull toward the mean is the mechanism, not a bug in the mechanism.

The corollary matters commercially and belongs in SecureVibe's own marketing: generic design became free in 2026, so generic design is now worth close to nothing. The differentiated product is the one where a human overrode the average somewhere specific and defensible.

The second-order effect is what makes the fingerprint detectable. Models produce *size hierarchy* with near-perfect mathematical consistency (headline 30px, stat 24px, body 16px, label 12px) while failing to produce *attention hierarchy*, which requires deciding what the user should look at first and then suppressing everything else. Size hierarchy is a formula. Attention hierarchy is a judgment. Every strong detection signal in this document reduces to some version of that gap.

### 1.2 The research base

Cite this material in the product's methodology page. It gives SecureVibe an evidentiary spine that competitors relying on vibes about vibes do not have.

**Georgia Tech, School of Cybersecurity and Privacy, Systems Software and Security Lab: Vibe Security Radar.** The team scanned more than 43,000 security advisories, traced each fixing commit backward to the commit that introduced the bug, and flagged the introduction when it carried an AI tool signature such as a co-author tag or bot email. They track roughly 50 AI coding tools including Claude Code, Copilot, Cursor, Devin, Windsurf, Aider, Amazon Q, and Google Jules. Documented trajectory: 6 CVEs in January 2026, 15 in February, 35 in March 2026 alone, which exceeded all of 2025 combined, reaching 74 cumulative CVEs traceable to AI coding tools by March 20, 2026. Graduate researcher Hanqing Zhao estimates the true figure runs five to ten times higher, roughly 400 to 700 cases across open source, because the radar only catches cases that leave metadata traces. His practical guidance is the line SecureVibe should adopt as its posture: review AI output the way you would review a junior developer's pull request, with extra attention on input handling and authentication.

**Why the metadata-trace limitation is a product opportunity.** The radar under-counts because it depends on co-author tags surviving into history. SecureVibe scans the repo directly and can find the same class of defect without needing an attribution tag. Say that in the methodology page.

**Veracode.** Testing across more than 100 large language models on security-sensitive coding tasks found roughly 45% of generated samples introduced an OWASP Top 10 vulnerability, and that rate did not improve across testing cycles from 2025 into early 2026 despite vendor claims.

**Pearce et al.** Earlier baseline work put GitHub Copilot at roughly 40% vulnerable output in security-sensitive scenarios. The stability of the 40-45% band across four years of model improvement is the strongest single argument for the category existing.

**Cloud Security Alliance research notes (2026).** Across Fortune 50 enterprises, AI-assisted developers committed at three to four times the rate of peers while monthly security findings rose from roughly 1,000 to more than 10,000 over six months. The composition of defects shifted in a way that matters more than the volume: syntax errors fell 76% and logic bugs fell 60%, while privilege escalation paths rose 322% and architectural design flaws rose 153%. Models fixed the classes of error that are cheap to catch and amplified the classes that are expensive to catch.

**Package hallucination.** Roughly 20% of AI-generated code samples reference packages that do not exist. Attackers register those hallucinated names preemptively, an attack now called slopsquatting. This is directly detectable from a manifest and belongs in the exposure score at high severity.

**CodeRabbit.** Measured a 1.7x overall issue multiplier for AI-generated code relative to human-written baselines.

**Y Combinator.** Reported that 25% of the Winter 2025 batch had codebases that were 95% AI-generated. Useful for market sizing, not for detection.

**Design-side sources.** The Y Combinator design review session on common mistakes in vibe-coded websites names the visible pattern set directly: purple gradients, hover effects that draw attention without meaning, sections that fade in on scroll uniformly. One reviewed site carried five distinct typographic styles in a single hero (logotype, H1, subheading, label, decorative element), which the reviewing designer called a distinctly AI-generated pattern, because the model added a label style believing it was adding polish and produced noise that made hierarchy harder to parse. A human with typographic training does not arrive there independently. Industry write-ups converge on the same defaults: Inter, a purple-to-blue gradient, a four-card or three-card grid, uniform border radius, uniform padding, and one generic fade-in applied to everything.

### 1.3 Detection layers

Signals live in seven layers. Weight them roughly in this order, strongest first. Each layer's signals are defined in 1.4 through 1.10 with a detection method, a weight, and a false-positive guard.

| Layer | What it measures | Weight share of craft score |
|---|---|---|
| A. Design token system | Whether a design system exists at all | 22% |
| B. State coverage | Empty, loading, error, partial, offline | 20% |
| C. Typography system | Scale, pairing, measure, hierarchy discipline | 15% |
| D. Interaction and motion | Feedback, easing, purposeful animation | 13% |
| E. Structural layout | Grid discipline, rhythm, optical judgment | 12% |
| F. Copy and content | Voice, specificity, microcopy | 10% |
| G. Accessibility floor | Focus, semantics, contrast, reduced motion | 8% |

Provenance signals (commit co-author tags, generated-with footers, `.cursorrules`, `CLAUDE.md`) are **context, not penalty**. Record them. Use them to raise confidence in a borderline call and to select which fix prompts to generate. Never subtract points for them. Penalizing the presence of `CLAUDE.md` would penalize exactly the disciplined users SecureVibe wants as customers.

### 1.4 Layer A: Design token system

The single strongest cluster. A design system is a set of constrained decisions. Its absence is the clearest evidence that nobody made decisions.

**A1. No theme extension in the Tailwind config.**
Detect: parse `tailwind.config.{js,ts,mjs,cjs}` or the `@theme` block in a v4 CSS entry. Check whether `theme.extend.colors`, `fontFamily`, `spacing`, `borderRadius`, or `boxShadow` contain any project-specific entries beyond framework scaffolding.
Why it matters: a project with a real identity defines its own primitives. A project without one is running entirely on the framework's defaults, which every other project also runs on.
Weight: high. False-positive guard: a project using CSS custom properties in a global stylesheet, or a token package such as Panda, Vanilla Extract, or a `theme.ts`, satisfies this. Search for those before firing.

**A2. Default palette shades used directly in markup at scale.**
Detect: count occurrences of literal default-scale utilities (`bg-blue-500`, `text-gray-600`, `border-slate-200`, `bg-purple-600`) across component files. Compute the ratio of default-scale utilities to semantic or custom-token utilities (`bg-surface`, `text-muted`, `bg-brand`). A ratio above roughly 0.85 with more than 40 total occurrences fires the signal.
Why it matters: this measures whether color is a system or a per-element improvisation. It also catches the case where a config exists but nothing uses it.
**Guard, and this is a hard rule: never flag a hue on its own.** Purple is not a defect. Twitch, Figma, Stripe's accent range, Nubank, and Yahoo all sit in purple and all made that choice deliberately. Flag *structure*, never *chroma*. The finding is "your colors are the framework's defaults applied ad hoc," never "you used purple." Any generated copy that reads as criticizing a hue is a bug in the output layer, and 5.4 defines the language filter that prevents it.

**A3. Multi-stop gradient as primary surface treatment.**
Detect: gradient utilities or CSS gradients applied to hero, card, or section backgrounds, specifically ones spanning more than one hue family (`from-purple-500 via-pink-500 to-blue-500`, or the equivalent `linear-gradient` with three or more hue-distinct stops). Weight by placement: on a hero background it is a strong signal, on a small badge or chart fill it is near zero.
Why it matters: the multi-hue gradient is the highest-frequency generative default in the training distribution and it carries no information. A single-hue gradient with a tight value range is a legitimate craft choice and must not fire.

**A4. Uniform border radius across every element class.**
Detect: extract every radius value in the codebase. If more than 90% of elements share one value and that value is the framework default (`rounded-lg`, 8px, 0.5rem), fire.
Why it matters: real systems vary radius by element size and role. A 4px radius on an input and a 16px radius on a modal encode different physical scales. One radius everywhere means nobody thought about scale.

**A5. Uniform spacing with no rhythm.**
Detect: histogram every padding and gap value. Two failure shapes fire this. Shape one: a single value dominates above 80% (everything is `p-6`). Shape two: values scatter with no shared base unit, containing arbitrary one-off numbers like `p-[13px]` and `mt-[27px]` alongside scale values.
Why it matters: shape one means no hierarchy. Shape two means every value was negotiated separately with the model during a fix loop and never reconciled.

**A6. Shadow uniformity.**
Detect: all elevated surfaces sharing one shadow value, most often the default `shadow-md` or `shadow-lg`. Elevation should map to a z-order model: a dropdown, a modal, and a resting card sit at different heights and cast different shadows.

**A7. Icon set monoculture with no size or weight discipline.**
Detect: a single icon library imported (Lucide most commonly) with every icon at the same size and stroke weight, decorating labels that already read clearly without them. The signal is not the library, it is the decorative application. Icons that repeat the adjacent word carry no information.

### 1.5 Layer B: State coverage

The largest quality gap between reviewed and unreviewed AI output, and the section that produces the most convincing findings for a paying user. Models generate the happy path completely and reliably. Everything else is either absent or a placeholder.

For every data-fetching or user-input surface, five states must exist. Score coverage as a percentage of surfaces with each state present.

**B1. Empty state.** Detect: any list, table, grid, or feed rendering a collection. Check for a branch handling zero items. Then check the *quality* of that branch. A bare `<p>No items found.</p>` counts as present but scores as low quality. A real empty state names what would be here, explains why it is not, and offers the action that fills it.

**B2. Loading state.** Detect: presence of a pending branch. Then check quality. Score highest for skeletons matched to final content dimensions, mid for a spinner, low for nothing at all. Layout that shifts when data arrives is a separate, higher-severity finding because it is measurable as cumulative layout shift.

**B3. Error state.** Detect: catch blocks and error branches. Fire on three sub-patterns. First, errors swallowed entirely (`catch {}` or a bare `console.error`). Second, raw error objects rendered into the UI, which leaks internals and reads as unfinished. Third, generic strings ("Something went wrong") with no recovery path and no retry.

**B4. Partial and boundary states.** Detect: handling for one item versus many, for very long strings, for missing optional fields. Check for truncation strategy on user-supplied text. Absence means the interface was never tested with real data shapes.

**B5. Offline, stale, and permission-denied.** Rare in vibe-coded output and strongly present in reviewed output. High diagnostic value, low frequency. Weight it as a bonus rather than a penalty.

**B6. No error boundary.** Detect: React projects with no error boundary component anywhere in the tree, or Next.js projects with no `error.tsx` or `global-error.tsx`. One thrown error blanks the entire application. This is the highest-severity finding in Layer B.

### 1.6 Layer C: Typography

**C1. Untouched default font stack.** Detect: no font import and no `fontFamily` override, leaving the system stack or the framework default. Separately detect Inter, Geist, or a system-UI stack used for both display and body with no second face. The finding is never "you used Inter," which is a legitimate and well-drawn typeface. The finding is that one neutral face is doing every job, which means no typographic decision was made.

**C2. Too many typographic styles in one region.** Detect: count distinct font-size and weight combinations within a single section component. More than four in a hero fires. This is the exact pattern named in the YC review: the model adds an eyebrow label and a decorative element believing it is adding sophistication, and the result is that a reader cannot tell what to look at.

**C3. No modular scale.** Detect: extract every font-size value and test whether the set approximates a consistent ratio (1.125, 1.2, 1.25, 1.333, 1.414, 1.5). Arbitrary sizes scattered across the set (15px, 17px, 19px, 23px) indicate per-element improvisation.

**C4. Measure violations.** Detect: text containers with no max-width constraint, or a `max-w-*` that yields a line length far outside the 45-75 character band at the configured font size. Long-form text spanning a full desktop viewport is one of the fastest-reading tells because it looks fine at the component level and terrible on the page.

**C5. Weight range collapse.** Detect: only `font-bold` and `font-normal` present. Real typographic systems use medium and semibold to build hierarchy without shouting.

**C6. No optical corrections.** Absence of any negative letter-spacing on large display sizes, absence of `text-wrap: balance` or manual balancing on headlines, absence of tabular figures on numeric data. Each is a small positive signal of a human eye having passed over the type. Score their presence as craft credit rather than their absence as penalty.

### 1.7 Layer D: Interaction and motion

**D1. Hover states that only change opacity or nothing at all.** Detect: interactive elements with no `:hover`, `:active`, or `:focus-visible` styling, or with only an opacity change. A button that does not depress or shift on press feels dead in a way users register without being able to name.

**D2. No transition timing.** Detect: color and transform changes with no `transition` property, causing snapping. Then detect the opposite failure: `transition-all duration-300` applied globally, which animates properties that should never animate and produces a laggy feel on layout-affecting changes.

**D3. Uniform scroll reveal.** Detect: one intersection-observer fade-in or one animation class applied identically to every section. Motion that says nothing about content sequence is decoration. The YC review names this specifically.

**D4. Default easing everywhere.** Detect: `ease-in-out` or `linear` on everything. Entrances and exits need different curves. Interface motion generally wants a fast start and a slow settle, which is a custom cubic-bezier or the framework's `ease-out`, not the default.

**D5. Durations outside the usable band.** Detect: transitions above roughly 400ms on frequent interactions, or below roughly 80ms where the change should be perceivable. Both read as unconsidered.

**D6. No `prefers-reduced-motion` handling.** Detect: any animation in the project with no reduced-motion query anywhere. This is simultaneously an accessibility finding and a craft signal, because respecting it is a thing people who ship real products remember and people who do not, do not.

**D7. No optimistic updates or pending feedback on mutations.** Detect: form submits and mutations with no disabled state, no pending indicator, and no optimistic write. The user clicks and nothing happens for 800ms. See the Doherty threshold in 2.6.

### 1.8 Layer E: Structural layout

**E1. The canonical section stack.** Detect: a page composed of hero, then a three or four card feature grid, then logos, then testimonials, then pricing, then a final call to action, in that order, with no structural variation between sections. This is the single most recognizable page-level pattern. Detect it by classifying section components and matching the sequence. Weight it moderately rather than heavily, because the pattern is genuinely conventional for landing pages, and conventional is not the same as bad. The finding is that nothing in the sequence is specific to this product.

**E2. Perfect symmetry throughout.** Detect: every section centered, every grid evenly divided, no asymmetric weighting anywhere. Models produce symmetrical layouts with high consistency. Purposeful asymmetry became a common differentiator through 2026 precisely because it is what the average does not produce.

**E3. Card-grid overuse.** Detect: the ratio of card-wrapped content to total content blocks. When everything is a card, cards stop meaning anything. A card should signal that its contents belong together and are separable from neighbors.

**E4. No responsive judgment beyond breakpoint mirroring.** Detect: responsive variants that only change column counts, with no change in content priority, no reordering, no different navigation model. Real responsive design decides what matters most on a small screen and drops or defers the rest.

**E5. Fixed heights on content containers.** Detect: `h-[400px]` on anything holding variable-length content. This is the direct fingerprint of designing against one hardcoded example rather than against a content model.

**E6. Alignment by container rather than by eye.** Detect: icon-and-text pairs with no optical offset, buttons with symmetric padding around asymmetric glyphs. Hard to detect statically and worth flagging only at low confidence.

### 1.9 Layer F: Copy and content

Copy tells as loudly as pixels, and it is easier to detect statically than layout.

**F1. Placeholder content shipped.** Detect: lorem ipsum, "Your Company Name", "Feature One / Feature Two / Feature Three", fabricated testimonials with generic names, invented logos, hardcoded fake metrics. Fabricated social proof is also a legal exposure, so route it into both scores.

**F2. Superlative-dense marketing voice.** Detect: density of a defined term list per 100 words of user-facing copy. The list includes: seamless, robust, powerful, revolutionary, cutting-edge, effortless, unlock, elevate, supercharge, transform, next-generation, game-changing, best-in-class. Fire above a threshold rather than on any single occurrence.

**F3. Em-dash and rhetorical-structure density.** Detect: em-dashes per 100 words in prose copy, and the frequency of the "not X, but Y" construction and of tricolon lists. These are stylistic fingerprints of unedited model prose. Keep the threshold conservative, because plenty of good human writers use all three.

**F4. Emoji as section markers.** Detect: emoji in headings, in README section titles, and in feature-list bullets, especially the sparkle, rocket, checkmark, and fire glyphs. Frequent in unreviewed output and rare in reviewed output.

**F5. Feature-named rather than benefit-named UI.** Detect: labels describing the implementation instead of the user's action ("Submit", "Configure Webhook", "Sync Data Store"). Good interface copy names what the person controls and recognizes.

**F6. Verb inconsistency across a flow.** Detect: a button labeled "Publish" producing a toast that says "Successfully saved." An action should keep its name from control to confirmation. This is subtle, human-readable, and very hard for a generic linter to catch, which makes it a good demo finding.

**F7. Apologetic or vague error copy.** Detect: "Oops!", "Something went wrong", "We're sorry". Errors should state what happened and what to do next, in the product's voice.

### 1.10 Layer G: Accessibility floor

Treat these as a floor rather than a gradient. Below the floor, cap the craft score regardless of everything else, because an interface that keyboard users cannot operate is not well-designed no matter how it photographs.

**G1. Focus styles removed.** Detect: `outline: none` or `focus:outline-none` with no `focus-visible` replacement. Common, severe, trivially fixable.
**G2. Non-semantic interactive elements.** Detect: `onClick` on a `div` or `span` with no role, no `tabIndex`, and no key handler.
**G3. Missing labels.** Detect: inputs with no associated `label`, no `aria-label`, and no `aria-labelledby`. Placeholder text used as the only label.
**G4. Images without alt.** Detect: `img` and `next/image` with no `alt`, and decorative images with non-empty alt.
**G5. Contrast failures on defaults.** Detect statically where both foreground and background resolve to known token values. `text-gray-400` on white is the highest-frequency offender.
**G6. No skip link, no landmarks, no heading order.** Detect: heading levels skipping (h1 to h3), absence of `main`, `nav`, `header`.
**G7. No `lang` attribute on the document root.**

### 1.11 The anti-heuristic list: never flag these

Every item here is something a naive scanner would penalize and a credible one would not. Encode these as explicit suppressions with tests.

1. **A hue.** Purple, teal, orange, any of them. Twitch is purple by decision. The rule is structural gradients and default-scale application, never chroma.
2. **A typeface by name.** Inter is a good typeface. The finding is one face doing every job.
3. **A framework or component library.** shadcn/ui, Radix, Tailwind, Next.js, Lucide. Using good primitives is craft. The finding is using them without customization.
4. **AI provenance markers.** `CLAUDE.md`, `.cursorrules`, `AGENTS.md`, co-author trailers, generated-with footers. These indicate a disciplined workflow. Record as context, never penalize.
5. **Small codebases and low commit counts.** A focused tool is not a defect.
6. **Absence of tests in a prototype.** Weight tests only in the exposure score and only for repos presenting themselves as production software.
7. **Conventional page structure.** A landing page with a hero and a feature section is a convention that predates AI by two decades. Flag the absence of specificity, not the presence of convention.
8. **Resemblance to a large company's interface.** Never score against a reference product. A pattern that works for Stripe is tuned to Stripe's audience, their traffic mix, and their support cost structure. Score only against audience-independent principles from Parts 2 and 3. This rule protects the product from the single most common failure mode of design critique, which is preference dressed as expertise.
9. **Dark mode, glassmorphism, brutalism, or any named style.** A style consistently executed is a decision. Score consistency of execution, never the style itself.
10. **Verbose or unusual code style.** SecureVibe scores the interface and its risk surface, not the author's formatting taste.

### 1.12 Confidence and evidence requirements

Every finding must carry a confidence value and at least one file-and-line citation. Suppress any finding the detector cannot cite. A wrong finding with a confident tone costs more trust than five missed findings, because the user can verify a citation in ten seconds and cannot verify a vibe.

Three confidence tiers:
- **Confirmed:** deterministic detection from parsed source. Report plainly.
- **Likely:** heuristic threshold crossed with supporting context. Report with hedged framing and show the evidence prominently.
- **Possible:** single weak signal. Do not report individually. Only surface as part of a cluster, and only when three or more possibles point at the same underlying cause.

---

## PART 2: UI/UX PRINCIPLES AT DEPTH

This part is the reasoning engine. Part 1 tells the scanner what to look for. Part 2 tells it why each thing matters, which is what turns a lint result into analysis a person will pay for. Every principle below carries a mechanism, a detectable consequence, and the shape of the correct fix. Use the mechanism in the output. A finding that explains *why* the eye fails reads as expertise. A finding that says "this violates a rule" reads as a linter.

### 2.1 Preattentive processing and the two-second read

Human vision processes a small set of features in parallel across the entire visual field before attention engages, in under 250ms. The preattentive feature set includes hue, luminance, size, orientation, curvature, motion, and spatial position. Everything else, including shape recognition and reading, requires serial attention.

The consequence: whatever is preattentively distinct is what a user sees first, and this is not negotiable by intention. If eleven elements on a page all carry high luminance contrast against the background, the parallel stage returns eleven candidates and the user's attention scans them serially in an order the designer did not choose.

**Discriminability requires suppression, not addition.** A single preattentive channel must be reserved for the primary action and denied to everything else. This is the mechanism underneath the whole vibe-code fingerprint. Models add emphasis to every element they consider important, because each element is generated in local context where emphasis seems correct, and nothing in the generation process holds the global constraint that emphasis is zero-sum.

Detectable consequence: count elements on a primary view carrying high-emphasis treatment (filled background with brand color, large size, bold weight, shadow, or gradient). More than two on a single view fires a hierarchy finding. Also count competing calls to action in a hero. Two buttons of equal visual weight means the page has no primary action.

The corrective exercise, which belongs verbatim in the fix prompt: pick one element that must win. Make everything else quieter, to the point of feeling underdesigned. Then check whether the winner still wins.

### 2.2 Gestalt grouping as a spatial contract

The Gestalt principles are not style advice. They describe how the visual system infers structure from spatial relationships, and they operate whether or not the designer accounted for them.

**Proximity** dominates all other grouping cues. Elements closer together are read as related, and the relation is judged by *relative* distance, not absolute. A label 4px above its input and 24px below the previous field reads correctly. The same label with 12px on both sides reads as belonging to neither, or to both. This produces a hard detection rule: **the gap inside a group must be meaningfully smaller than the gap between groups, by a factor of at least two.** Uniform spacing across a form (every gap `space-y-4`) breaks the contract everywhere at once, which is precisely what signal A5 detects.

**Common region** overrides proximity. A border or background container groups its contents even against distance cues. This is why card overuse is a real defect rather than a taste complaint: wrapping unrelated content in cards asserts a relationship that does not exist, and the visual system believes the assertion.

**Similarity** groups by shared visual attributes. Two buttons styled identically claim equal importance. When a destructive action and a primary action share styling, the interface is lying about consequence.

**Uniform connectedness** is the strongest grouping cue and the least used. Elements joined by a line or an enclosing shape group more strongly than proximity or similarity can override. Segmented controls and connected input groups exploit this.

**Continuity** explains why misalignment costs more than it seems to. The eye follows implied lines. A single element off the alignment axis by 3px interrupts a line the eye was already tracking, and it registers as wrongness without the viewer locating the source.

**Closure** and **figure-ground** govern whether a shape reads as a container or as content, which determines whether a modal reads as layered above the page or as pasted onto it.

**Common fate** applies to motion: elements animating together are read as a single group. This is why the uniform scroll-reveal of signal D3 actively harms comprehension. Every section entering identically claims every section is the same kind of thing.

### 2.3 Attention hierarchy versus size hierarchy

The central distinction of this document.

**Size hierarchy** assigns type sizes down a scale by nominal importance. It is mechanical, it is what models produce with near-perfect consistency, and it is not hierarchy. A page can have a flawless type ramp and still give the eye nowhere to land.

**Attention hierarchy** decides, for a specific user arriving with a specific intent, the exact sequence in which they should encounter information, and then engineers that sequence across every available channel: position, luminance contrast, size, color temperature, whitespace isolation, and motion. It requires knowing who is arriving and why, which is why models cannot produce it from a generic prompt and why it stays a durable human advantage.

Isolation deserves special mention because it is the most underused tool and the most reliable. An element surrounded by significantly more empty space than its neighbors wins attention without any increase in size, weight, or color. It costs nothing in visual noise. Vibe-coded layouts almost never use it, because uniform spacing is the default and isolation requires deliberately breaking the uniform.

Detectable proxy: compute, for each primary view, whether any single element has both above-median whitespace isolation and above-median contrast. If no element qualifies, the view has no focal point. Report that as "this screen has a type scale but no focal point," and explain the difference. This finding lands harder than anything else in the product, because it names something the user has felt and could not articulate.

### 2.4 Cognitive load theory

Sweller's framework splits load into three parts, and the split is what makes it actionable.

**Intrinsic load** comes from the inherent complexity of the task. Filing a tax return is harder than setting an alarm. Design cannot reduce intrinsic load, only sequence it. Chunking and progressive disclosure work by spreading intrinsic load across time rather than eliminating it.

**Extraneous load** comes from how information is presented. Every unit of extraneous load is pure waste and every one of them is a design defect. Sources: inconsistent terminology for one concept, controls that move between views, information split across screens that must be held in memory to combine, ambiguous labels requiring inference, and visual noise requiring filtering.

**Germane load** is the effort of building a mental model. Good design increases this deliberately, because a user who understands the model can predict what the software will do. This is why hiding complexity too aggressively backfires: the user never builds a model and stays permanently dependent on guessing.

The split-attention effect is the most directly detectable form of extraneous load. When two pieces of information must be integrated to be understood and they sit in different places, the integration burns working memory. Error messages far from the field they refer to, legends separated from charts, and instructions above a form that must be recalled while filling it in are the common cases.

Working memory holds roughly four chunks, not seven. Miller's 1956 figure has been revised down by Cowan and others, and the common design citation of "seven plus or minus two" as a menu-length rule is a misapplication of the original paper regardless. Miller measured absolute judgment along a single dimension, not menu design. The usable rule is that any set a user must hold in mind while acting should stay at or under four items, while a set they can look at while acting has no such limit. This distinction kills the widespread bad advice to cap navigation at seven items.

### 2.5 Hick-Hyman law and the geometry of choice

Decision time scales with the logarithm of the number of equiprobable alternatives:

**T = a + b · log₂(n + 1)**

The logarithm matters. Doubling options does not double decision time, which means the common advice to always reduce choices is wrong. The law also assumes equiprobable, independent alternatives with no structure. That assumption almost never holds in an interface.

Three consequences that follow correctly:

1. **Categorization beats reduction.** Twenty items in four labeled groups is a decision over four followed by a decision over five, which is faster than a decision over twenty and does not remove any capability.
2. **Unequal probability defeats the law.** Highlighting a likely default converts a search into a confirmation. The recommended plan on a pricing page works through this mechanism.
3. **Experts are unaffected.** For a known target, the user does not search, they aim. Optimizing away options for the sake of the law hurts returning users while helping only the first visit.

### 2.6 Fitts's law and the physical layer

Movement time to a target:

**MT = a + b · log₂(2D / W)**

D is distance to target center, W is target width along the movement axis. The log term is the index of difficulty.

Practical consequences that separate considered interfaces from generated ones:

- **W is measured along the axis of motion.** A wide, short menu item approached vertically has an effective W of its height, not its width. This is why full-width row hit areas work and why a 32px-tall row with a 16px icon target inside it wastes its own affordance.
- **Screen edges have infinite effective width.** The pointer stops at the edge, so edge-anchored targets are the fastest on screen. Corners are effectively infinite in two dimensions.
- **Distance compounds with frequency.** A control used forty times an hour deserves proximity to the work area. A control used once a session does not.
- **Minimum target sizes come from motor precision, not aesthetics.** 44 by 44 CSS pixels on touch, 24 by 24 as an absolute accessibility floor for pointer targets. Spacing between adjacent targets matters as much as size, because adjacency turns an accuracy error into a wrong action rather than a null action.
- **Thumb reach on mobile is not uniform.** The bottom-center arc is cheap, the top corners are expensive. Primary actions placed in a top-right header on a mobile layout are a real, detectable cost.

Detection: measure rendered target sizes where computable, flag interactive elements below 24px in either dimension, flag adjacent destructive and confirming actions with less than 8px separation, and flag primary mobile actions positioned in the top region.

### 2.7 Response time, the Doherty threshold, and perceived duration

Three canonical bands from Miller's 1968 work hold up under every subsequent replication:

- **Under 100ms:** perceived as instantaneous. The system feels like a direct extension of the hand.
- **Under 1 second:** the flow of thought stays unbroken, but the delay is noticed. No indicator needed below roughly 400ms, because an indicator that flashes is worse than no indicator.
- **Under 10 seconds:** attention holds on the task only with feedback showing progress. Beyond 10 seconds, the user context-switches away and the cost of return is high.

The **Doherty threshold** sharpens this: when system response drops below roughly 400ms, user productivity rises superlinearly, because the human stops waiting for the machine and starts operating at their own pace.

Perceived duration is not actual duration, and the gap is exploitable honestly. Progress indication that shows real, non-uniform progress feels longer than one that accelerates toward the end. Occupied waits feel shorter than unoccupied ones. Skeleton screens feel faster than spinners at identical actual duration, because the skeleton communicates layout and gives the eye something to parse. Optimistic updates remove the perceived wait entirely by assuming success and reconciling on failure, which is correct whenever the failure rate is low and the failure is recoverable.

Detectable: absence of pending states on mutations (D7), spinner-only loading where skeletons are feasible (B2), and layout shift on data arrival.

### 2.8 Affordances, signifiers, mapping, and feedback

Norman's framework, stated precisely because the terms get used loosely.

An **affordance** is a relationship between an object's properties and an agent's capabilities. It exists whether or not anyone perceives it. A **signifier** is a perceivable indication of where action should occur. Interfaces are made of signifiers. Removing a button's shadow does not remove its affordance, it removes the signifier, which is the actual failure.

The flat-design era degraded signifiers broadly, and generated interfaces inherit that degradation without inheriting the compensating conventions. Text that is clickable but styled identically to text that is not is a signifier failure and produces measurable dead-click behavior.

**Mapping** is the relationship between control and effect. Natural mapping uses spatial or cultural correspondence so that no learning is required.

**Feedback** must be immediate, informative, and proportionate. Feedback that arrives after 300ms of silence has already failed, because the user has begun forming the hypothesis that the click did not register.

**Constraints** prevent invalid actions rather than reporting them afterward. A date picker that cannot select an invalid date beats validation that rejects one.

The **gulf of execution** is the gap between intention and knowing what to do. The **gulf of evaluation** is the gap between system state and knowing what happened. Every usability defect in an interface sits in one of these two gulfs, which makes them a useful classification axis for findings.

### 2.9 Typography as a system

**Measure** is the strongest single determinant of reading comfort. 45 to 75 characters per line for body text, with 66 as the classical optimum. Below 45 the eye returns too often and rhythm breaks. Above 75 the return sweep loses the next line. Measure interacts with leading: longer lines need more leading to keep the return sweep accurate.

**Leading** scales inversely with size. Body text wants roughly 1.5 times the font size. Display text at 48px and above wants 1.0 to 1.2, because the same ratio applied to large type opens gaps that break the headline into separate lines. A single global `leading-relaxed` applied across all sizes is a detectable tell and produces headlines that fall apart.

**x-height** matters more than nominal point size for perceived size and legibility at small sizes. Two faces set at 16px can differ by 20% in apparent size. This is why swapping a typeface without re-tuning sizes never works.

**Modular scale.** A type scale should be generated from a base and a ratio rather than chosen per element. Common ratios: 1.125 minor second, 1.2 minor third, 1.25 major third, 1.333 perfect fourth, 1.414, 1.5, 1.618. Larger ratios suit editorial work with few sizes and high contrast. Smaller ratios suit interfaces with many sizes and tight steps. Interfaces usually want a hybrid: a tight ratio for the UI range from 12px to 20px and a wider ratio above it for display.

**Optical adjustment.** Large display type needs negative tracking, roughly -0.01em to -0.03em, because letter-spacing designed for text sizes looks loose when scaled up. Small text below 13px needs positive tracking. All-caps needs positive tracking always. Absence of any tracking adjustment anywhere in a codebase indicates nobody looked at the type at display size.

**Typographic contrast requires more than size.** Pairing works through contrast in classification, weight, width, or rhythm. A geometric sans display face against a humanist sans body face is a real pairing. The same face at two sizes is not a pairing, it is a scale.

**Numerals.** Tabular figures for anything in a column or anything that updates in place, because proportional figures cause the value to jitter as digits change. Absence of `font-variant-numeric: tabular-nums` on data tables and live counters is a small but very diagnostic signal.

### 2.10 Color as a perceptual system

**Perceptual uniformity.** sRGB and HSL are not perceptually uniform. Two HSL colors with identical lightness values can differ substantially in perceived brightness, which is why a palette generated by rotating hue at fixed HSL lightness produces some colors that punch and some that vanish. OKLCH and OKLab correct this. A palette defined in OKLCH with a consistent lightness ramp reads as consistent. This is a strong positive craft signal when detected, because it indicates someone who understands the problem.

**Contrast.** WCAG 2.x contrast ratios are a luminance ratio computation with known failure modes, particularly for dark backgrounds and for large text, where it both over-permits and over-restricts. APCA, developed for WCAG 3, models perceptual contrast including polarity and font weight and produces materially better results. Ship WCAG 2 conformance as the compliance floor because it is what regulation references, and use APCA reasoning in the design guidance.

**Simultaneous contrast.** A color's appearance shifts based on its surround. A mid-gray reads dark on white and light on black. This is why a token set that works in light mode frequently fails in dark mode with the same values inverted, and why real dark modes are designed independently rather than computed by inversion. Detection: dark mode implemented purely as a class-based inversion with no separate token values.

**Semantic color.** Color must never be the sole carrier of meaning, both because roughly 8% of males have a color vision deficiency and because color meaning is not universal across cultures. Every state communicated by color needs a redundant channel: an icon, a label, or a position. Detection: status indicators rendered as a colored dot with no text or icon.

**Chroma discipline.** High-chroma colors demand attention involuntarily. A palette where the brand color, the success color, the warning color, and the error color all sit at maximum chroma has no way to signal urgency, because everything is already urgent. Reserve maximum chroma for one role.

**Restating the hard rule from 1.4:** none of this licenses flagging a hue. Purple at high chroma used for one reserved role is excellent. Purple used simultaneously for brand, background gradient, hover, focus, and success is a structural failure that would be equally a failure in green.

### 2.11 Space, grid, and rhythm

**Base unit systems.** An 8px base with a 4px half-step covers nearly everything and survives across pixel densities. The value of a base unit is not the number, it is that every spacing decision becomes a choice among six or seven options rather than a free continuous variable. Arbitrary values scattered through a codebase (`mt-[13px]`) prove the system was abandoned during a fix loop.

**Space is not decoration, it is the primary grouping mechanism.** See 2.2. Density is a legitimate design axis, and a dense interface is not a worse interface. A dense professional tool that respects relative proximity ratios is well designed. A spacious interface with uniform gaps is not.

**Optical alignment beats mathematical alignment.** Round shapes need to overshoot flat ones to appear aligned. Text next to an icon aligns on the text's optical center rather than its bounding box. Punctuation hangs outside the measure in careful settings. These are the details that separate work that reads as human.

**Vertical rhythm.** Establishing a baseline grid and setting all vertical spacing as multiples of it produces a page that scans cleanly. Strict baseline grids are impractical on the web with variable content, and the useful approximation is consistent spacing multiples plus consistent leading within each type role.

**Grid as a decision structure.** A 12-column grid is not a layout, it is a constraint that makes layout decisions comparable. The failure mode in generated layouts is not absence of a grid, it is absence of any deviation from the most obvious division, which produces the perfect symmetry of signal E2.

### 2.12 Motion

**Motion must carry information.** Every animation should answer one of: where did this come from, where did it go, what is related to what, or what is the system doing right now. Animation answering none of these is decoration and should be cut.

**Duration scales with distance and size.** Small elements moving short distances: 100 to 150ms. Medium: 200 to 300ms. Large surfaces crossing the screen: 300 to 400ms. A modal and a tooltip on the same duration is wrong in both directions.

**Easing carries semantics.** Ease-out for entrances, because the object arrives fast and settles, which reads as responsive. Ease-in for exits, because the object accelerates away and the user stops caring about it. Ease-in-out for elements moving between two on-screen positions. Linear only for continuous indeterminate motion such as a spinner. Spring physics for direct-manipulation gestures, where the response must track the finger.

**Orchestration beats simultaneity.** Staggering related elements by 20 to 50ms produces a sequence the eye can follow, and it communicates grouping through common fate. Everything animating at once produces a flash that communicates nothing. This is the specific correction for D3.

**Performance is a design constraint.** Animate only transform and opacity, which the compositor handles without layout or paint. Animating width, height, top, or left forces layout on every frame. A 300ms animation that drops frames feels worse than no animation, so a slow animation is a design defect and not only an engineering one.

**Reduced motion is not optional.** Vestibular disorders make large-scale motion physically harmful. Honor `prefers-reduced-motion` by replacing movement with opacity changes rather than by removing all feedback.

### 2.13 Errors, slips, and forgiveness

Reason's distinction: a **slip** is the right intention executed wrongly, and a **mistake** is the wrong intention. Slips are addressed by constraints and by making targets easier to hit. Mistakes are addressed by better feedback about system state and by clearer conceptual models. Design that treats every error as a user mistake, by adding confirmation dialogs, fixes the wrong class and adds load for everyone.

**Prevention beats correction.** Constrain input so invalid states are unreachable. Disable what cannot apply, and label why.

**Undo beats confirm.** A confirmation dialog interrupts every action to guard against a rare error, and users learn to dismiss it without reading, so it stops working while continuing to cost. Undo costs nothing on the common path and fully recovers the rare one. Reserve confirmation for the genuinely irreversible.

**Error messages need three parts:** what happened, why, and the specific next action. "Invalid input" has none of them. Errors state facts and do not apologize.

**Validation timing.** Validate on blur for format, not on every keystroke, which punishes users mid-entry. Show success confirmation for fields with non-obvious rules. Never clear a form on a failed submit, which is the single most common data-destroying pattern in generated forms and is worth detecting specifically.

### 2.14 Information architecture and foraging

Information foraging theory models a user as a forager following **information scent**, which is the perceived likelihood that a path leads to the target. Users abandon a patch when scent drops below the expected value of switching.

The design consequence is that link and label wording is not cosmetic, it is the entire navigational mechanism. "Learn more" carries no scent. "See pricing for teams" carries scent. Generated interfaces produce low-scent labels consistently, because generic labels are the statistical average of all labels.

**Progressive disclosure** sequences intrinsic load, and it fails when it hides things a user needs to know exist. The rule: reveal the existence of depth, defer the detail. A collapsed section with a descriptive label satisfies this. An interface that silently lacks a feature until some condition is met does not.

**Recognition over recall.** Show the options rather than requiring the user to remember them. Recall is expensive and error-prone. This is the argument for visible navigation over command-only interfaces, and for showing current state rather than expecting the user to track it.

### 2.15 Aesthetic-usability, first impressions, and credibility

Users judge visual appeal in roughly 50ms, per Lindgaard and colleagues, and that judgment correlates strongly with judgments made after much longer exposure. The first impression anchors everything after it.

The **aesthetic-usability effect** is that users perceive attractive interfaces as more usable, and they tolerate minor usability problems in attractive interfaces longer. This cuts both ways and is worth stating honestly in the product: attractive design buys forgiveness for small defects, and it also masks real usability problems during testing.

Stanford's web credibility research puts design quality as the most-cited factor in credibility judgments by ordinary users, ahead of source reputation and ahead of content accuracy. This is the commercial core of SecureVibe's pitch. A product that looks generated does not fail because generated is ugly. It fails because visitors have learned that generated correlates with abandoned, unsupported, and unsafe, and they discount the product accordingly before reading a word.

State that mechanism in the report. It converts a design finding into a revenue argument, which is what makes a founder pay.

### 2.16 Consistency and Jakob's law

**Jakob's law:** users spend most of their time on other products, so they expect yours to work like the ones they already know. Convention is a subsidy on learning cost, and spending it should be deliberate.

Distinguish **internal consistency** (within the product) from **external consistency** (with platform and category conventions). Internal inconsistency is nearly always a defect. External inconsistency is sometimes the whole point of the product, and the cost is a learning burden that must be repaid by a real advantage.

The generated-interface failure is a specific variant: internal inconsistency across sections built in separate generation passes. Two buttons with different heights, two cards with different padding, two headers with different alignment. Each was locally correct and nothing enforced the global constraint. Detection: variance in the rendered dimensions of the same component role across pages.

**Restating rule 8 from 1.11:** matching a specific large company's interface is not a goal. Their choices are tuned to their audience, their traffic, and their support economics. Score against the principles in this part, which hold independent of audience.

### 2.17 Accessibility as design law

POUR: perceivable, operable, understandable, robust. Treat WCAG 2.2 AA as the floor rather than the target.

The load-bearing items for a scanner:
- Every function reachable and operable by keyboard, with a visible focus indicator that meets contrast requirements against both its background and the adjacent unfocused state.
- Focus order matching visual order, and focus trapped inside modals with restoration on close.
- Semantic elements for interactive controls, since a `div` with a click handler is invisible to assistive technology and to keyboard users.
- Names, roles, and values exposed for every control.
- Text contrast at 4.5:1 for body, 3:1 for large text and for non-text interface elements including focus indicators and input borders.
- Motion respecting `prefers-reduced-motion`.
- Target sizes at 24 by 24 CSS pixels minimum with adequate spacing.
- Content reflowing to 320px width without horizontal scrolling, and remaining usable at 200% zoom.

Accessibility work is design work rather than remediation. Focus states are visual design. Error messaging is content design. Target sizing is layout. Reporting accessibility separately from craft would repeat the same mistake as separating security from quality, so fold it into the craft score as the floor described in 1.10.

---

## PART 3: ENGAGEMENT AND RETENTION PSYCHOLOGY

SecureVibe uses this part twice. First as detection knowledge, because a repo can be scanned for the presence or absence of the structures below. Second as prescription, because the fix prompts should tell the user what to build, not only what is broken. This is also the section that makes the report worth paying for. A design critique is interesting. A retention critique is a revenue conversation.

### 3.1 What drives repeated use

**Self-determination theory** identifies three needs whose satisfaction produces intrinsic motivation, which is the only kind that survives after novelty decays.

**Autonomy** is the sense that actions are self-chosen. Interfaces support it with real defaults that can be changed, with reversibility, and with the absence of forced sequences. They damage it with mandatory tours, with modal interruption, and with any pattern that makes the user feel handled.

**Competence** is the sense of effective action against an appropriate challenge. Interfaces support it with visible progress, with feedback proportionate to the action, and with difficulty that rises as skill rises. Keyboard shortcuts, bulk operations, and advanced modes exist to keep competence available to users who have outgrown the beginner path. Their absence is why tools that onboard well still churn at month three.

**Relatedness** is connection to others. Not every product needs it, and forcing social features into a single-player tool damages autonomy without producing relatedness. Where it fits, it is the strongest retention mechanism available, because it converts churn from an individual decision into a social cost.

**Fogg's behavior model: B = MAP.** Behavior occurs when motivation, ability, and a prompt converge at the same moment. The practical asymmetry is that motivation is expensive to raise and ability is cheap to raise. Almost every retention problem framed as "users are not motivated" is actually an ability problem, and the correct intervention is to remove steps rather than to add persuasion. A prompt arriving when ability is low produces annoyance and trains the user to dismiss future prompts, which is why aggressive notification strategies degrade over time.

**The habit loop.** Trigger, action, variable reward, investment. External triggers (notification, email) must convert into internal triggers (a felt need that brings the user back unprompted) or retention stays purchased rather than earned. The investment phase is the underused one: each time a user puts something into the product (data, configuration, content, social connection), the product improves for them specifically, and the switching cost rises for reasons the user endorses.

### 3.2 Activation and the first session

Activation predicts retention more strongly than any later intervention. A user who does not reach value in the first session rarely returns, and no amount of re-engagement email recovers them at scale.

**Time to first value** is the metric. Measure from arrival to the first moment the user experiences the thing they came for, and drive it toward zero. Every step before that moment is a leak: account creation before value, email verification before value, a configuration wizard before value, an empty dashboard requiring setup before value.

**The aha moment** is the specific action or realization correlating with long-term retention. It is empirical and product-specific, found by comparing retained and churned cohorts on early behavior. Once identified, the entire onboarding should be redesigned to drive that single action rather than to tour features.

**Pre-populated state beats empty state.** A new user facing a blank canvas must both learn the tool and generate content. Sample data, a template, or a demo project removes half the burden. This is why B1 empty-state quality carries weight beyond aesthetics.

**Endowed progress.** A progress indicator that begins partially complete produces materially higher completion than an equivalent indicator starting at zero, because people are more motivated to finish something already begun. Granting the first two steps for actions the user already took (signing up, confirming email) is honest and effective.

**Goal-gradient.** Effort increases as the perceived end approaches. Combined with endowed progress, this argues for showing progress on any sequence of more than three steps, with the remaining count visible.

**Zeigarnik effect.** Unfinished tasks occupy memory more than finished ones. Visible incompleteness (a half-filled profile, a draft, an unfinished setup checklist) generates genuine return pressure. This turns manipulative when the incompleteness is manufactured rather than real, which is the line drawn in 3.8.

**The IKEA effect.** People value what they helped build. Configuration, customization, and content creation raise valuation of the product itself, independent of the objective quality of the result. This is the psychological reason the investment phase of the habit loop works and the reason import-and-setup flows should feel like building rather than like filling forms.

### 3.3 Habit, reward, and the honest use of variability

Variable reward schedules produce more persistent behavior than fixed schedules. This is well established and it is the most abused finding in product psychology.

The honest version: variability is legitimate when the underlying value is genuinely variable. A feed of real content from real people is variably rewarding because the content actually varies. A search returning different results is variably rewarding because the world changed. Manufacturing artificial variance (randomized rewards with no informational content, mystery boxes, arbitrary drip-feeding of already-available content) exploits the mechanism against the user's interest and belongs in 3.8.

**Streaks** work through loss aversion, since a streak becomes an endowment that breaking destroys. They are effective and they carry two failure modes worth naming in any recommendation. First, streak anxiety, where the mechanism generates stress disproportionate to the value delivered. Second, brittle collapse, where one break destroys the entire motivational structure and the user churns immediately rather than resuming. Recommend streaks with a repair mechanism (a freeze, a grace day) and never recommend them for products used at naturally irregular intervals.

**Trigger design.** An internal trigger is an emotional or situational state that the product resolves. Products with durable retention map to a state that recurs naturally: boredom, uncertainty, a periodic obligation, a recurring work task. A product whose triggering state occurs twice a year cannot be made into a daily habit by notification volume, and attempting it produces uninstalls. Frequency of the underlying problem sets the ceiling on frequency of use, which is a strategic constraint rather than a design one.

### 3.4 How experience is remembered

Retention decisions are made from remembered experience, not lived experience, and the two differ systematically.

**Peak-end rule.** An episode is remembered by its most intense moment and its ending, roughly averaged, with the duration of the episode nearly ignored. Two consequences. First, engineering one genuine peak (a moment of delight, a result that exceeds expectation, a piece of unexpected craft) outweighs raising the average across the whole experience. Second, endings are disproportionately load-bearing, which makes the completion state, the successful save, the export, and the logout the most underinvested moments in most software.

**Duration neglect.** A longer good experience is not remembered as better than a shorter one. Time-on-site as a success metric is therefore actively misleading for tools, since a tool that takes less time to accomplish the same job is the better product and will show worse engagement numbers.

**Serial position.** First and last items in a sequence are recalled best. Order onboarding steps, feature lists, and pricing tiers accordingly.

**Von Restorff isolation effect.** The item that differs from its neighbors is remembered. This is the memory-side justification for the attention-hierarchy argument in 2.3, and the reason uniformity costs more than it appears to.

### 3.5 Trust, credibility, and honest social proof

Credibility judgments happen fast and mostly on surface features, per 2.15. Beyond visual quality, the detectable trust structures are:

- **Specificity.** Concrete claims with numbers and named constraints read as true. Superlatives read as filler and lower credibility even when accurate. This is the psychological basis for detection signal F2.
- **Verifiable social proof.** Real named customers, real logos with permission, real numbers. Fabricated testimonials are the single fastest way to destroy credibility on discovery, and they carry regulatory exposure. Detection signal F1 covers this.
- **Visible fallibility.** A public changelog, a status page, and honest limitations raise credibility. Products that claim no limitations are read as either dishonest or inexperienced.
- **Transparent handling of data and AI.** In 2026, disclosing what a model does with user input is a trust asset rather than a liability. For SecureVibe specifically, users are pasting their repository. Say plainly what is retained and what is not.

### 3.6 Retention mathematics

Design recommendations without cohort framing are guesses. Establish the shape first.

**Retention curves flatten or they do not.** Plot the percentage of a cohort active at day 1, 7, 30, 90. A curve that flattens at any positive value indicates product-market fit for that segment, and the work is to raise the plateau and widen the funnel into it. A curve that decays toward zero means no segment found durable value, and no engagement mechanic fixes it. Diagnosing which case a product is in comes before any recommendation from 3.2 or 3.3.

**Segment before averaging.** An aggregate curve decaying to zero often hides one segment retaining at 60% inside a majority that never activated. The correct move is usually to narrow the product toward the retaining segment rather than to broaden appeal.

**Natural frequency caps everything.** Map the real-world recurrence of the problem, then set the retention target from it. A tax tool with 92% annual retention is outstanding. A messaging app with 92% weekly retention is ordinary.

**Resurrection is cheaper than acquisition.** Churned users who once activated retain better on return than new users do on arrival, because they already have a mental model and prior investment. Most products never build a resurrection path.

**Churn causes map to specific design fixes.** Never activated maps to 3.2. Value delivered but not habitual maps to 3.3 and trigger design. Outgrew the tool maps to competence support in 3.1. Broke and lost trust maps to state coverage in Layer B and error handling in 2.13. Diagnose before prescribing.

### 3.7 Percentile ranking as the score presentation layer

Report position in a corpus rather than a raw number. A craft score of 60 becomes "top 80% of repositories we have scanned," with the next band named and priced: "top 50% is four findings away." The raw score stays available and stops being the headline.

**Why the raw number loses arguments the percentile wins.** An absolute score invites the one response that kills the product, which is "60 out of what?" The user disputes the rubric, and a rubric argument is unwinnable because taste appears to be at stake. A percentile moves the claim from a judgment about their work to a positional fact about a population. Festinger's social comparison theory covers the mechanism: when no objective standard exists for an ability, people evaluate themselves against similar others, and they do it whether or not the product offers the comparison. Design quality has no standard a founder already trusts. Supplying the comparison directly is more useful than leaving them to guess it.

**Normative feedback moves behavior harder than absolute feedback,** which is the finding underneath every energy-usage report and every credit-score product. It carries one documented failure mode. Telling above-average performers where they stand causes regression toward the norm, since the comparison reveals they have slack. Schultz and colleagues removed the effect by adding an approval signal for those already ahead. The design consequence: for a repo in the top decile, never show the percentile alone. Show the percentile plus the specific thing that keeps it there and the one finding that would cost it. High scorers get maintenance framing, low scorers get climb framing.

**The percentile converts the score into a finite goal.** Section 3.2 covers endowed progress and the goal gradient, and both need a defined finish line to work. "Raise your score" has none. "Four findings from top 50%, listed below, each with a fix prompt" is a bounded quest where the remaining effort is visible and the fix prompts are already in hand. This is the single strongest motivational structure the product can offer, and it costs nothing extra because the findings already exist.

**Percentile is the shareable unit.** A user posts "top 3%." Nobody posts "72 out of 100." That matters directly for zero-capital distribution: the before-and-after of a repo moving up bands is a stronger piece of content than a number climbing, because the second number needs the rubric explained and the first does not. Gate any shareable badge behind a genuine threshold and link it to the full report, so the badge stays evidence rather than decoration.

**Requirements that keep it honest.** Every one of these is load-bearing, since a fabricated benchmark is fabricated social proof under 3.5 and would destroy the credibility the whole product runs on.

1. **The corpus is real and disclosed.** Publish the sample size, what is in it, and how it was assembled. Never generate a synthetic distribution or a plausible-looking curve.
2. **Segment or the number lies.** Compare against the same class of thing: application versus library, framework, size band. A solo founder's Next.js project and a design-system team's monorepo do not belong in one distribution. Name the cohort in words next to the number, always.
3. **Show bands, not decimals, at low n.** Below roughly 200 repos in a cohort, report "top quarter" rather than "top 78.4%." False precision reads as invention and a user who spots it stops trusting everything else.
4. **Account for distribution shape.** Unreviewed output clusters tightly in the 30 to 45 range, so a few points of craft score produce a large percentile jump there and almost none near the top. Lead with percentile for repos in the cluster, where the movement is motivating and real. Lead with absolute score above the cluster, where percentile stops discriminating.
5. **Frame ascending, never descending.** "Top 80%" and "bottom 20%" state the same fact with opposite affect. Use the ascending form for the position and keep the verdict sentence from 5.3 blunt. The percentile is the motivational frame, not a euphemism, and softening the findings themselves would break the voice rules in 4.4.
6. **Version the reference cohort.** If the corpus updates live, a user's rank falls while their repo is unchanged, because everyone else improved. That is a real drop with no cause the user can see, and it reads as a broken product. Snapshot the distribution, version it, recompute quarterly, and label which snapshot a report used.
7. **Disclose self-selection.** People who scan repositories skew toward people already worried about their code. Say so. It costs one sentence and buys the credibility described in 3.5.
8. **Rank repositories, never people.** No public leaderboard, no user-versus-user comparison. A leaderboard turns the report into a shaming instrument and contradicts the address-the-builder-as-capable rule in 4.4.

**Guard against cosmetic gaming.** Publishing the weights plus a percentile creates an incentive to satisfy signals rather than fix causes. The defense is already in the architecture: percentile derives from craft score, which derives from cited findings, so moving the number requires removing evidence. Keep it that way by scoring signals on usage rather than presence. A theme extension nobody imports earns nothing, since A2 measures the ratio of default utilities to token utilities in actual markup rather than the existence of a config block.

**The endorsement test from 3.8 passes cleanly here.** A user told exactly how the percentile is computed, against which cohort, at what sample size, would keep using it. That is the difference between this and a manufactured curve, and it is worth stating inside the product rather than burying in a methodology page.

### 3.8 The ethical line, stated as product policy

SecureVibe recommends persuasive structure and refuses manipulative structure. Encode this as a hard filter on generated recommendations, because a model asked to raise engagement will otherwise reach for the patterns below, and shipping a tool that teaches dark patterns destroys the brand permanently and carries live regulatory risk.

**The test:** would the user endorse this mechanism if it were explained to them plainly? Endowed progress passes, because a user told "we counted your signup as step one to get you started" would shrug and continue. A hidden recurring charge fails.

**Never generate recommendations for:**
- Roach motel flows, where signup is one click and cancellation requires contact.
- Confirmshaming, where the decline option is worded to shame.
- Disguised advertising, or interface elements styled to be mistaken for system messages.
- False urgency and fake scarcity, including manufactured countdowns and invented stock counts.
- Fabricated social proof, including invented activity notifications.
- Preselected paid add-ons and opt-out defaults for anything that costs money or shares data.
- Obstruction of account deletion or data export.
- Notification patterns designed to generate anxiety rather than deliver information.
- Infinite scroll with no stopping cue in contexts where the user's goal is finite.
- Manufactured incompleteness, meaning artificially withholding already-available value to create Zeigarnik pressure.

**Regulatory reality worth stating in the report:** the FTC has enforced against negative-option and cancellation dark patterns, the EU Digital Services Act prohibits interface designs that deceive or manipulate recipients, and California's privacy regulations explicitly invalidate consent obtained through dark patterns. A recommendation that increases conversion and creates enforcement exposure is a bad recommendation.

**The framing to use in output:** design so that the interests of the product and the user point the same direction, then remove friction from that path. Every mechanism in 3.1 through 3.7 works better when the underlying value is real, because manipulation raises short-term metrics while degrading the retention curve it was meant to fix.

### 3.9 Applying this to SecureVibe itself

The product is subject to its own standards, and the report should be able to survive being run against the product that produced it.

- **Time to first value:** a user pastes a repository URL and sees a real finding with a real citation before any account exists. Signup gates the full report and the history, never the first finding.
- **The aha moment:** the first finding the user recognizes as true and had not articulated. Design the ordering of findings to put the most recognizable one first rather than the most severe one, and say so in the interface.
- **Investment:** saved scans, tracked repos, a diff between runs. A user who has scanned the same repo six times has a record nobody else holds.
- **The genuine peak:** the copy-pasteable fix prompt that works on the first try. That is the moment worth engineering above all others.
- **The ending:** the state after the user applies fixes and rescans. Score movement is the ending of the loop, so make it explicit, specific, and attributable to what they changed.
- **Natural frequency:** repository scanning recurs at the rhythm of shipping, which is weekly for active projects. Do not build daily-habit mechanics on top of a weekly-frequency problem. Build the weekly loop well and add CI integration for the users whose frequency is genuinely higher.
- **Honesty as positioning:** publish the methodology, publish the anti-heuristic list from 1.11, and publish the false-positive rate. A scanner that admits what it cannot detect is more credible than one that claims completeness, and the admission is cheap because competitors will not match it.

---

## PART 4: OUTPUT CONTRACT

### 4.1 Finding schema

Every finding serializes to this shape. The scanner produces the fields deterministically wherever possible and uses a model only for the fields marked as generated.

```json
{
  "id": "craft.tokens.no_theme_extension",
  "layer": "A",
  "axis": "craft",
  "severity": "high",
  "confidence": "confirmed",
  "title": "Your design system is the framework's defaults",
  "evidence": [
    { "path": "tailwind.config.ts", "line": 4, "excerpt": "theme: { extend: {} }" },
    { "path": "src/components/Hero.tsx", "line": 22, "excerpt": "className=\"bg-blue-600 ...\"" }
  ],
  "metric": { "default_utility_ratio": 0.94, "sample_size": 118 },
  "explanation": "<generated, 2 to 4 sentences, must name the mechanism>",
  "impact": "<generated, 1 to 2 sentences, tied to a user or revenue consequence>",
  "fix_prompt": "<generated, copy-pasteable, self-contained>",
  "principle_refs": ["2.2", "2.3", "2.10"],
  "score_delta": -14
}
```

### 4.2 The fix prompt template

This is the product. Everything else is the setup. A fix prompt fails if the user has to edit it before pasting.

Requirements for every generated fix prompt:

1. **Self-contained.** It names the files, the current state, and the target state without assuming the agent has seen the report.
2. **Specific to this repo.** It cites the actual file paths and actual current values found during the scan. Generic advice is what the user could have gotten free.
3. **Constrained.** It states what must not change, because the most common failure of a fix prompt is an agent rewriting far more than intended.
4. **Verifiable.** It ends with a check the user or agent can run to confirm the fix landed.
5. **Principled, not prescriptive about taste.** It gives the rule and the reasoning, and leaves the aesthetic decision to the user where a decision exists. Where the fix has one correct answer (a missing label, a removed focus style), state the answer.

Template:

```
CONTEXT
This repository currently <specific current state with file paths and values>.

PROBLEM
<the mechanism, one or two sentences, from Part 2>

TASK
<numbered, bounded steps against named files>

CONSTRAINTS
- Do not change <the things that must stay stable>.
- Keep all existing behavior and routes identical.
- <any repo-specific constraint detected during the scan>

DECISIONS FOR ME TO MAKE
<where taste is involved, list the two or three real options with their tradeoffs, and ask before proceeding>

VERIFY
<the specific check: a grep, a test, a visual condition>
```

### 4.3 Report structure

Order findings by recognizability first, then severity. The first finding a user reads must be one they will immediately recognize as true, because the first finding determines whether they believe the rest.

1. **Headline verdict.** One sentence naming what the repo reads as. Written plainly, never numerically.
2. **The two scores,** each led by its percentile and cohort per 3.7, with one line on what moves it and what the next band costs.
3. **The three findings that matter most,** in full, with fix prompts.
4. **Everything else,** collapsed by layer, expandable.
5. **What we did not check,** stated explicitly. This is a trust asset per 3.5.

### 4.4 Voice rules for generated text

The report must read as if a senior design engineer wrote it after twenty minutes with the codebase. Enforce these as a post-generation filter and reject output that violates them.

- No superlatives and none of the terms in the F2 list. The tool cannot flag a word it uses itself.
- No em-dashes and no semicolons. Short declarative sentences. Active voice.
- No hedging stacks. State the finding, then state the confidence separately as structured data rather than as prose qualifiers.
- No apologizing for the finding, and no softening preamble before criticism.
- Never criticize a hue, a typeface by name, a framework, or a library. See 1.11.
- Never compare the repo to a named company's product. See 1.11 rule 8.
- Name the mechanism, never only the rule. "This violates Fitts's law" is a linter. "The tap target is 18px inside a 48px row, so the row looks tappable and only the icon is" is analysis.
- Address the reader as the person who built it, with the assumption they are capable and shipped fast on purpose.
- One finding per finding. Do not bundle three observations into one paragraph to inflate perceived depth.

---

## PART 5: IMPLEMENTATION NOTES

### 5.1 Pipeline

Run these stages in order. Every stage is deterministic except stage 5, and stage 5 is constrained to per-signal binary judgments with mandatory citation.

1. **Fetch.** Clone at depth suitable for history analysis. Enforce a size cap and a file-count cap, and fail loudly rather than silently truncating.
2. **Classify.** Identify framework, styling system, router, package manager, and whether the repo is an application, a library, a template, or a tutorial. Libraries and tutorials get a different rubric or get declined. A CLI tool has no craft score, so say so rather than inventing one.
3. **Parse.** Build ASTs for source files. Do not use regular expressions for anything structural. Regex is acceptable only for copy analysis and for scanning history metadata.
4. **Deterministic detection.** Run every signal in Part 1 that can be computed from parsed structure. This produces the bulk of findings and all of the confirmed-tier ones.
5. **Model-assisted detection.** For signals requiring judgment (copy voice, empty-state quality, whether an animation carries meaning), call the model with a single named signal, a definition, the relevant source excerpt, and a required structured verdict of yes, no, or insufficient evidence, plus a cited excerpt. One signal per call. Never ask for a score. Never ask an open question.
6. **Suppression.** Apply every anti-heuristic from 1.11 and drop uncited findings per 1.12.
7. **Score.** Compute in code from the finding set. See 5.3.
8. **Generate.** Produce explanation, impact, and fix prompt per finding, then run the 4.4 language filter and regenerate anything that fails.
9. **Order and render.** Per 4.3.

### 5.2 File targets

| Target | What to extract |
|---|---|
| `package.json` | dependencies, whether every listed package resolves on the registry (slopsquatting check), scripts, presence of test and lint tooling |
| lockfile | resolution integrity, whether the lockfile is committed at all |
| `tailwind.config.*` or `@theme` block | theme extension contents, plugin list |
| global CSS entry | custom properties, font imports, reset, reduced-motion queries |
| component files | className extraction, state branches, interaction handlers, semantic elements, aria attributes |
| route and page files | section composition, sequence classification for E1 |
| `error.tsx`, error boundaries | presence, per B6 |
| `.env*`, config files | committed secrets, per exposure score |
| `README.md` | emoji density, placeholder language, whether it documents the product or the framework starter |
| `.github/workflows` | CI presence, whether anything runs on pull requests |
| git history | co-author trailers and bot signatures for provenance context only, commit message patterns, whether history is a single initial commit |

### 5.3 Score computation and bands

Compute craft as a weighted deduction from a 100 base, using the layer weights in 1.3, with two overrides.

**Floor override:** if any Layer G item in the load-bearing set fails, cap craft at 60 regardless of the deduction total. State the cap explicitly in the report rather than hiding it in the number.

**Cluster amplification:** signals within one layer are correlated, so summing them independently over-penalizes. Within a layer, apply the full weight to the strongest firing signal and half weight to each additional one. Across layers, sum normally. This prevents a repo from being penalized six times for one underlying cause and is the main defense against the opposite failure of the current scanner.

Bands, derived from the pair:

| Craft | Exposure | Verdict |
|---|---|---|
| 80+ | 80+ | Built with judgment. Findings are refinements. |
| 80+ | under 60 | Looks finished, is not safe to ship. |
| 55-79 | any | Real work with unfinished edges. Named gaps, mostly in state coverage. |
| 30-54 | any | Reads as generated. The interface has a type scale and no point of view. |
| under 30 | any | Unreviewed output. Nobody has looked at this after the model produced it. |

Never show a bare number without the sentence. A number invites argument. A sentence with three cited findings under it does not. Present the band alongside the percentile position described in 3.7, since the band names what the repo is and the percentile names where it sits.

### 5.4 The language filter

Run every generated string through a rejection filter before it reaches the user.

Reject and regenerate on: any F2 list term, any em-dash, any semicolon, any sentence naming a color word as a criticism, any sentence naming a typeface or framework as a criticism, any comparison to a named company product, any apology, any sentence over 30 words, any paragraph over 4 sentences, any use of "simply", "just", or "obviously" when describing a fix.

Implement the filter as code with a deterministic term list rather than as a model check, since a model asked to check its own output for these terms passes text that contains them.

### 5.5 Using the model without inheriting its generosity

The core problem stated in 0.1 reason 2 needs specific countermeasures in the prompt layer.

- **Never request a score, a rating, a grade, or a quality judgment.** Only binary or ternary verdicts on defined signals.
- **Require a citation with every positive verdict.** No citation, no finding.
- **Define each signal with a negative example as well as a positive one.** Include a case that looks like the signal and is not, drawn from 1.11.
- **Ask for the absence, not the presence, where possible.** "Does a branch exist that renders when this collection is empty? Yes, no, or cannot determine." is a far more reliable question than "is this component well designed?"
- **Run the adversarial pass.** After findings are assembled, run one pass whose only job is to argue against each finding using the anti-heuristic list, and drop findings that lose. Report the drop rate internally as a health metric.
- **Never let the model see the running score.** Score computation happens in code after all verdicts return.

### 5.6 Calibration corpus

Build this before tuning any weight. Twenty repositories, hand-labeled.

- Ten known unreviewed-generation repos. Source from prompt-to-app platform exports, hackathon submissions with single-commit histories, and public template forks with no subsequent design commits.
- Ten known craft repos. Source from teams with published design systems, from projects with design-focused commit history, and from repos where the interface is the product.
- Include four deliberate traps: a craft repo with a purple brand, a craft repo built on shadcn defaults with heavy customization, a generated repo with a beautiful README, and a craft repo with a `CLAUDE.md` and co-author trailers throughout.

Requirement: no weight change ships unless the two clusters stay separated by at least 25 points of craft score and all four traps land on the correct side. Run this as a test in CI.

### 5.7 Exposure score checks

Keep this deliberately narrow in v1 and lean on established tooling rather than reimplementing it. The score exists to make the craft score credible and to give security-minded buyers a reason to trust the tool, not to compete with dedicated scanners.

Prioritize by what the research in 1.2 says actually goes wrong in generated code:
- **Hallucinated and slopsquatted packages.** Resolve every dependency against the registry, and flag any package created within the last 90 days with low download counts that closely resembles a popular name. This is high signal, cheap, and directly grounded in the 20% figure.
- **Committed secrets.** API keys, tokens, `.env` files in history, service account JSON. Check history rather than only the working tree.
- **Authentication and authorization gaps.** Per the Georgia Tech guidance, weight input handling and authentication above everything else. Route handlers with no auth check, client-side-only access control, and object references with no ownership verification.
- **Privilege escalation and architectural exposure,** which the CSA data shows rose 322% and 153% respectively. Detectable proxies: service-role keys used in client-reachable code, database access without row-level security, and admin routes distinguished only by an unguarded path.
- **Injection surfaces.** Unparameterized queries, unsanitized HTML insertion, unvalidated redirects.
- **Operational and packaging exposure,** which the VibeGuard work names as under-studied and which generated code produces frequently: overly broad file inclusion in published packages, permissive CORS, debug flags left on, source maps shipping to production.

Do not report a CVSS score. Report the specific exposure, the file, and the fix.

### 5.8 Build order

1. Deterministic Layer A and Layer B detection, since together they carry 42% of the craft score and produce the most convincing findings.
2. The fix prompt generator with the 4.4 filter, because that is the peak moment from 3.9 and it should be excellent before anything else is broad.
3. The calibration corpus and the CI test from 5.6.
4. Layers C, G, then F. Layer G is nearly all deterministic and cheap.
5. Exposure score, narrow scope per 5.7.
6. Layers D and E, which need the most model assistance and produce the most false positives, so they ship last.

### 5.9 Deliberately out of scope for v1

- Live website scanning. Fetching arbitrary user-supplied URLs means rendering hostile pages. When it ships, it ships behind a sandboxed renderer with no credential access and a domain policy.
- Screenshot-based visual analysis. High value and high cost. It becomes the strongest version of Layer E and it needs a rendering pipeline the product does not have yet.
- An MCP server. The right eventual shape, since a scanner that runs inside the user's agent loop is worth more than one they visit. Prompts first, because the fix prompt is the thing users will share, and shareability is the acquisition channel.
- Private repositories. They need an installation-scoped GitHub App and a data retention policy stated before the first private scan, not after.
