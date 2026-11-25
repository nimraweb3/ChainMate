# Cinematic homepage / supplied lets-scroll skill

The user supplied `C:/Users/USER/Downloads/SKILL.md` (`lets-scroll`). It was read in full. Its `references/` files were not supplied. The project brief overrides the default paid generation pipeline: first build a free original CSS/SVG experience, then optionally enhance with approved media.

The subsequent premium frontend redesign supersedes the initial CSS/SVG hero with original generated still artwork: a chrome knight hero, pearl gallery and three opponent sculptures. Scroll-linked camera movement remains coalesced through requestAnimationFrame with a reduced-motion fallback. Responsive still crops, gallery variants and lazy loading preserve a usable static composition. See ARTWORK.md. This is not a generated continuous video flight. No video generation has been purchased or claimed. The future-video notes below are an optional handoff, not a description of shipped media.

Future camera: architecture A, continuous forward walkthrough. Four sequential clips; no separate aerial connectors. Preserve the shared palette and use the _actual last frame_ of each rendered leg as the start frame of the next. Verify both composition and forward velocity before continuing. Never substitute the original concept still for a rendered boundary.

| Prompt               | Conditioning frame                        | Intended output | Status      |
| -------------------- | ----------------------------------------- | --------------- | ----------- |
| prompts/world.txt    | approved opening still, not yet generated | world.mp4       | ungenerated |
| prompts/rivals.txt   | actual world.mp4 final frame              | rivals.mp4      | ungenerated |
| prompts/arena.txt    | actual rivals.mp4 final frame             | arena.mp4       | ungenerated |
| prompts/identity.txt | actual arena.mp4 final frame              | identity.mp4    | ungenerated |

Desktop specification: 16:9, native 1080p, approximately 8 seconds per leg, no text or audio. Generate the four stills consistently before rendering clips. If a native 9:16 mobile chain is later requested, obtain its separate budget approval; never silently crop the landscape film and describe it as a mobile-native render.

Encoding: H.264 yuv420p, CRF 20, GOP 8, faststart, strip audio. Do not upscale. Optional mobile chain: 720px wide, CRF 23, GOP 4. Frame extraction must choose the actual final decoded frame, not an arbitrary near-end timestamp.

Future playback acceptance: posters remain until the video paints; decode/seek errors retain static art; fetch bounded nearby clips as blobs for seekability; revoke object URLs; coalesce seek requests; pause on hidden documents; respect reduced motion; no blank startup; no resize jump when mobile address bars collapse. Validate each seam forward and backward with actual screenshots before marking media accepted.

Budget, provider capabilities, licensing, and user approval must be rechecked before any paid generation. The manifest intentionally has null media paths, so no broken requests ship.
