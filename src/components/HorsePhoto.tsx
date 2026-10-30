import HorsePortrait from './HorsePortrait';
import h1 from '../assets/horses/h1.jpg';
import h2 from '../assets/horses/h2.jpg';
import h3 from '../assets/horses/h3.jpg';
import h4 from '../assets/horses/h4.jpg';
import h5 from '../assets/horses/h5.jpg';
import h6 from '../assets/horses/h6.jpg';
import h7 from '../assets/horses/h7.jpg';

/**
 * Photo per horse record id. Development placeholders — swap these files
 * (or serve a photoUrl from the API) for your own stable photography.
 */
export const HORSE_PHOTOS: Record<string, string> = { h1, h2, h3, h4, h5, h6, h7 };

interface Props {
  horseId: string;
  name: string;
  size?: number;
  /** Fallback portrait colors when no photo exists for this id */
  coat?: string;
  mane?: string;
  blaze?: boolean;
}

export default function HorsePhoto({ horseId, name, size = 46, coat, mane, blaze }: Props) {
  const src = HORSE_PHOTOS[horseId];
  if (!src) {
    return <HorsePortrait coat={coat ?? '#6B4226'} mane={mane ?? '#3d2415'} blaze={blaze} size={size} title={name} />;
  }
  return (
    <img
      className="horse-photo"
      src={src}
      alt={`Photo of ${name}`}
      width={size}
      height={size}
      loading="lazy"
    />
  );
}
