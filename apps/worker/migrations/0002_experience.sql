CREATE TABLE user_experience(user_id TEXT PRIMARY KEY REFERENCES users(id), appearance TEXT, chat TEXT, progress TEXT NOT NULL DEFAULT '[]', updated INTEGER NOT NULL);
CREATE TABLE chat_messages(id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id), sender_id TEXT NOT NULL REFERENCES users(id), client_id TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL, created INTEGER NOT NULL, UNIQUE(game_id,sender_id,client_id));
CREATE INDEX chat_history ON chat_messages(game_id,created);
CREATE TABLE user_blocks(user_id TEXT NOT NULL REFERENCES users(id),target_id TEXT NOT NULL REFERENCES users(id),created INTEGER NOT NULL,PRIMARY KEY(user_id,target_id));
CREATE TABLE chat_permissions(user_id TEXT NOT NULL REFERENCES users(id),target_id TEXT NOT NULL REFERENCES users(id),accepted INTEGER NOT NULL DEFAULT 0,friend INTEGER NOT NULL DEFAULT 0,muted INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,target_id));
CREATE TABLE chat_reports(id TEXT PRIMARY KEY,reporter TEXT NOT NULL REFERENCES users(id),target_id TEXT NOT NULL REFERENCES users(id),message_id TEXT,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created INTEGER NOT NULL);
CREATE INDEX chat_report_queue ON chat_reports(status,created);
