import type { ReactNode } from "react";

const Svg = ({ children, size = 20 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
type P = { size?: number };

export const MicIcon = ({ size }: P) => <Svg size={size}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v4" /></Svg>;
export const MicOffIcon = ({ size }: P) => <Svg size={size}><path d="m3 3 18 18" /><path d="M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.8" /><path d="M5 11a7 7 0 0 0 11.5 5.4M19 11a7 7 0 0 1-.6 2.8M12 18v4" /></Svg>;
export const CamIcon = ({ size }: P) => <Svg size={size}><rect x="2" y="6" width="14" height="12" rx="2.5" /><path d="m16 10 6-3.5v11L16 14" /></Svg>;
export const CamOffIcon = ({ size }: P) => <Svg size={size}><path d="m3 3 18 18" /><path d="M10.5 6H14a2 2 0 0 1 2 2v3.5l6-4v10M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2" /></Svg>;
export const ScreenIcon = ({ size }: P) => <Svg size={size}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4M12 7v6M9 10l3-3 3 3" /></Svg>;
export const ScreenOffIcon = ({ size }: P) => <Svg size={size}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4M9 7l6 6M15 7l-6 6" /></Svg>;
export const HandIcon = ({ size }: P) => <Svg size={size}><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L6 14" /></Svg>;
export const SmileIcon = ({ size }: P) => <Svg size={size}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></Svg>;
export const PhoneOffIcon = ({ size }: P) => <Svg size={size}><path d="M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.8" /><path d="m22 2-20 20" /></Svg>;
export const PeopleIcon = ({ size }: P) => <Svg size={size}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></Svg>;
export const ChatIcon = ({ size }: P) => <Svg size={size}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /></Svg>;
export const InfoIcon = ({ size }: P) => <Svg size={size}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></Svg>;
export const MoreIcon = ({ size }: P) => <Svg size={size}><circle cx="12" cy="5" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="19" r="1.3" fill="currentColor" /></Svg>;
export const GridIcon = ({ size }: P) => <Svg size={size}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></Svg>;
export const SpotlightIcon = ({ size }: P) => <Svg size={size}><rect x="3" y="3" width="18" height="13" rx="2" /><rect x="3" y="18" width="5" height="3" rx="1" /><rect x="9.5" y="18" width="5" height="3" rx="1" /><rect x="16" y="18" width="5" height="3" rx="1" /></Svg>;
export const PinIcon = ({ size }: P) => <Svg size={size}><path d="M12 17v5" /><path d="M9 3h6l-1 6 4 3v2H6v-2l4-3Z" /></Svg>;
export const GearIcon = ({ size }: P) => <Svg size={size}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></Svg>;
export const CopyIcon = ({ size = 16 }: P) => <Svg size={size}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Svg>;
export const ShareIcon = ({ size = 16 }: P) => <Svg size={size}><path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7" /></Svg>;
export const CalendarIcon = ({ size = 16 }: P) => <Svg size={size}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /></Svg>;
export const LockIcon = ({ size = 16 }: P) => <Svg size={size}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>;
export const UnlockIcon = ({ size = 16 }: P) => <Svg size={size}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></Svg>;
export const ExpandIcon = ({ size = 18 }: P) => <Svg size={size}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></Svg>;
export const MinimizeIcon = ({ size = 18 }: P) => <Svg size={size}><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></Svg>;
export const SwitchCamIcon = ({ size = 18 }: P) => <Svg size={size}><path d="M20 7h-3l-2-3H9L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" /><path d="M9 13a3 3 0 0 1 5-2.2M15 13a3 3 0 0 1-5 2.2M14 9v2h-2M10 17v-2h2" /></Svg>;
export const KeyboardIcon = ({ size = 18 }: P) => <Svg size={size}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 13h6M7 16h10" /></Svg>;
export const SendIcon = ({ size = 18 }: P) => <Svg size={size}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></Svg>;
export const ChevronUpIcon = ({ size = 14 }: P) => <Svg size={size}><path d="m6 15 6-6 6 6" /></Svg>;
export const SpeakerIcon = ({ size = 18 }: P) => <Svg size={size}><path d="M11 5 6 9H2v6h4l5 4Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></Svg>;
export const SignalIcon = ({ level }: { level: "good" | "fair" | "poor" }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <rect key={i} x={2 + i * 5} y={10 - i * 4} width="3" height={4 + i * 4} rx="1"
        fill="currentColor" opacity={i <= (level === "good" ? 2 : level === "fair" ? 1 : 0) ? 1 : 0.28} />
    ))}
  </svg>
);
export const CloseIcon = ({ size = 18 }: P) => <Svg size={size}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
export const PlusIcon = ({ size = 18 }: P) => <Svg size={size}><path d="M12 5v14M5 12h14" /></Svg>;
export const LinkIcon = ({ size = 18 }: P) => <Svg size={size}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Svg>;
export const ClockIcon = ({ size = 16 }: P) => <Svg size={size}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;

/** The Paddock mark: a horseshoe framing a camera lens. */
export const PaddockMark = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 20V11a6 6 0 0 1 12 0v9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M4 20h4M16 20h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="12" cy="11.5" r="2.6" fill="currentColor" />
  </svg>
);
