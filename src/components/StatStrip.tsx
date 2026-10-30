interface Tile {
  label: string;
  value: string | number;
}

/** Row of headline metrics shown above data tables. */
export default function StatStrip({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="stat-strip">
      {tiles.map((t) => (
        <div key={t.label} className="panel stat-tile">
          <span className="v">{t.value}</span>
          <span className="l">{t.label}</span>
        </div>
      ))}
    </div>
  );
}
