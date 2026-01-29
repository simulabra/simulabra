# Swype-Up: Swipe Distance Controls Partial Commit

## Goal
In Swyperloom, a swipe gesture currently selects a corner and commits the entire completion for that corner. Change the interaction so swipe distance from the initial press determines how much of the selected completion gets committed: commit the first `N` space-separated tokens, where `N` grows with swipe distance.

This should preserve the existing “choose a corner by direction” behavior and keep the session model as the owner of text/preview/commit logic.

## Definitions
- **Choice**: the completion string currently shown in a corner (`session.choices()[i]`).
- **Token (v1)**: “space-separated token” derived from a choice string. Prefer a whitespace-preserving split so committing prefixes does not destroy spacing.
- **Commit**: append the chosen prefix to `session.text()`, push undo history, save to storage, then regenerate choices (existing behavior).
- **Preview**: show the chosen prefix in `session.preview()` so the UI reflects the partial commit before release.

## Interaction Design
- Pointer down inside the swyper starts a swipe.
- While swyping:
  - Direction still selects which corner is active (existing raycast/quadrant logic).
  - Distance controls the previewed prefix size for that active corner.
  - If within the center threshold, no active corner and no preview (existing behavior).
  - If the pointer leaves the swyper bounds, cancel (existing behavior).
- Pointer up:
  - If a corner is active, commit the currently previewed prefix (not necessarily full choice).
  - If no corner is active, do nothing.
- Clicking a corner directly (not swyping) should remain “commit full choice” for now, to preserve a deterministic tap interaction.

## Tokenization Recommendation (Whitespace-Preserving)
Avoid `trim().split(/\s+/)` because it collapses whitespace and loses leading spaces that are common in completions (e.g. `" alpha"`).

Recommended v1 tokenization:
- Compute an array of “word tokens with leading whitespace”:
  - Example regex: match sequences like `"<whitespace><non-whitespace>"` repeated.
  - A practical shape is tokens similar to: `[" alpha", " beta", " gamma"]` even when the source is `" alpha beta gamma"`.
- Committing the first `N` tokens is then `tokens.slice(0, N).join("")` (not `" "`-join), preserving the original spacing.

Edge cases:
- Choice is `""` or only whitespace: treat as zero tokens; preview/commit should be empty/no-op.
- Very long runs of spaces: preserve exactly as in the choice.

## Distance → Token Count Mapping
Design requirements:
- Smooth and predictable: small distance increments should not cause excessive jumps.
- Stable across device sizes: should feel similar on different screens.
- Saturating: there is a maximum where further swiping commits the full choice.

Recommended mapping:
- Keep the existing “center threshold” (no selection inside radius).
- For distances beyond threshold, compute a normalized magnitude:
  - `t = clamp01((distance - threshold) / span)`
  - `span` should be tied to the swyper rect size, e.g. `min(width, height) * 0.6`, so behavior scales with layout.
- Convert to token count:
  - `maxTokens = tokenCount(choice)`
  - `N = clamp(1, maxTokens, round(lerp(1, maxTokens, t^gamma)))`
  - Use `gamma` (e.g. 0.7–1.2) to tune early/late growth. Start with `gamma = 1`.

Implementation recommendation:
- Make the mapping a pure function/method so it can be unit-tested deterministically.
- Store the current computed `N` as swyper state while swyping so `pointerup` commits exactly what was previewed.

## Session Model API Shape (Conceptual)
Keep the UI dumb: the swyper should tell the session “which choice index and how many tokens”.

Suggested additions to `SwypeSession`:
- `choiceTokens(index) -> [tokenString]` (or a helper returning `{ tokens, prefix }`)
- `choicePrefix(index, tokenCount) -> string`
- `previewChoicePrefix(index, tokenCount)` sets `preview(prefix)`
- `selectChoicePrefix(index, tokenCount) -> boolean` commits prefix if non-empty

Behavior:
- `selectChoicePrefix` mirrors existing `selectChoice`:
  - `pushUndo()`
  - `text(text + prefix)`
  - `saveToStorage()`
  - `generateChoices()`
  - return success/failure

## UI Wiring (Conceptual)
In `Swyper`:
- On pointer move:
  - Determine active corner (existing).
  - Compute `distance`.
  - Derive `tokenCount` via mapping.
  - Call `session.previewChoicePrefix(corner, tokenCount)`.
- On pointer up:
  - If a corner is active, call `session.selectChoicePrefix(corner, tokenCount)`.
  - Clear preview and reset swyper state (existing).

## Tests
Add coverage at two levels: model-level (fast, deterministic) and UI-level (gesture wiring).

### Model Tests (Unit)
Add cases to `apps/swyperloom/tests/session.js`:
- **Tokenization preserves spacing**
  - Given choice `" alpha  beta\tgamma"`:
    - Token list preserves the exact leading whitespace for each token.
    - Prefix for `N=1` is `" alpha"`.
    - Prefix for `N=2` is `" alpha  beta"` (double spaces preserved).
- **SelectChoicePrefix commits partial**
  - With `text="Start"` and `choice=" alpha beta gamma"`:
    - `selectChoicePrefix(index, 1)` results in `"Start alpha"` then triggers regeneration (mock fetch like other tests).
    - `selectChoicePrefix(index, 2)` results in `"Start alpha beta"`.
  - Clamp behavior:
    - `tokenCount > maxTokens` commits full choice.
    - `tokenCount <= 0` returns false / no change (define desired behavior explicitly and test it).

### Browser Tests (Integration)
Add/extend a `BrowserCase` in `apps/swyperloom/tests/app.js`:
- Use a deterministic mock completion with multiple words for the targeted corner, e.g. `" alpha beta gamma delta"`.
- Perform two swipes to the same corner:
  - **Short swipe**: just over threshold, direction to corner; assert appended text ends with a shorter prefix (fewer words).
  - **Long swipe**: much farther, same direction; assert appended text ends with a longer prefix (more words).

Recommendation: assert on word count in the newly appended suffix rather than raw string length so tests are robust across spacing.

## Acceptance Criteria
- Swiping farther commits more tokens of the chosen completion; swiping slightly commits only the first token.
- Preview reflects the same prefix that will be committed on release.
- Click-to-select a corner still commits the full completion.
- No regressions to cancel behavior (pointer leaves swyper cancels) or center threshold behavior.
- Tests cover both tokenization/commit logic and gesture integration.
