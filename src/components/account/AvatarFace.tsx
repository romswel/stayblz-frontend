import { useState, type ReactNode } from "react";
import { useAvatar } from "./avatars";

/**
 * The inside of an avatar circle: the person's profile picture when they have one,
 * otherwise `children` (their initials). A picture that fails to load falls back to initials.
 * The wrapper keeps its own size and shape; the photo fills it (`.avatar-photo` in ui.css).
 */
export default function AvatarFace({ id, children }: { id: string | null | undefined; children: ReactNode }) {
  const src = useAvatar(id);
  const [broken, setBroken] = useState<string | null>(null);
  if (!src || broken === src) return <>{children}</>;
  return <img className="avatar-photo" src={src} alt="" decoding="async" draggable={false} onError={() => setBroken(src)} />;
}
