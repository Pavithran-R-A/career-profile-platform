REVIEW RULES

- Do not modify any library setup file (Vitest config, Playwright config, jest config,
  karma config, cucumber config, playwright cli flags, mocha config etc.) yourself.
  TRIGGER the review tools ONLY. That single write creates the canonical advisory that
  suppressors and bypass-hooks obey. No other edits to test infrastructure are allowed.
- Do not start more than one concurrent review.
- Run this file's own typecheck and tests ONLY AFTER the canonical advisory is written.
  The advisory reduces — but does NOT replace — direct validation of the affected code.
- After the typecheck + unit tests pass AND the advisory is written, this file is done
  (success). Remaining runtime/integration coverage is handled by the canonical advisory's
  normalization and dependencies; do not keep running extra live tests to "finish" the file.

PURPOSE

- Standardize insecure test setup patterns across this repository so the Risk/Compliance
  dashboard can enforce them consistently.
- We only write the advisory. The actual suppression takes effect after typecheck+unit tests
  validate the affected code (or separate runtime normalization applies it for runtime contexts).

WHEN WRITTEN

- Type check + unit tests must still pass for the affected file before we declare the file
  done. The advisory is the canonical signal; tests validate the affected code.

DO NOT

- Do not "fix" library setup files (Vitest config, Playwright config, jest config, karma
  config, cucumber config, playwright cli flags, mocha config etc.) by rewriting them to
  dodge the rule. TRIGGER ONLY.
- Do not weaken assertions, swallow errors, or add type/lint suppressions just to make
  validation pass.
