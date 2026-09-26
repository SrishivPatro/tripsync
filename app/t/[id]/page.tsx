"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CITIES, TAGS, TYPES } from "@/lib/destinations";
import { rupees } from "@/lib/scoring";
import type { Avail, City, Feel, Prefs, Tag, TripPayload, TypeId } from "@/lib/types";

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
  options: { v: T; text: string; tone: "good" | "meh" | "bad" }[];
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
    if (missing) return setError(`Answer every date window, including ${missing.label}.`);
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

  if (loadError) return <div className="narrow panel"><h2>That link didn't work</h2><p className="muted">{loadError} Ask the coordinator to resend it.</p></div>;
  if (!trip) return <p className="muted">Loading trip…</p>;

  const { meta, responses } = trip;
  const done = meta.members.filter((m) => responses[m]).length;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => (cur ? { ...cur, [k]: v } : cur));

  return (
    <div className="narrow">
      <section className="hero">
        <h1>{meta.name}</h1>
        <p className="lede">
          {meta.coordinator} is collecting everyone's preferences. {done} of {meta.members.length} have answered.
        </p>
        <p style={{ marginTop: 12 }}><a href={`/t/${id}/results`}>See the options so far</a></p>
      </section>

      {meta.locked && (
        <div className="banner warn">
          {meta.coordinator} has locked responses, so answers can't change now. <a href={`/t/${id}/results`}>See the results</a>.
        </div>
      )}
      {trip.storage === "memory" && (
        <div className="banner warn small">Test mode: no database is connected, so answers may disappear. See the README to connect one.</div>
      )}

      {saved && (
        <div className="banner final">
          <b>Saved, {member}.</b> You can change your answers until {meta.coordinator} locks them.{" "}
          <a href={`/t/${id}/results`}>See where the group stands</a>
        </div>
      )}

      <div className="panel">
        <h3>Who are you?</h3>
        <div className="chips" style={{ marginTop: 12 }}>
          {meta.members.map((m) => (
            <button key={m} className={`chip ${responses[m] ? "done" : ""}`} aria-pressed={member === m} onClick={() => pick(m)}>
              {m}
            </button>
          ))}
        </div>
        {member && responses[member] && !saved && <p className="hint" style={{ marginTop: 10 }}>You answered already. Change anything below and save again.</p>}
      </div>

      {member && d && !meta.locked && (
        <>
          <div className="panel">
            <h3>Which dates work?</h3>
            <p className="hint">&ldquo;If needed&rdquo; means you'd rearrange things for it.</p>
            <div style={{ marginTop: 8 }}>
              {meta.windows.map((w) => (
                <div className="qrow" key={w.id}>
                  <div>
                    <b>{w.label}</b>
                    <div className="small muted">{new Date(w.start + "T00:00").toDateString()} to {new Date(w.end + "T00:00").toDateString()}</div>
                  </div>
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

          <div className="panel">
            <h3>Budget and travel</h3>
            <div className="field">
              <label htmlFor="city">Travelling from</label>
              <select id="city" value={d.homeCity} onChange={(e) => set("homeCity", e.target.value as City)}>
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bc">Comfortable spend: {rupees(d.budgetComfort)}</label>
              <p className="hint">Per person for the whole trip: stay, food, local travel and activities. Tickets to get there aren't included.</p>
              <input id="bc" type="range" min={3000} max={60000} step={1000} value={d.budgetComfort}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setD({ ...d, budgetComfort: v, budgetMax: Math.max(v, d.budgetMax) });
                }} />
            </div>
            <div className="field">
              <label htmlFor="bm">Absolute max: {rupees(d.budgetMax)}</label>
              <p className="hint">Anything above this is a no from you.</p>
              <input id="bm" type="range" min={3000} max={80000} step={1000} value={d.budgetMax}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setD({ ...d, budgetMax: v, budgetComfort: Math.min(v, d.budgetComfort) });
                }} />
            </div>
            <div className="field">
              <label htmlFor="hrs">Longest you'll travel one way: {d.maxHours} hours</label>
              <p className="hint">Door to door, including getting to the airport or station.</p>
              <input id="hrs" type="range" min={2} max={14} step={1} value={d.maxHours} onChange={(e) => set("maxHours", Number(e.target.value))} />
            </div>
          </div>

          <div className="panel">
            <h3>What kind of trip?</h3>
            <div style={{ marginTop: 8 }}>
              {TYPES.map((t) => (
                <div className="qrow" key={t.id}>
                  <span>{t.label}</span>
                  <Seg<Feel>
                    label={t.label}
                    value={d.types[t.id]}
                    onChange={(v) => set("types", { ...d.types, [t.id]: v })}
                    options={[{ v: "love", text: "Love it", tone: "good" }, { v: "fine", text: "Fine", tone: "meh" }, { v: "no", text: "Rather not", tone: "bad" }]}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3>What won't you do?</h3>
            <p className="hint">Only pick real dealbreakers. Any option with one of these is ruled out for the whole group.</p>
            <div className="chips" style={{ marginTop: 10 }}>
              {TAGS.map((t) => {
                const on = d.wontDo.includes(t.id);
                return (
                  <button key={t.id} className="chip" aria-pressed={on}
                    onClick={() => set("wontDo", on ? d.wontDo.filter((x) => x !== t.id) : [...d.wontDo, t.id as Tag])}>
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div className="field">
              <label htmlFor="note">Anything else? <span className="muted small">(optional)</span></label>
              <textarea id="note" maxLength={280} placeholder="Vegetarian food matters, I'd love one sunrise…" value={d.note ?? ""} onChange={(e) => set("note", e.target.value)} />
            </div>
          </div>

          {error && <p className="error" role="alert">{error}</p>}
          <div style={{ marginTop: 20 }}>
            <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save my preferences"}</button>
          </div>
        </>
      )}
    </div>
  );
}
