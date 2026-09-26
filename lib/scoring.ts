import { DESTINATIONS, TAGS, TYPES, type Destination } from "./destinations";
import type { DateWindow, Prefs, Tag, TripMeta, TypeId } from "./types";

export type Status = "happy" | "okay" | "stretch" | "cant";
export type Tone = "good" | "meh" | "bad";

export interface Reason {
  text: string;
  tone: Tone;
}

export interface PersonFit {
  member: string;
  score: number; // 0-100
  status: Status;
  reasons: Reason[];
}

export interface Option {
  key: string;
  dest: Destination;
  window: DateWindow;
  nights: number;
  cost: number;
  inSeason: boolean;
  groupScore: number;
  fits: PersonFit[];
  blockers: PersonFit[];
}

export interface Overlap {
  budgetEveryoneCan: number | null;
  budgetEveryoneComfy: number | null;
  datesEveryoneCan: DateWindow[];
  typesNobodyMinds: TypeId[];
  mostLoved: { id: TypeId; count: number }[];
  wontDos: { tag: Tag; who: string[] }[];
}

export interface Evaluation {
  recommended: Option[]; // up to 3, all viable
  closeCalls: Option[]; // near misses, each with 1 blocker
  overlap: Overlap;
  submitted: string[];
  pending: string[];
}

const W = { dates: 0.25, budget: 0.25, travel: 0.2, type: 0.3 };

const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const typeLabel = (id: TypeId) => TYPES.find((t) => t.id === id)?.label.toLowerCase() ?? id;
const tagLabel = (id: Tag) => TAGS.find((t) => t.id === id)?.label.toLowerCase() ?? id;

export function nightsOf(w: DateWindow) {
  const ms = new Date(w.end + "T00:00:00").getTime() - new Date(w.start + "T00:00:00").getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function monthOf(w: DateWindow) {
  return new Date(w.start + "T00:00:00").getMonth() + 1;
}

function activeTags(d: Destination, month: number): Tag[] {
  const tags = [...d.tags];
  if (d.coldMonths?.includes(month) && !tags.includes("cold")) tags.push("cold");
  return tags;
}

export function personFit(p: Prefs, d: Destination, w: DateWindow): PersonFit {
  const reasons: Reason[] = [];
  let blocked = false;
  const month = monthOf(w);
  const cost = d.perNight * nightsOf(w);

  // Dates
  const a = p.avail[w.id] ?? "no";
  let sDates = 1;
  if (a === "no") {
    blocked = true;
    sDates = 0;
    reasons.push({ text: `Can't make ${w.label}`, tone: "bad" });
  } else if (a === "maybe") {
    sDates = 0.6;
    reasons.push({ text: `${w.label} works only if needed`, tone: "meh" });
  }

  // Budget
  let sBudget = 1;
  if (cost > p.budgetMax) {
    blocked = true;
    sBudget = 0;
    reasons.push({ text: `${rupees(cost - p.budgetMax)} over their max budget`, tone: "bad" });
  } else if (cost > p.budgetComfort) {
    const span = Math.max(1, p.budgetMax - p.budgetComfort);
    sBudget = 1 - 0.6 * ((cost - p.budgetComfort) / span);
    reasons.push({ text: `${rupees(cost - p.budgetComfort)} above comfortable budget`, tone: "meh" });
  } else {
    reasons.push({ text: `Within budget`, tone: "good" });
  }

  // Travel time
  const h = d.hours[p.homeCity];
  let sTravel = 1;
  let travelStretch = false;
  if (h > p.maxHours + 2) {
    blocked = true;
    sTravel = 0;
    reasons.push({ text: `~${h}h from ${p.homeCity}, limit is ${p.maxHours}h`, tone: "bad" });
  } else if (h > p.maxHours) {
    sTravel = 0.4;
    travelStretch = true;
    reasons.push({ text: `~${h}h from ${p.homeCity}, a bit over their ${p.maxHours}h limit`, tone: "meh" });
  } else {
    sTravel = 1 - 0.3 * (h / Math.max(1, p.maxHours));
    reasons.push({ text: `~${h}h from ${p.homeCity}`, tone: "good" });
  }

  // Trip type
  const feels = d.types.map((t) => ({ t, f: p.types[t] ?? "fine" }));
  const loved = feels.filter((x) => x.f === "love");
  const fine = feels.filter((x) => x.f === "fine");
  let sType = 0.2;
  if (loved.length) {
    sType = 1;
    reasons.push({ text: `Loves ${typeLabel(loved[0].t)}`, tone: "good" });
  } else if (fine.length) {
    sType = 0.6;
  } else {
    reasons.push({ text: `Would rather not do ${typeLabel(d.types[0])}`, tone: "meh" });
  }
  const disliked = feels.filter((x) => x.f === "no");
  if (disliked.length && (loved.length || fine.length)) {
    sType = Math.max(0.2, sType - 0.15);
    reasons.push({ text: `Not keen on ${typeLabel(disliked[0].t)}`, tone: "meh" });
  }

  // Won't do
  const hits = activeTags(d, month).filter((t) => p.wontDo.includes(t));
  if (hits.length) {
    blocked = true;
    for (const t of hits) reasons.push({ text: `Won't do ${tagLabel(t)}`, tone: "bad" });
  }

  const raw = W.dates * sDates + W.budget * sBudget + W.travel * sTravel + W.type * sType;
  // Going over someone's own travel limit can never count as "happy" for them.
  const capped = travelStretch ? Math.min(raw, 0.7) : raw;
  const score = blocked ? 0 : Math.round(capped * 100);
  const status: Status = blocked ? "cant" : score >= 78 ? "happy" : score >= 60 ? "okay" : "stretch";

  // Show problems first, then good news; keep it short.
  const order: Record<Tone, number> = { bad: 0, meh: 1, good: 2 };
  reasons.sort((x, y) => order[x.tone] - order[y.tone]);
  return { member: p.member, score, status, reasons: reasons.slice(0, 3) };
}

export function evaluate(meta: TripMeta, responses: Record<string, Prefs>): Evaluation {
  const submitted = meta.members.filter((m) => responses[m]);
  const pending = meta.members.filter((m) => !responses[m]);
  const prefs = submitted.map((m) => responses[m]);

  const all: Option[] = [];
  if (prefs.length) {
    for (const d of DESTINATIONS) {
      for (const w of meta.windows) {
        const month = monthOf(w);
        if (d.closed?.includes(month)) continue;
        const fits = prefs.map((p) => personFit(p, d, w));
        const blockers = fits.filter((f) => f.status === "cant");
        const scores = fits.map((f) => f.score);
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const min = Math.min(...scores);
        const inSeason = d.best.includes(month);
        // Half average, half the least-happy person: an option only wins if it works for everyone.
        const groupScore = Math.round((0.5 * mean + 0.5 * min) * (inSeason ? 1 : 0.8));
        all.push({
          key: `${d.id}__${w.id}`, dest: d, window: w, nights: nightsOf(w),
          cost: d.perNight * nightsOf(w), inSeason, groupScore, fits, blockers,
        });
      }
    }
  }

  const bestPerDest = (list: Option[]) => {
    const seen = new Set<string>();
    return list.filter((o) => (seen.has(o.dest.id) ? false : (seen.add(o.dest.id), true)));
  };

  const viable = bestPerDest(
    all.filter((o) => o.blockers.length === 0).sort((a, b) => b.groupScore - a.groupScore),
  );
  const recommended = viable.slice(0, 3);

  const shownDest = new Set(recommended.map((o) => o.dest.id));
  const near = all
    .filter((o) => o.blockers.length === 1 && !shownDest.has(o.dest.id))
    .map((o) => {
      const others = o.fits.filter((f) => f.status !== "cant").map((f) => f.score);
      const avg = others.length ? others.reduce((a, b) => a + b, 0) / others.length : 0;
      return { o, avg };
    })
    .sort((a, b) => b.avg - a.avg)
    .map((x) => x.o);
  const closeCalls = bestPerDest(near).slice(0, 2);

  // Where the group overlaps
  const budgetEveryoneCan = prefs.length ? Math.min(...prefs.map((p) => p.budgetMax)) : null;
  const budgetEveryoneComfy = prefs.length ? Math.min(...prefs.map((p) => p.budgetComfort)) : null;
  const datesEveryoneCan = meta.windows.filter((w) => prefs.every((p) => (p.avail[w.id] ?? "no") !== "no"));
  const typesNobodyMinds = TYPES.map((t) => t.id).filter((t) => prefs.every((p) => p.types[t] !== "no"));
  const mostLoved = TYPES.map((t) => ({ id: t.id, count: prefs.filter((p) => p.types[t.id] === "love").length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  const wontDos = TAGS.map((t) => ({ tag: t.id, who: prefs.filter((p) => p.wontDo.includes(t.id)).map((p) => p.member) }))
    .filter((x) => x.who.length);

  return {
    recommended,
    closeCalls,
    overlap: { budgetEveryoneCan, budgetEveryoneComfy, datesEveryoneCan, typesNobodyMinds, mostLoved, wontDos },
    submitted,
    pending,
  };
}

export { rupees };
