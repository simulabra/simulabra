# SwypeLoom

Mobile-optimized loom interface for LLM text generation with swipe-based token selection.

## Testing

Run tests with:
```
bun run test-swyperloom
```

## Configuration

Default provider is Hyperbolic (https://api.hyperbolic.xyz) with meta-llama/Meta-Llama-3.1-405B.
API key and server URL are configurable in Settings (hamburger menu).

## Development

HTML entry point: `index.html`
Build with: `bash build.sh` (outputs to `out/swyperloom/`)
