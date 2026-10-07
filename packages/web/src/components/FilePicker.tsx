import { useRef, useState } from "react";

interface Props {
  onLoad: (fileName: string, xml: string) => void;
  onError: (message: string) => void;
  fileName?: string;
}

export function FilePicker({ onLoad, onError, fileName }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const readFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".lss")) {
      onError(`"${file.name}" isn't a LiveSplit split file (.lss).`);
      return;
    }
    onLoad(file.name, await file.text());
  };

  const loadSample = async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}sample.lss`);
    if (!res.ok) return onError("Couldn't load the sample file.");
    onLoad("Sample: Dishonored Any%", await res.text());
  };

  return (
    <div
      className={`dropzone${dragging ? " dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) void readFile(file);
      }}
    >
      <p>
        {fileName ? (
          <>
            Showing <strong>{fileName}</strong>. Drop another .lss file to switch.
          </>
        ) : (
          "Drop your LiveSplit splits (.lss) here"
        )}
      </p>
      <div className="dropzone-actions">
        <button className="primary" onClick={() => input.current?.click()}>
          Choose file
        </button>
        <button onClick={loadSample}>Try a sample</button>
      </div>
      <input
        ref={input}
        type="file"
        accept=".lss"
        hidden
        data-testid="file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void readFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
