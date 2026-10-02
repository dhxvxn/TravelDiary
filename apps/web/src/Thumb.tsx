import { useEffect, useState } from 'react';
import { thumbnailUrl, type Photo } from './scan';

export function Thumb({ photo }: { photo: Photo }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    thumbnailUrl(photo).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [photo]);
  const title = `${photo.name} · ${photo.takenAt.toLocaleString()}`;
  return src ? (
    <img className="thumb" src={src} alt={photo.name} title={title} loading="lazy" decoding="async" />
  ) : (
    <div className="thumb thumb-empty" title={title} />
  );
}
