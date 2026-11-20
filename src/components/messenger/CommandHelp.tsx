import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { COMMANDS, FORMATTING, SHORTCUTS } from "./commands";

/** /help: every command, the formatting you can type, and the keyboard shortcuts. */
export default function CommandHelp({ group, onClose }: { group: boolean; onClose: () => void }) {
  return (
    <Modal label="Chat commands and formatting" onClose={onClose} className="modal-sm mx-dialog mx-layer gx-layer mx-help">
      <DialogHead kicker="Stayblz Chat" title="Commands & formatting" onClose={onClose} />
      <div className="dlg">
        <div className="dlg-text">
          <h3 className="mx-help-head">Commands</h3>
          <p className="mx-hint">Type / in the message box to pick one. Start with // to send something that begins with / as written.</p>
          <ul className="mx-help-list">
            {COMMANDS.filter((c) => group || !c.group).map((c) => (
              <li key={c.name}>
                <code>
                  /{c.name}
                  {c.args ? <span className="mx-help-arg"> {c.args}</span> : null}
                </code>
                <span>{c.help}</span>
              </li>
            ))}
          </ul>
          <h3 className="mx-help-head">Formatting</h3>
          <ul className="mx-help-list">
            {FORMATTING.map(([typed, shows]) => (
              <li key={typed}>
                <code>{typed}</code>
                <span>{shows}</span>
              </li>
            ))}
          </ul>
          <p className="mx-hint">
            Pasting from a website, Word or Google Docs keeps bold, italic, lists, quotes and line breaks.{" "}
            {group ? "@everyone mentions the whole group; " : ""}@highlight makes your message stand out without alerting anyone.
          </p>
          <h3 className="mx-help-head">Shortcuts</h3>
          <ul className="mx-help-list">
            {SHORTCUTS.map(([keys, does]) => (
              <li key={keys}>
                <kbd>{keys}</kbd>
                <span>{does}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="dlg-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </Modal>
  );
}
