import type { FolderStat } from '../folders';

const level = (share: number) => (share >= 0.8 ? 'good' : share > 0 ? 'some' : 'none');

/**
 * Per-folder breakdown of how many photos have a location, so it's obvious whether a copy from the
 * phone kept GPS data (camera folder near 100%) or lost it (camera folder at 0%).
 */
export function LocationCheck({ folders, openByDefault }: { folders: FolderStat[]; openByDefault: boolean }) {
  if (folders.length === 0) return null;
  return (
    <details className="location-check" open={openByDefault}>
      <summary>📍 Location data by folder</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">Folder</th>
            <th scope="col" className="num">
              With location
            </th>
          </tr>
        </thead>
        <tbody>
          {folders.map((f) => {
            const share = f.withLocation / f.total;
            return (
              <tr key={f.folder}>
                <td className="folder">{f.folder}</td>
                <td className="num">
                  <span className="count">
                    {f.withLocation.toLocaleString()} / {f.total.toLocaleString()}
                  </span>
                  <span className={`share-bar ${level(share)}`} aria-hidden>
                    <span style={{ width: `${Math.round(share * 100)}%` }} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        Your camera folder should be close to 100%. Screenshots and pictures saved from WhatsApp or Instagram never have
        a location, which is normal. If your camera folder shows 0, either the copy removed the location or the camera’s
        location setting was off when you took them. The Android app reads your gallery directly, with no copying.
      </p>
    </details>
  );
}
