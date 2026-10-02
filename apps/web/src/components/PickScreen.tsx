import { useRef, useState, type DragEvent } from 'react';

async function filesFromDrop(e: DragEvent): Promise<File[]> {
  const out: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      out.push(await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries returns results in batches; keep reading until it comes back empty.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (batch.length === 0) break;
        await Promise.all(batch.map(walk));
      }
    }
  };
  const entries = [...e.dataTransfer.items].map((i) => i.webkitGetAsEntry()).filter((x): x is FileSystemEntry => !!x);
  if (entries.length === 0) return [...e.dataTransfer.files];
  await Promise.all(entries.map(walk));
  return out;
}

export function PickScreen({ onFiles }: { onFiles: (files: File[]) => void }) {
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="pick">
      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(await filesFromDrop(e));
        }}
      >
        <div className="dropzone-icon" aria-hidden>🗺️</div>
        <h2>Turn your photos into a travel log</h2>
        <p>Drop a folder of photos here, or choose one. Location and date are read from each photo’s EXIF data.</p>
        <div className="actions">
          <button className="primary" onClick={() => folderInput.current?.click()}>
            Choose a folder
          </button>
          <button onClick={() => filesInput.current?.click()}>Choose photos</button>
        </div>
        <input
          ref={folderInput}
          type="file"
          hidden
          multiple
          // @ts-expect-error non-standard but supported by every major browser
          webkitdirectory=""
          onChange={(e) => e.target.files && onFiles([...e.target.files])}
        />
        <input
          ref={filesInput}
          type="file"
          hidden
          multiple
          accept="image/*,.heic,.heif"
          onChange={(e) => e.target.files && onFiles([...e.target.files])}
        />
      </div>

      <div className="notes">
        <section>
          <h3>🔒 Private by design</h3>
          <p>
            Your photos never leave this device. They are read directly by your browser. Only the coordinates of each stop
            are sent to OpenStreetMap to look up place names, and you can turn that off.
          </p>
        </section>
        <section>
          <h3>📍 Keep the location data</h3>
          <p>
            Some exports strip GPS info. These keep it: <b>Google Takeout</b> (Google Photos), <b>iCloud Photos → Export
            Unmodified Original</b> on a Mac, or copying the camera roll over <b>USB</b> from Android/iPhone. Picking photos
            in a phone browser often removes location.
          </p>
        </section>
      </div>
    </div>
  );
}
