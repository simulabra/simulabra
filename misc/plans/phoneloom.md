<ProjectTitle>
SIMULABRA SWYPERLOOM
</ProjectTitle>
<ProjectDescription>
SIMULABRA SWYPERLOOM is a mobile loom - a branching text completion interface for a pretrained large language model. For an example, see `demos/loom.js` which implements the idea in a traditional desktop interface.
</ProjectDescription>
<Platform>
- Pure mobile web application (not PWA, not native)
- Requires connection to llama.cpp server
- Mobile-first responsive design
</Platform>
<Architecture>
- Shared core with desktop loom.js: abstract LLM interaction and tree data structures into a shared library
- Separate mobile UI implementation optimized for touch interaction
- Reuse: LLM client, tree/node model, completion logic
- New: touch gesture handling, mobile layout, SWYPER component
</Architecture>
<UIOverview>
- Top bar: menu with other stories, title
- Top half of screen: text that is being completed, anchored to the end, surrounded in an ornate frame
- Middle bar: horizontally scrolling logprobs (top 20) that can be tapped to insert
- Bottom (SWYPER): pie menu inspired loom interface, with thumb target in middle and 4 completion choices in the 4 corners of the area
- Bottom bar: respin threads, undo/redo, upload image
</UIOverview>
<VisualDesign>
- Ornate frame: Medieval/manuscript aesthetic
  - Gold leaf style borders
  - Illuminated manuscript decorative elements
  - Parchment texture background for text area
- Consider dark mode variant with inverted aesthetic
</VisualDesign>
<LogprobsBar>
- Display raw tokens with probability values, e.g., " the" (0.23)
- Horizontally scrollable, ordered by probability (highest first)
- Tap to insert that token at cursor position
- Consider visual indication of relative probability (subtle background gradient or bar)
</LogprobsBar>
<LLMs>
- use llama.cpp server backend that `demos/loom.js` is using for now with same image upload logic
 - bonus: encapsulate wrappers into llm library that can be shared between them
- server is running Ministral 3 14B Base, a vision language model
- future version may have hosted model with custom features but keep it simple for now
</LLMs>
<Swyping>
- starts when press begins in the thumb target
- if release in thumb target: do nothing
- if outside target, inside swyper area: insert appropriate text and respin
- if pointer goes outside swyper area: cancel swipe entirely (no action, return to neutral)
</Swyping>
<SwypeChoices>
- Each corner displays a multi-token continuation (not single tokens)
- Continuation length is user-configurable via settings:
  - Short: 1-3 tokens (word-level, fast)
  - Medium: 5-15 tokens (phrase-level)
  - Long: full sentence/paragraph
- All 4 choices are generated in parallel from the same context
- Show all text in corner, reducing size to fit, up to max ~200 characters
- Hovering over a choice shows the completion previewed in the text in a lighter color
</SwypeChoices>
<TextArea>
- long press to edit
  - press anywhere outside to stop editing
- show preview of hovered completion
- scroll up, snap down
</TextArea>
<RespinBehavior>
- "Respin threads" regenerates all 4 corner choices
- Keeps the same story context, generates 4 new alternative continuations
- Uses same temperature/sampling settings
</RespinBehavior>
<StoryModel>
- Full tree structure (like desktop loom)
- Each choice creates a branch point in the tree
- User can navigate back to any previous branch point
- Undo/redo operates on the current linear path through the tree
- Stories saved to localStorage with full tree structure
</StoryModel>
<ImageIntegration>
- Single context image at a time (replace, not accumulate)
- Image sets visual context for all subsequent completions
- Upload via bottom bar button
- Image thumbnail shown somewhere in UI to indicate active context
- Clear image option to return to text-only mode
</ImageIntegration>
<Testing>
- Use playwright with isMobile for device emulation
- Mock LLM server
- Cover all functionality in this document
</Testing>
