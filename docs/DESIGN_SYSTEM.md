# Design system

Near-black `#08090B`, elevated charcoal `#121416`, pearl `#F1F0EE`, muted silver `#9B9FA3`, hairline borders `#2A2D30`. Copper and cyan appear primarily in the original sculptural artwork. The light product theme uses pearl backgrounds and dark slate text. The homepage deliberately retains its art-directed black and pearl sections in either preference.

Locally bundled Manrope is used for both oversized editorial headings and interface text. Monospace is reserved for clocks and identifiers. Display type uses controlled negative tracking and added word spacing. Pill actions, thin separators, restrained glass controls and asymmetrical compositions carry through the homepage, play chooser, bot selector, match, profile, authentication and wallet interfaces.

The original hero, gallery and three bot sculptures were generated for ChainMate; see ARTWORK.md for briefs and asset inventory. The reference screenshots are not shipped. There are no invented player counts, rankings or transactions. Club standings read the API and have an honest empty state. The homepage board accepts legal moves from both sides without loading Stockfish; full bot matches run the real engine.

The hero camera uses one requestAnimationFrame-coalesced scroll transform and stops under reduced motion. The page is fully useful without motion. Responsive compositions are verified from 320 to 1920px; mobile navigation collapses, mode controls become a 2×2 dock, bot tiles become portrait rows, and the game board appears before the supporting panel. Native dialogs handle focus containment and Escape. Visible focus, labeled fields, a skip link and typed chess moves supplement pointer interaction.

Implementation: `apps/web/src/redesign.css` is the new shared visual layer over the existing structural styles. Frontend pages retain their API, socket and wallet integrations. No video generation or continuous rendered camera flight is claimed.
