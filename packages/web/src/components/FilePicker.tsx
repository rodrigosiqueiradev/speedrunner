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

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void readFile(file);
    },
  };

  const fileInput = (
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
  );

  if (fileName) {
    return (
      <div className={`filebar${dragging ? " dragging" : ""}`} {...dropHandlers}>
        <span className="filebar-name" title={fileName}>
          {fileName}
        </span>
        <button onClick={() => input.current?.click()}>Open another file</button>
        {fileInput}
      </div>
    );
  }

  return (
    <div className={`dropzone${dragging ? " dragging" : ""}`} {...dropHandlers}>
      <p className="dropzone-title">Drop your LiveSplit splits here</p>
      <p className="dropzone-hint">
        In LiveSplit, right-click → Save Splits As… gives you an .lss file. It's read in your browser and never uploaded.
      </p>
      <div className="dropzone-actions">
        <button className="primary" onClick={() => input.current?.click()}>
          Choose .lss file
        </button>
        <button onClick={loadSample}>Try a sample run</button>
      </div>
      {fileInput}
    </div>
  );
}
