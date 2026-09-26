"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CITIES, TAGS, TYPES } from "@/lib/destinations";
import { rupees } from "@/lib/scoring";
import type { Avail, City, Feel, Prefs, Tag, TripPayload, TypeId } from "@/lib/types";
import { Avatar, colorFor } from "@/lib/ui";

type Draft = Omit<Prefs, "member" | "updatedAt">;

function blankDraft(p: TripPayload): Draft {
  return {
    homeCity: "Bengaluru",
    budgetComfort: 12000,
    budgetMax: 18000,
    maxHours: 7,
    avail: Object.fromEntries(p.meta.windows.map((w) => [w.id, "" as Avail])),
    types: Object.fromEntries(TYPES.map((t) => [t.id, "fine"])) as Record<TypeId, Feel>,
    wontDo: [],
    note: "",
  };
}

function Seg<T extends string>({ value, options, onChange, label }: {
  value: T; label: string; onChange: (v: T) => void;
  options: { v: T; text: string; tone: "good" | "meh" | "bad" | "mid" }[];
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" className={`t-${o.tone}`} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {o.text}
        </button>
      ))}
    </div>
  );
}

const fmt = (d: string) => new Date(d + "T00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

export default function TripForm() {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<TripPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [member, setMember] = useState("");
  const [d, setD] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/trips/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setTrip(data);
      })
      .catch((e) => setLoadError(e.message || "Couldn't load this trip."));
  }, [id]);

  function pick(m: string) {
    if (!trip) return;
    setMember(m);
    setSaved(false);
    setError("");
    const existing = trip.responses[m];
    if (existing) {
      const { member: _m, updatedAt: _u, ...rest } = existing;
      setD({ ...blankDraft(trip), ...rest, note: rest.note ?? "" });
    } else setD(blankDraft(trip));
  }

  async function save() {
    if (!trip || !d) return;
    const missing = trip.meta.windows.find((w) => !d.avail[w.id]);
    if (missing) return setError(`Answer every date, including ${missing.label}.`);
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/trips/${id}/responses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member, ...d }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setTrip({ ...trip, responses: { ...trip.responses, [member]: data.prefs } });
      setSaved(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message || "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError)
    return (
      <div className="wrap narrow" style={{ marginTop: 40 }}>
        <div className="card center-empty"><h2>That link didn't work</h2><p>{loadError} Ask the coordinator to resend it.</p><a className="btn" href="/">Start a new trip</a></div>
      </div>
    );
  if (!trip) return <div className="band"><div className="wrap"><p className="lede">Loading trip…</p></div></div>;

  const { meta, responses } = trip;
  const done = meta.members.filter((m) => responses[m]).length;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => (cur ? { ...cur, [k]: v } : cur));
  const datesDone = d ? meta.windows.filter((w) => d.avail[w.id]).length : 0;

  return (
    <>
      <section className="band">
        <div className="wrap narrow">
          <h1>{meta.name}</h1>
          <p className="lede">
            {meta.coordinator} is collecting everyone's preferences. {done} of {meta.members.length} have answered.
          </p>
          <div className="crew">
            {meta.members.map((m) => (
              <div className={`crew-item ${responses[m] ? "" : "out"}`} key={m}>
                <Avatar name={m} color={colorFor(meta.members, m)} size={34} dim={!responses[m]} />
                <div>{m}<small>{responses[m] ? "Answered" : "Waiting"}</small></div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 20 }}><a href={`/t/${id}/results`}>See the options so far</a></p>
        </div>
      </section>

      <div className="wrap narrow lift">
        {meta.locked && (
          <div className="notice warn">{meta.coordinator} has locked responses, so answers can't change now. <a href={`/t/${id}/results`}>See the results</a></div>
        )}
        {trip.storage === "memory" && (
          <div className="notice warn">Test mode: no database is connected, so answers may disappear.</div>
        )}
        {saved && (
          <div className="notice good">
            <span><b>Saved, {member}.</b> You can change your answers until {meta.coordinator} locks them. <a href={`/t/${id}/results`}>See where the group stands</a></span>
          </div>
        )}

        <div className="card">
          <div className="card-head">
            <div><h2>Who are you?</h2><p>Tap your name to start, or to edit what you sent before.</p></div>
          </div>
          <div className="card-body who-pick">
            {meta.members.map((m) => (
              <button key={m} className="who-btn" aria-pressed={member === m} onClick={() => pick(m)}>
                <Avatar name={m} color={colorFor(meta.members, m)} size={30} />
                {m}{responses[m] && <small>✓</small>}
              </button>
            ))}
          </div>
        </div>

        {member && d && !meta.locked && (
          <>
            <div className="card">
              <div className="card-head">
                <span className="step">1</span>
                <div><h2>Which dates work?</h2><p>&ldquo;If needed&rdquo; means you'd rearrange things for it.</p></div>
              </div>
              <div className="card-body">
                {meta.windows.map((w) => (
                  <div className="qrow" key={w.id}>
                    <div><b>{w.label}</b><div className="sub">{fmt(w.start)} to {fmt(w.end)}</div></div>
                    <Seg<Avail>
                      label={`Availability for ${w.label}`}
                      value={d.avail[w.id]}
                      onChange={(v) => set("avail", { ...d.avail, [w.id]: v })}
                      options={[{ v: "yes", text: "Yes", tone: "good" }, { v: "maybe", text: "If needed", tone: "meh" }, { v: "no", text: "No", tone: "bad" }]}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <span className="step">2</span>
                <div><h2>Budget and travel</h2><p>Per person for the whole trip: stay, food, local travel and activities. Tickets to get there aren't included.</p></div>
              </div>
              <div className="card-body">
                <div className="field">
                  <label htmlFor="city">Travelling from</label>
                  <select id="city" value={d.homeCity} onChange={(e) => set("homeCity", e.target.value as City)}>
                    {CITIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <div className="range"><label htmlFor="bc">Comfortable spend</label><b>{rupees(d.budgetComfort)}</b></div>
                  <input id="bc" type="range" min={3000} max={60000} step={1000} value={d.budgetComfort}
                    onChange={(e) => { const v = Number(e.target.value); setD({ ...d, budgetComfort: v, budgetMax: Math.max(v, d.budgetMax) }); }} />
                </div>
                <div className="field">
                  <div className="range"><label htmlFor="bm">Absolute max</label><b>{rupees(d.budgetMax)}</b></div>
                  <p className="hint">Anything above this is a no from you.</p>
                  <input id="bm" type="range" min={3000} max={80000} step={1000} value={d.budgetMax}
                    onChange={(e) => { const v = Number(e.target.value); setD({ ...d, budgetMax: v, budgetComfort: Math.min(v, d.budgetComfort) }); }} />
                </div>
                <div className="field">
                  <div className="range"><label htmlFor="hrs">Longest you'll travel one way</label><b>{d.maxHours} hrs</b></div>
                  <p className="hint">Door to door, including getting to the airport or station.</p>
                  <input id="hrs" type="range" min={2} max={14} step={1} value={d.maxHours} onChange={(e) => set("maxHours", Number(e.target.value))} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <span className="step">3</span>
                <div><h2>What kind of trip?</h2><p>&ldquo;Fine&rdquo; is the default. Only mark what you feel strongly about.</p></div>
              </div>
              <div className="card-body">
                {TYPES.map((t) => (
                  <div className="qrow" key={t.id}>
                    <span>{t.label}</span>
                    <Seg<Feel>
                      label={t.label}
                      value={d.types[t.id]}
                      onChange={(v) => set("types", { ...d.types, [t.id]: v })}
                      options={[{ v: "love", text: "Love it", tone: "good" }, { v: "fine", text: "Fine", tone: "mid" }, { v: "no", text: "Rather not", tone: "bad" }]}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <span className="step">4</span>
                <div><h2>What won't you do?</h2><p>Only real dealbreakers. Any option with one of these is ruled out for the whole group.</p></div>
              </div>
              <div className="card-body">
                <div className="chips">
                  {TAGS.map((t) => {
                    const on = d.wontDo.includes(t.id);
                    return (
                      <button key={t.id} className="chip" aria-pressed={on}
                        onClick={() => set("wontDo", on ? d.wontDo.filter((x) => x !== t.id) : [...d.wontDo, t.id as Tag])}>
                        {on ? "✕ " : ""}{t.label}
                      </button>
                    );
                  })}
                </div>
                <div className="field" style={{ marginTop: 20 }}>
                  <label htmlFor="note">Anything else? <span className="muted small">(optional)</span></label>
                  <textarea id="note" maxLength={280} placeholder="Vegetarian food matters, I'd love one sunrise…" value={d.note ?? ""} onChange={(e) => set("note", e.target.value)} />
                </div>
                {error && <p className="error" role="alert">{error}</p>}
              </div>
            </div>
          </>
        )}
        <div style={{ height: 40 }} />
      </div>

      {member && d && !meta.locked && (
        <div className="savebar">
          <div className="wrap narrow">
            <div style={{ flex: 1 }}>
              <div className="small muted">{datesDone} of {meta.windows.length} dates answered</div>
              <div className="progress"><i style={{ width: `${(datesDone / Math.max(1, meta.windows.length)) * 100}%` }} /></div>
            </div>
            <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save my preferences"}</button>
          </div>
        </div>
      )}
    </>
  );
}
