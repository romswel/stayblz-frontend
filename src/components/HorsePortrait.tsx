import { useId } from 'react';

interface Props {
  coat: string;
  mane: string;
  blaze?: boolean;
  size?: number;
  title?: string;
}

/**
 * Stylized horse head portrait used as the record "photo" throughout the app.
 * Original artwork rendered inline so each horse can carry its own coat colors;
 * swap for real photography by replacing this component's usage sites.
 */
export default function HorsePortrait({ coat, mane, blaze = false, size = 44, title }: Props) {
  const gradId = useId();
  return (
    <svg
      className="horse-portrait"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title ? `Portrait of ${title}` : 'Horse portrait'}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f3f5" />
          <stop offset="1" stopColor="#cfd4d9" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="14" fill={`url(#${gradId})`} />
      {/* neck + head profile */}
      <path
        fill={coat}
        d="M16 100 C16 72 22 50 34 36 C40 26 48 18 58 14 L62 2 L68 12 L74 4 L79 14 C88 18 93 27 94 37 C95 47 92 56 85 61 C79 65 72 65 68 61 C63 68 60 78 58 88 C57 94 56 98 56 100 Z"
      />
      {/* mane along the crest */}
      <path
        fill={mane}
        d="M16 100 C16 72 22 50 34 36 C40 26 48 18 58 14 L62 2 L64 10 C54 18 46 28 41 40 C33 56 28 76 28 100 Z"
      />
      {blaze && (
        <path
          fill="#f5f0ea"
          opacity="0.9"
          d="M66 14 C72 22 76 32 78 42 C79 48 78 53 76 57 C74 52 73 46 72 40 C70 31 68 22 64 15 Z"
        />
      )}
      <circle cx="73" cy="31" r="3.2" fill="#1c1c1e" />
      <ellipse cx="86" cy="54" rx="2.4" ry="3" fill="#1c1c1e" opacity="0.55" />
    </svg>
  );
}
