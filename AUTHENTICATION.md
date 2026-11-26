# Authentication

Email/password accounts use salted scrypt hashes, unique case-insensitive usernames/emails and opaque random sessions stored as SHA-256 hashes in D1. Sessions expire in seven days, rotate on login and password changes, use HttpOnly/SameSite=Strict cookies, and become Secure on HTTPS. Mutations require the exact request origin. Rate limiting is persisted in D1; ordinary session reads do not consume the authentication-attempt quota.

SIWE checks supported chain, exact domain and URI, issued/expiry times, a five-minute one-use nonce, signature and challenge/session binding. A separate HttpOnly nonce cookie binds the challenge to the browser. Connecting a wallet is not authentication. Signed ownership links a wallet to the current account; a wallet already linked to another account is rejected. Multiple wallets are supported; the last verified wallet becomes primary. Wallet addresses are private by default.

Password recovery returns a generic existence-independent message when configured. Local reset/verification links go to the local D1 `mail_outbox`; no mail is sent. Production requires a verified Resend sender and API key. Email verification is optional and visible in settings. Password changes revoke other sessions. Deletion requires the current password or a recently authenticated wallet-only session and is blocked during an active game.

The current implementation has no OAuth provider, passkeys, MFA, abuse-review console or email-delivery retry queue. Account recovery for lost wallet-only credentials is deliberately not fabricated.
