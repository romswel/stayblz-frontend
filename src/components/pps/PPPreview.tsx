import { useId } from "react";
import type { PPProduct } from "./catalog";

export default function PPPreview({
  variant,
}: {
  variant: PPProduct["preview"];
}) {
  const id = useId();
  return (
    <svg
      className="pp-preview"
      viewBox="0 0 560 310"
      role="img"
      aria-labelledby={id}
    >
      <title id={id}>
        Past performance report layout preview, without race data
      </title>
      <rect x="66" y="16" width="428" height="260" rx="12" fill="#202722" />
      <rect
        x="78"
        y="28"
        width="404"
        height="236"
        rx="2"
        fill={variant === "chart" ? "#e1e9e2" : "#fffef9"}
      />
      <rect
        x="96"
        y="42"
        width="368"
        height="22"
        fill={variant === "chart" ? "#1b4b38" : "#e7e9e3"}
      />
      <text
        x="108"
        y="57"
        fill={variant === "chart" ? "#fffef9" : "#304a3a"}
        fontSize="10"
        fontFamily="Arial"
        letterSpacing="1.3"
      >
        PAST PERFORMANCES
      </text>
      {[0, 1, 2].map((row) => (
        <g key={row} transform={`translate(96 ${76 + row * 57})`}>
          <rect
            width="28"
            height="17"
            rx="2"
            fill={variant === "detailed" ? "#c5a468" : "#d2d9cf"}
          />
          <rect x="38" y="2" width="147" height="6" fill="#a8b5a5" />
          <rect x="38" y="12" width="230" height="3" fill="#d9dfd5" />
          {[24, 32, 40].map((y) => (
            <g key={y}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((col) => (
                <rect
                  key={col}
                  x={col * 46}
                  y={y}
                  width="36"
                  height="3"
                  fill={
                    variant === "chart" && col % 3 === 0 ? "#b29c68" : "#cdd5c9"
                  }
                />
              ))}
            </g>
          ))}
        </g>
      ))}
      <text
        x="280"
        y="255"
        textAnchor="middle"
        fill="#63715e"
        fontSize="9"
        fontFamily="Arial"
        letterSpacing="2"
      >
        LAYOUT PREVIEW · NO RACE DATA
      </text>
      <path d="M22 276h516l-20 14H42Z" fill="#adb5aa" />
      <path d="M22 276h516v5H22Z" fill="#d8ddd4" />
      <path d="M234 276h92l-6 6h-80Z" fill="#7d897b" />
      <ellipse cx="280" cy="297" rx="247" ry="4" fill="#142820" opacity=".1" />
    </svg>
  );
}
