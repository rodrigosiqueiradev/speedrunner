import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { localPlace } from "../platform";
import { UploadIcon } from "./Icons";

interface Props {
  onLoad: (fileName: string, xml: string) => void;
  onError: (message: string) => void;
  /** Render only the hidden input; the header supplies the button. */
  compact?: boolean;
  /** Accept several files at once (the profile). */
  multiple?: boolean;
  title?: string;
  /** Hide the sample run button. */
  noSample?: boolean;
}

export interface FilePickerHandle {
  open: () => void;
}

export const FilePicker = forwardRef<FilePickerHandle, Props>(function FilePicker({ onLoad, onError, compact, multiple, title, noSample }, ref) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  useImperativeHandle(ref, () => ({ open: () => input.current?.click() }));

  const readFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".lss")) {
      onError(`"${file.name}" isn't a LiveSplit split file. Choose the .lss file you saved from LiveSplit.`);
      return;
    }
    onLoad(file.name, await file.text());
  };

  const loadSample = async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}sample.lss`);
    if (!res.ok) return onError("The sample run didn't load. Check your connection and try again.");
    onLoad("Sample run: Dishonored Any%", await res.text());
  };

  // "?sample" in the URL opens the sample run directly, so the demo can be linked to.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("sample")) void loadSample();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept=".lss"
      hidden
      multiple={multiple}
      data-testid="file-input"
      onChange={(e) => {
        for (const file of Array.from(e.target.files ?? []).slice(0, multiple ? undefined : 1)) void readFile(file);
        e.target.value = "";
      }}
    />
  );

  if (compact) return fileInput;

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
        for (const file of Array.from(e.dataTransfer.files).slice(0, multiple ? undefined : 1)) void readFile(file);
      }}
    >
      <p className="dropzone-title">{title ?? "Drop your LiveSplit splits here"}</p>
      <p className="dropzone-hint">
        In LiveSplit, right-click and choose Save Splits As to get an .lss file. {multiple ? "They're" : "It's"} read{" "}
        {localPlace} and never uploaded.
      </p>
      <div className="dropzone-actions">
        <button className="primary" onClick={() => input.current?.click()}>
          <UploadIcon /> {multiple ? "Choose .lss files" : "Choose .lss file"}
        </button>
        {!noSample && <button onClick={loadSample}>Try a sample run</button>}
      </div>
      {fileInput}
    </div>
  );
});
