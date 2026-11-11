import type { ReactNode } from "react";
import { initials, tone } from "./format";

const Svg = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
export const ComposeIcon = () => <Svg><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>;
export const SendIcon = () => <Svg><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></Svg>;
export const ReplyIcon = () => <Svg size={16}><path d="m9 14-5-5 5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v5" /></Svg>;
export const SmileIcon = () => <Svg size={16}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></Svg>;
export const CopyIcon = () => <Svg size={16}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Svg>;
export const UndoIcon = () => <Svg size={16}><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></Svg>;
export const InfoIcon = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></Svg>;
export const ArrowLeftIcon = () => <Svg><path d="M19 12H5M12 19l-7-7 7-7" /></Svg>;
export const SearchIcon = () => <Svg size={16}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const DownIcon = () => <Svg size={16}><path d="M12 5v14M19 12l-7 7-7-7" /></Svg>;
export const DatabaseIcon = () => <Svg size={16}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></Svg>;

/** Initials in a coloured circle. Groups get a two-tone ring. */
export function Avatar({ name, group = false, size = "md" }: { name: string; group?: boolean; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`mx-av mx-av-${size} mx-tone-${tone(name)}${group ? " is-group" : ""}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
