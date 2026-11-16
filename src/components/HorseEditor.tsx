import { useState, type FormEvent } from "react";
import Modal from "./Modal";
import { useStableApi, useWorkspace } from "../workspace";
import type { InventoryItem, TrackedHorse } from "../types";
export default function HorseEditor({
  item,
  tracking,
  onClose,
  onSaved,
}: {
  item?: InventoryItem;
  tracking?: TrackedHorse;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useStableApi();
  const { active } = useWorkspace();
  const mode = !!tracking;
  const initial: Record<string, string | number> = tracking
    ? {
        status: tracking.status,
        condition: tracking.condition,
        trainer: tracking.trainer,
        jockey: tracking.jockey,
        form: tracking.form,
        lastWorkout: tracking.lastWorkout,
        nextRace: tracking.nextRace ?? "",
        location: tracking.location,
      }
    : {
        horseName: item?.horseName ?? "",
        breed: item?.breed ?? "Thoroughbred",
        age: item?.age ?? 0,
        sex: item?.sex ?? "Not recorded",
        status: item?.status ?? "Active",
        stable: item?.stable ?? active?.name ?? "",
        valueUsd: item?.valueUsd ?? 0,
        acquiredAt: item?.acquiredAt ?? new Date().toISOString().slice(0, 10),
        saddlecloth: item?.saddlecloth ?? 0,
      };
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (tracking) await api.patch(`/api/horses/${tracking.id}`, values);
      else if (item) await api.patch(`/api/inventory/${item.id}`, values);
      else await api.post("/api/inventory", values);
      onSaved();
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Horse details could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  const labels: Record<string, string> = {
    horseName: "Horse name",
    breed: "Breed",
    age: "Age",
    sex: "Sex",
    status: "Status",
    stable: "Barn / location label",
    valueUsd: "Estimated value (USD)",
    acquiredAt: "Acquired date",
    saddlecloth: "Saddlecloth",
    condition: "Condition (0–100)",
    trainer: "Trainer",
    jockey: "Jockey",
    form: "Recent form",
    lastWorkout: "Last workout",
    nextRace: "Next race",
    location: "Location",
  };
  return (
    <Modal
      label={
        mode ? "Update horse tracking" : item ? "Edit horse" : "Add a horse"
      }
      onClose={onClose}
    >
      <form className="horse-editor" onSubmit={save}>
        <h2>
          {mode ? "Update tracking" : item ? "Edit horse" : "Add a horse"}
        </h2>
        <p>Saved to {active?.name}. Stable members can view these records.</p>
        <div className="horse-editor-fields">
          {Object.entries(values).map(([key, value]) => (
            <label key={key}>
              {labels[key]}
              {key === "status" ? (
                <select
                  disabled={busy}
                  value={value}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                >
                  {(mode
                    ? [
                        "Race ready",
                        "In training",
                        "Recovering",
                        "Entered",
                        "Resting",
                      ]
                    : [
                        "Active",
                        "In training",
                        "Resting",
                        "For sale",
                        "Retired",
                      ]
                  ).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <input
                  disabled={busy}
                  value={value}
                  type={
                    typeof value === "number"
                      ? "number"
                      : key === "acquiredAt"
                        ? "date"
                        : "text"
                  }
                  min={typeof value === "number" ? 0 : undefined}
                  max={
                    key === "condition"
                      ? 100
                      : key === "age"
                        ? 50
                        : key === "saddlecloth"
                          ? 99
                          : undefined
                  }
                  required={["horseName", "breed", "acquiredAt"].includes(key)}
                  maxLength={
                    key === "nextRace" || key === "lastWorkout" ? 200 : 120
                  }
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [key]:
                        typeof value === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                    }))
                  }
                />
              )}
            </label>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="horse-editor-actions">
          <button className="ws-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="ws-button" disabled={busy}>
            {busy ? "Saving…" : "Save horse"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
