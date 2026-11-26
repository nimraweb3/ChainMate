# The playing room

The playing room uses the supplied mobile reference as visual direction: a soft gray-blue surface, compact player headers, a large square board, restrained cyan highlights and quiet controls. All piece art is original SVG. No Dribbble assets were copied.

## Appearance

`/settings/board` offers 16 categorized palettes and eight independent piece collections. Preview moves, captures, checks, promotion, castling and en passant without changing a real game. Themes are shared by games, replay, the homepage preview and `/learn/pieces`. Coordinates, move/check highlights, animation, orientation, texture, border, background, volume and stronger piece outlines are configurable. Custom square colors require at least 1.25:1 relative luminance contrast to save; the UI warns below 1.5:1. Piece outlines remain present.

Guest settings use guarded local storage. Account settings use D1 `user_experience`. Signing in activates the account palette and offers the guest palette as an explicit preview in Board Studio; it never silently replaces account settings. In-game changes apply immediately and save in sequence, with an error if synchronization fails. Appearance is absent from chess state and contract calls.

## Game interface

Player headers show available profile avatars/ratings and actual WebSocket presence; private or unavailable profiles fall back to initials. Local clocks interpolate authoritative snapshots. Custom controls allow 1–180 minutes and 0–180 seconds increment in the Cloudflare runtime. Captured material uses the chosen SVG collection. Move review clearly shows the historical position and offers Return to Live Position while the server clock keeps running. Arrows are permitted in local practice, completed games and replay, not active human games. Mobile chat includes a clock summary and close control.

Original Web Audio tones distinguish moves, captures, castling, check, game end, chat, reactions and low time. Audio is unlocked only after interaction, supports volume/mute and respects reduced feedback. CSS animations respect reduced motion.

## Communication and privacy

Chat uses the existing hibernating GameRoom Durable Object, with a separate event branch that never calls move/tick/persist. Messages are stored separately in D1 and delivered only to authenticated participants. Sender identity comes from the session, never a supplied sender ID. Each send has a UUID idempotency key; acknowledgments and retry states use that same key. Reconnection restores up to 100 recent messages. Bot games never fabricate human chat.

Text, categorized quick messages, eight saved favorites, and ten searchable reactions share server validation. Limits: 500 characters, six send attempts per ten seconds per player/room, duplicate-text suppression for ten seconds, link rejection, control-character rejection, and an optional basic language filter. React renders text without HTML parsing. Filtering is a convenience, not comprehensive moderation.

Privacy applies on the server to both sides. Nobody, either-direction blocks, or either participant's mute disables messaging. Requests-only requires the recipient to accept the opponent. Friends-only requires both participants to add each other. Reactions require both players to permit them. Consent and friend controls are scoped to the opponent's account, not merely a hidden input. Session validity is checked before broadcasting.

Reports persist in the indexed `chat_reports` queue and create an audit record. Operators must review pending reports and establish a staffed escalation process before a broad launch; this build does not claim automated adjudication or send reports to an unconfigured external service. Chat messages expire after 30 days; reports/reasons expire after 90 days. The existing five-minute scheduled job enforces deletion. Reports reference message IDs without retaining a second copy of expired messages. Account deletion removes authored messages, appearance, learning progress, blocks and permissions. Chat and reports never enter PGN hashes or blockchain data.

## Learning

`/learn/pieces` provides all six pieces, legal-move demonstrations and a target exercise per lesson. The king exercise explicitly includes an attacking rook so moving into check is rejected. Chess.js validates every attempt. Guests keep progress locally; signed-in users persist completed lessons in D1. Account progress remains separate from guest progress.

## Runtime and deployment

Migration `0002_experience.sql` adds only D1 tables/indexes; it does not replace existing records. Apply locally and remotely before publishing the new Worker. These services target the Cloudflare runtime at port 8787. The legacy Node runtime retains its existing features but does not implement the new D1 chat/experience APIs.

The existing limitations still apply: public-testnet escrow and production email require configuration, Mainnet financial mode stays disabled, and the pre-existing WalletConnect dependency advisory remains tracked in VERIFICATION.md. The new chat features are not a substitute for anti-cheat review or independent security assessment.
