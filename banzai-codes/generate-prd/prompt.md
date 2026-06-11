You are documenting an existing application as a Product Requirements Document (PRD). The
repository is checked out in your working directory. The PRD describes how the product
**currently works** — it is consumed by an LLM during product refinement sessions, so new
feature requests can be grounded in the application's existing behavior.

## Your task

Explore the codebase thoroughly before writing anything: entry points, navigation/routes,
domain models, user-facing flows, integrations, and configuration. Then create or update
the PRD under `{{OUTPUT_DIRECTORY}}/`:

- `{{OUTPUT_DIRECTORY}}/index.md` — the product overview: what the product is, who it is
  for, and a table of every feature area with a one-line description and a relative link
  to its file.
- `{{OUTPUT_DIRECTORY}}/<feature-area>.md` — one file per feature area, named in
  kebab-case (for example `account-overview.md`, `onboarding.md`).

## Per-file template

Each feature-area file uses exactly these sections:

```
# <Feature area name>

## Problem Statement
The problem this feature solves, from the user's perspective.

## Solution
How the product solves it today, from the user's perspective.

## User Stories
A LONG, numbered list covering all aspects of the feature, each in the format:
1. As an <actor>, I want <a capability>, so that <benefit>
Example: As a mobile bank customer, I want to see the balance on my accounts, so that I
can make better informed decisions about my spending.

## Current Behavior
What the feature does today: states, rules, defaults, validation, error handling,
permissions — described as observable behavior.

## Key Flows
Step-by-step descriptions of the main user journeys through the feature.

## Out of Scope
Adjacent concerns this feature deliberately does not handle.

## Further Notes
Anything else worth knowing (known limitations, behavioral quirks, dependencies on
other feature areas).
```

## Writing rules

- Do NOT include file paths or code snippets — they go stale quickly. Describe behavior
  and contracts, not implementation.
- Each file must be self-contained: restate any needed context, define product
  terminology on first use, and never write "see above". Cross-reference other feature
  areas by their PRD file name only.
- Use the exact section headings from the template so files stay diffable across updates.
- Aim for 100–300 lines per file. Split a feature area in two rather than exceeding that.
- Describe what IS, not what should be. If behavior looks unfinished or inconsistent,
  record it factually under Further Notes.

## Incremental updates

If `{{OUTPUT_DIRECTORY}}/` already exists:

- Read every existing file first.
- Preserve existing file names and structure. Update only statements the codebase
  contradicts, and fill gaps the codebase reveals.
- Add new files for feature areas that are not yet documented. Delete a file only when
  its feature no longer exists in the product.
- Always regenerate `index.md` so it exactly matches the set of feature-area files.

## Boundaries

- Modify files ONLY inside `{{OUTPUT_DIRECTORY}}/`. Do not touch any other path, and do
  not run formatters, builds, or tests.
- Do not commit, branch, or push — the workflow handles git.

When you are done, reply with a one-paragraph summary of what you created or changed.
