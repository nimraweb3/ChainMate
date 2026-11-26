# User profiles

Settings persist username, display name, biography, optional country, profile privacy, wallet visibility, board finish, sound preference, in-app notification preference and preferred chain in D1. Username changes are blocked during an active match. The dashboard and profile use actual match history and current rating; category rating records and first-game/first-win achievements are earned from server-completed matches.

Avatar and banner uploads have an interactive browser crop/zoom preview. Browser canvas converts JPEG/PNG/WebP input to bounded JPEG dimensions. The Worker independently checks content type, magic bytes, size and decoded dimensions, then decodes/re-encodes the image to remove metadata and invalid content. R2 keys are randomized. Uploads require authentication and are rate limited. Replacing an image removes the previous object. Controlled reads honor current profile privacy and reject old keys. Public wallets require an explicit visibility choice.

Profile privacy hides profile details, images and public finished-game access. Match participants retain access to their own match records. Historical chess records remain for opponents and ratings after account deletion. Tournaments and on-chain badge minting are still unavailable; tables do not imply an implemented tournament organizer.
