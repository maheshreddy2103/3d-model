// Human-readable descriptions of where a motor is and what has happened to it.

import { MAIN_STATIONS, STATION_BY_ID, STATIONS } from '../config/layout';
import type { Engine, Product } from './engine';

export const STAGE_NAMES = [
  'Raw material kit',
  'Kit inspected',
  'Shaft blank cut',
  'Housing machined',
  'Feet drilled & tapped',
  'Shaft turned, rotor pressed',
  'Stator wound',
  'Stator fitted',
  'Rotor & bearings fitted',
  'End shield & fan fitted',
  'Assembled motor',
  'Nameplate applied',
  'Packed in carton',
];

export function locationOf(e: Engine, p: Product): string {
  if (p.loc === 'shipped') return 'Shipped on outbound truck';
  if (p.loc === 'scrap') return 'Scrapped — in reject cage';
  if (p.loc === 'pallet') {
    const pallet = e.palletById(p.palletId);
    if (!pallet) return 'On pallet';
    switch (pallet.at.kind) {
      case 'spot': return 'On pallet at the palletiser';
      case 'forklift': return 'On pallet, carried by forklift';
      case 'rack': return `Finished-goods rack, bay ${pallet.at.slot + 1}`;
      case 'truck': return e.trucks.outbound.state === 'docked' ? 'Loaded on outbound truck' : 'On outbound truck, leaving site';
      default: return 'On pallet';
    }
  }
  if (p.processing) return `At ${STATION_BY_ID[p.processing].name}`;
  if (p.lane === 'scrap') return 'On scrap conveyor to reject cage';
  if (p.lane === 'rework') return p.nextIdx > 0 ? 'Repaired — returning to inspection' : 'On rework conveyor → Rework station';
  if (p.failed) return 'Failed a test — heading to the diverter';
  const next = MAIN_STATIONS[p.nextIdx];
  return next ? `On conveyor → ${next.name}` : 'On conveyor';
}

export function currentStationName(p: Product): string {
  return p.processing ? STATION_BY_ID[p.processing].name : '—';
}

export function stationName(id: string) {
  return STATIONS.find((s) => s.id === id)?.name ?? id;
}
