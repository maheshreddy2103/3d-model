import type { ComponentType } from 'react';
import { STATIONS, type StationDef, type StationKind } from '../../config/layout';
import { StationShell } from './StationShell';
import { Cnc, Drill, InspectionTable, Lathe, Saw, Winder } from './machining';
import { ManualBench, RobotCell } from './assembly';
import { Chamber, Cmm, Dyno, ElectricalBench, RejectCage, ReworkBench, VisionArch } from './quality';
import { Cartoner, Labeler, Palletizer } from './packaging';

const MODELS: Record<StationKind, ComponentType<{ def: StationDef }>> = {
  inspectionTable: InspectionTable,
  saw: Saw,
  cnc: Cnc,
  drill: Drill,
  lathe: Lathe,
  winder: Winder,
  robotCell: RobotCell,
  manualBench: ManualBench,
  visionArch: VisionArch,
  cmm: Cmm,
  electricalBench: ElectricalBench,
  chamber: Chamber,
  dyno: Dyno,
  reworkBench: ReworkBench,
  labeler: Labeler,
  cartoner: Cartoner,
  palletizer: Palletizer,
};

export function Stations() {
  return (
    <group>
      {STATIONS.map((def) => {
        const Model = MODELS[def.kind];
        return (
          <StationShell key={def.id} def={def}>
            <Model def={def} />
          </StationShell>
        );
      })}
      <RejectCage />
    </group>
  );
}
