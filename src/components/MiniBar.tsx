interface Props {
  value: number;
  max: number;
  green?: boolean;
  title?: string;
}

/** Tiny horizontal bar used inside table cells to visualize a value. */
export default function MiniBar({ value, max, green = false, title }: Props) {
  const pct = max > 0 ? Math.max(3, Math.min(100, (value / max) * 100)) : 0;
  return (
    <span className={`minibar${green ? ' green' : ''}`} title={title} aria-hidden="true">
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}
