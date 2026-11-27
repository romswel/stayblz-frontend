import { HorseDialog } from "../stayblz-data/FormFavLists";
import { RaceDialog, StatsDialog } from "../stayblz-data/formfavDialogs";
import type { IndexCode, RaceWhere } from "../stayblz-data/formfavApi";
import type { StatsTarget } from "../stayblz-data/formfavUi";
import AddToVirtualButton from "../virtual/AddToVirtualButton";
import "../stayblz-data/stayblz-data.css";

/** What the dashboard has open: a race card, a race-data horse, or jockey/trainer stats. */
export type DashOpen =
  | { kind: "race"; where: RaceWhere }
  | { kind: "horse"; name: string; code: IndexCode }
  | { kind: "stats"; target: StatsTarget };

/** The Stayblz Data dialogs, lazy-loaded by the dashboard so FormFav's UI stays out of the main bundle. */
export default function DashboardDialogs({ open, onOpen }: { open: DashOpen; onOpen: (next: DashOpen | null) => void }) {
  const close = () => onOpen(null);
  if (open.kind === "race")
    return <RaceDialog where={open.where} onClose={close} onStats={(target) => onOpen({ kind: "stats", target })} />;
  if (open.kind === "horse")
    return (
      <HorseDialog
        name={open.name}
        code={open.code}
        onClose={close}
        onRace={(where) => onOpen({ kind: "race", where })}
        extra={<AddToVirtualButton target={{ formfav: { name: open.name, code: open.code } }} name={open.name} />}
      />
    );
  return <StatsDialog target={open.target} onClose={close} />;
}
