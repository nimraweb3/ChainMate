# Multiplayer protocol

HTTP creates and joins challenges. Socket authentication uses the same expiring opaque session as HTTP. Initial browser polling validates a same-origin Referer when Origin is absent; WebSocket upgrades carry Origin. No client-supplied user ID is trusted.

- `game:join {id}`: verify membership, subscribe and return canonical state.
- `move:submit {id,from,to,promotion,revision}`: validate payload, ownership, turn, revision and legal move; persist; broadcast `game:state`.
- `game:action {id,action}`: resign, offer/accept/decline draw. Draw acceptance requires the other participant's current offer.
- `queue:join {control,rated}`: one entry per user, compatible controls, rated strength window expands with wait duration.
- `queue:leave`: remove entry.
- `match:found`: deliver the persisted match to paired sockets.

Acknowledgements use `{ok:true,value}` or `{ok:false,error}`. A duplicate revision is explicitly rejected rather than executing twice. Reconnect requests full state. Game changes are serialized in one API process; terminal state and Elo are committed transactionally, with `rated_applied` as an idempotency guard. No bot result updates club ratings.

Open challenges expire after 15 minutes. Queue state is memory-only and removed on disconnect. For production scale-out, introduce a single owner per game, a durable/distributed queue, cross-instance socket adapter, distributed rate limiting and database-level coordination beyond this local mutex.
