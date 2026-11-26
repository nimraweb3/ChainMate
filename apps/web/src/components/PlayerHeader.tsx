import { useResource } from '../lib';
export default function PlayerHeader({
  name = 'Waiting for opponent',
  ms,
  active,
  connection,
  botId,
  subtitle,
}: {
  name?: string;
  ms: number;
  active: boolean;
  connection: string;
  botId?: string;
  subtitle?: string;
}) {
  const { data } = useResource<any>('/profile/' + encodeURIComponent(name));
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const avatar = data?.user?.avatar;
  return (
    <div className="player-bar">
      <span className={'avatar ' + (botId ? 'bot-avatar' : '')} data-bot={botId}>
        {avatar ? (
          <img
            src={'/api/media/' + avatar}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : botId ? (
          ''
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </span>
      <div>
        <strong>{name}</strong>
        <small>
          {subtitle ||
            [data?.user?.rating ? `${data.user.rating} rating` : null, connection]
              .filter(Boolean)
              .join(' · ')}
        </small>
      </div>
      <time
        aria-label={`${name} clock`}
        className={'clock ' + (active ? 'active ' : '') + (ms < 30000 ? 'low-time' : '')}
      >
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </time>
    </div>
  );
}
