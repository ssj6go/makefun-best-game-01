// MOTHFLAME — level-up choices.
// Each level offers three distinct upgrades, weighted, from the ones the moth
// has not maxed out yet. The player picks one by clicking its card or
// pressing 1, 2 or 3; the choice applies at once.

import { UPGRADES } from './config.js';

export class UpgradePool {
  constructor() {
    this.taken = new Map(); // upgrade id -> times taken
  }

  reset() {
    this.taken.clear();
  }

  count(id) {
    return this.taken.get(id) ?? 0;
  }

  available() {
    return UPGRADES.filter((u) => this.count(u.id) < u.max);
  }

  // Three distinct offers, weighted by each upgrade's weight.
  roll(count = 3, rng = Math.random) {
    const pool = this.available();
    const offers = [];
    const working = [...pool];
    while (offers.length < count && working.length > 0) {
      let total = 0;
      for (const u of working) total += u.weight;
      let roll = rng() * total;
      let picked = 0;
      for (let i = 0; i < working.length; i++) {
        roll -= working[i].weight;
        if (roll <= 0) {
          picked = i;
          break;
        }
      }
      offers.push(working.splice(picked, 1)[0]);
    }
    return offers;
  }

  apply(upgrade, player) {
    this.taken.set(upgrade.id, this.count(upgrade.id) + 1);
    upgrade.apply(player.stats, player);
    if (upgrade.id === 'bulwark') player.wardReady = true;
  }
}
