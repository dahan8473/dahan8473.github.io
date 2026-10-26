// The monthly spend cap, shared by everything that calls a model. The count
// lives in Supabase (the spend table); each instance keeps a copy and re-reads
// it at most once a minute.

import { spent, addSpend } from './_store.js';

export const CAP = Number(process.env.MONTHLY_CAP_USD || 20);
// Jev doesn't say what each call cost. A flat estimate, above what it charges
// (a fraction of a cent per thousand calls), so its calls count toward the cap.
export const JEV_USD = 0.00001;

const within = (p, ms, fallback) => Promise.race([p, new Promise((r) => setTimeout(() => r(fallback), ms))]);
const money = { usd: 0, at: 0, reading: null, owed: 0 };

// This month's spend in dollars. A fresh instance waits up to a second for its
// first reading; with none by then it answers from what it has counted itself,
// since a slow store on a cold start shouldn't mute the head. The monthly limit
// on the OpenRouter key is the hard stop behind this. Once it has a reading it
// answers from its copy right away, and refreshes in the background.
export function spentNow() {
  if (!money.reading && Date.now() - money.at > 60 * 1000) {
    money.reading = spent()
      .then((v) => { money.usd = v + money.owed; money.at = Date.now(); })
      .catch(() => {})
      .finally(() => { money.reading = null; });
  }
  return money.at ? money.usd : within(money.reading.then(() => money.usd), 1000, money.usd);
}

// What a brain call cost. Jev calls not yet written go along with it.
export async function addCost(usd) {
  money.usd += usd;
  const owed = money.owed;
  money.owed = 0;
  await addSpend(usd + owed);
}

// One Jev call: counted on this instance right away, and written to Supabase
// with the next brain cost or once a tenth of a cent has built up.
export function chargeJev() {
  money.usd += JEV_USD;
  money.owed += JEV_USD;
  if (money.owed < 0.001) return null;
  const owed = money.owed;
  money.owed = 0;
  return addSpend(owed).catch(() => {});
}

export const overCap = async () => (await spentNow()) >= CAP;
