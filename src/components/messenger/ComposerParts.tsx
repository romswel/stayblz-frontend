import { chatMarks, renderChat } from "./chatMarkdown";
import { fileSize, firstName } from "./format";
import type { StagedFile } from "./files";
import { CloseIcon, FileIcon, MicIcon } from "./icons";

/**
 * Files waiting in the message box: dragged in (from your computer or from Stayblz itself), pasted, or picked with
 * Attach. Nothing is sent until you press Send; × takes one out.
 */
export function StagedFiles({ files, onRemove }: { files: StagedFile[]; onRemove: (id: string) => void }) {
  if (!files.length) return null;
  return (
    <div className="mx-staged" role="group" aria-label={`${files.length} ${files.length === 1 ? "file" : "files"} ready to send`}>
      <ul>
        {files.map((f) => {
          const video = f.type.startsWith("video/");
          const what = video ? "video" : f.type.startsWith("image/") ? "photo" : f.type.startsWith("audio/") ? "audio" : "file";
          return (
            <li key={f.id} className={`mx-staged-item is-${what}`} title={`${f.file.name} · ${fileSize(f.file.size)}`}>
              {f.url && !video ? (
                <img src={f.url} alt="" draggable={false} />
              ) : f.url && video ? (
                <>
                  {/* "#t=0.1" makes iPhones draw a first frame instead of a blank box. */}
                  <video src={`${f.url}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" />
                  <span className="mx-staged-play" aria-hidden="true">▶</span>
                </>
              ) : (
                <span className="mx-staged-doc">
                  {what === "audio" ? <MicIcon size={18} /> : <FileIcon size={18} />}
                  <span className="mx-staged-name">{f.file.name}</span>
                  <small>{fileSize(f.file.size)}</small>
                </span>
              )}
              <button type="button" className="mx-staged-remove" aria-label={`Remove ${f.file.name}`} onClick={() => onRemove(f.id)}>
                <CloseIcon size={14} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * How the message will look once sent, shown above the box while what you type has formatting (bold, lists,
 * spoilers, @highlight…). The box itself keeps the marks, so typing on phones works exactly as before.
 */
export function FormatPreview({ text, mentions, meName }: { text: string; mentions?: RegExp | null; meName?: string }) {
  const marks = chatMarks(text);
  return (
    <div className="mx-format-preview" aria-label="Preview of your message">
      <span className="mx-format-label" aria-hidden="true">
        Preview
      </span>
      <div className={`mx-text mx-format-text${marks.me ? " is-action" : ""}`}>
        {marks.highlight && <span className="mx-highlight-tag">★ Highlight</span>}
        {marks.me && <strong className="mx-action-who">{firstName(meName || "You")} </strong>}
        {renderChat(marks.text, { mentions })}
      </div>
    </div>
  );
}
