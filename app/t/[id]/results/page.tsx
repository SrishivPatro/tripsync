"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TAGS, TYPES, destById } from "@/lib/destinations";
import { evaluate, rupees, type Option, type Status } from "@/lib/scoring";
import type { TripPayload } from "@/lib/types";

const STATUS_TEXT: Record<Status, string> = { happy: "Happy", okay: "Okay with it", stretch: "A stretch", cant: "Can't do it" };

function fmt(d: string) {
  return new Date(d + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<TripPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    fetch(`/api/trips/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setTrip(data);
      })
      .catch((e) => setLoadError(e.message || "Couldn't load this trip."));
  }, [id]);

  useEffect(() => {
    setKey(new URLSearchParams(window.location.search).get("key") ?? "");
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const ev = useMemo(() => (trip ? evaluate(trip.meta, trip.responses) : null), [trip]);

  async function act(body: Record<string, string>) {
    setBusy(true);
    setActionError("");
    try {
      const r = await fetch(`/api/trips/${id}/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...body }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setTrip((t) => (t ? { ...t, meta: data.meta } : t));
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <div className="narrow panel"><h2>That link didn't work</h2><p className="muted">{loadError}</p></div>;
  if (!trip || !ev) return <p className="muted">Loading results…</p>;

  const { meta, responses } = trip;
  const isAdmin = Boolean(key);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/t/${id}` : "";
  const nudge = `https://wa.me/?text=${encodeURIComponent(
    `${ev.pending.join(", ")}: we're only waiting on you for the trip 🙂 Two minutes: ${shareUrl}`,
  )}`;
  const decided = meta.decision ? { dest: destById(meta.decision.destId), win: meta.windows.find((w) => w.id === meta.decision!.windowId) } : null;
  const columns: Option[] = [...ev.recommended];

  return (
    <div>
      <section className="hero narrow">
        <h1>{meta.name}</h1>
        <p className="lede">
          {ev.submitted.length === meta.members.length
            ? meta.locked
              ? "Everyone has answered and responses are locked. These are the final options."
              : "Everyone has answered. Options are based on all preferences."
            : `${ev.submitted.length} of ${meta.members.length} have answered, so these options could still change.`}
        </p>
        <div className="status-line" aria-label="Who has answered">
          {meta.members.map((m) => (
            <span key={m} className={`who ${responses[m] ? "in" : "out"}`}>{m}{responses[m] ? " ✓" : ""}</span>
          ))}
        </div>
        {ev.pending.length > 0 && !meta.locked && (
          <div className="row" style={{ marginTop: 14 }}>
            <a className="btn sm" href={nudge} target="_blank" rel="noreferrer">Nudge {ev.pending.join(", ")} on WhatsApp</a>
            <a className="btn ghost sm" href={`/t/${id}`}>Add or edit my answers</a>
          </div>
        )}
      </section>

      {decided?.dest && decided.win && (
        <div className="banner final">
          <h2>It's decided: {decided.dest.name}, {decided.win.label}</h2>
          <p style={{ margin: "6px 0 0" }}>{fmt(decided.win.start)} to {fmt(decided.win.end)}. Time to book tickets.</p>
        </div>
      )}

      {isAdmin && (
        <div className="panel">
          <h3>Coordinator controls</h3>
          <p className="muted small">
            {meta.locked
              ? "Responses are locked. Nobody can change their answers, so these results won't shift. Choose one option below to finish."
              : "Lock responses once everyone has answered. After that, answers can't change and you can choose the final trip."}
          </p>
          <div className="row" style={{ marginTop: 10 }}>
            {meta.locked ? (
              <button className="btn ghost sm" disabled={busy} onClick={() => act({ action: "unlock" })}>Unlock responses</button>
            ) : (
              <button className="btn sm" disabled={busy || ev.submitted.length === 0} onClick={() => act({ action: "lock" })}>
                Lock responses{ev.pending.length ? ` without ${ev.pending.join(", ")}` : ""}
              </button>
            )}
            {meta.decision && <button className="btn quiet sm" disabled={busy} onClick={() => act({ action: "undecide" })}>Clear final choice</button>}
          </div>
          {actionError && <p className="error" role="alert">{actionError}</p>}
        </div>
      )}

      {trip.storage === "memory" && (
        <div className="banner warn small">Test mode: no database is connected, so answers may disappear. See the README to connect one.</div>
      )}

      {ev.submitted.length === 0 ? (
        <div className="panel narrow">
          <h2>No answers yet</h2>
          <p className="muted">Options appear here as soon as the first person answers.</p>
          <a className="btn" href={`/t/${id}`}>Add my preferences</a>
        </div>
      ) : (
        <>
          <section style={{ marginTop: 36 }}>
            <h2>{ev.recommended.length ? "Your best options" : "Nothing works for everyone yet"}</h2>
            {ev.recommended.length === 0 && (
              <p className="muted">
                Every destination and date combination is ruled out for at least one person. The closest calls are below with
                exactly what's blocking each one.
              </p>
            )}
            <div className="options">
              {ev.recommended.map((o, i) => (
                <article key={o.key} className={`option reveal ${i === 0 ? "top" : ""}`}>
                  {i === 0 && <span className="pick">Best fit</span>}
                  <h3>{o.dest.name}</h3>
                  <div className="muted small">{o.dest.region}</div>
                  <div className="score" style={{ marginTop: 14 }}>{o.groupScore}<small>/ 100 group fit</small></div>
                  <ul className="facts">
                    <li><b>{o.window.label}</b>, {fmt(o.window.start)} to {fmt(o.window.end)}</li>
                    <li>About {rupees(o.cost)} per person for {o.nights} night{o.nights > 1 ? "s" : ""}</li>
                    <li>{o.dest.types.map((t) => TYPES.find((x) => x.id === t)?.label).join(", ")}</li>
                    {!o.inSeason && <li style={{ color: "var(--stretch)" }}>Off-season for these dates</li>}
                  </ul>
                  <div className="dots" aria-label="Fit for each person">
                    {o.fits.map((f) => <span key={f.member} className={`dot bg-${f.status}`} title={`${f.member}: ${STATUS_TEXT[f.status]}`} />)}
                  </div>
                  {isAdmin && meta.locked && (
                    <button className="btn sm" style={{ marginTop: 16 }} disabled={busy}
                      onClick={() => act({ action: "decide", destId: o.dest.id, windowId: o.window.id })}>
                      {meta.decision?.destId === o.dest.id && meta.decision.windowId === o.window.id ? "Chosen" : "Choose this trip"}
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>

          {columns.length > 0 && (
            <section style={{ marginTop: 40 }}>
              <h2>Where everyone stands</h2>
              <div className="legend">
                {(["happy", "okay", "stretch", "cant"] as Status[]).map((s) => (
                  <span key={s}><i className={`bg-${s}`} />{STATUS_TEXT[s]}</span>
                ))}
              </div>
              <div className="standings">
                <table>
                  <thead>
                    <tr>
                      <th scope="col"><span>Person</span></th>
                      {columns.map((o) => (
                        <th scope="col" key={o.key}>{o.dest.name}<span>{o.window.label}</span></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ev.submitted.map((m) => (
                      <tr key={m}>
                        <th scope="row">{m}</th>
                        {columns.map((o) => {
                          const f = o.fits.find((x) => x.member === m)!;
                          return (
                            <td key={o.key}>
                              <div className={`cell s-${f.status}`}>
                                <b>{STATUS_TEXT[f.status]}{f.status !== "cant" ? ` · ${f.score}` : ""}</b>
                                <ul>{f.reasons.map((r, i) => <li key={i}>{r.text}</li>)}</ul>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {ev.closeCalls.length > 0 && (
            <section style={{ marginTop: 40 }}>
              <h2>Almost worked</h2>
              <p className="muted">Each of these was ruled out by one person. If they're willing to bend, it's back on the table.</p>
              <div className="options">
                {ev.closeCalls.map((o) => {
                  const b = o.blockers[0];
                  return (
                    <article key={o.key} className="option">
                      <h3>{o.dest.name}</h3>
                      <div className="muted small">{o.window.label}, about {rupees(o.cost)} per person</div>
                      <div className="cell s-cant" style={{ marginTop: 12 }}>
                        <b>{b.member} can't do it</b>
                        <ul>{b.reasons.filter((r) => r.tone === "bad").map((r, i) => <li key={i}>{r.text}</li>)}</ul>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="panel" style={{ marginTop: 40 }}>
            <h2>Where the group overlaps</h2>
            <dl className="overlap">
              <div>
                <dt>Budget everyone can manage</dt>
                <dd>Up to {rupees(ev.overlap.budgetEveryoneCan ?? 0)} each ({rupees(ev.overlap.budgetEveryoneComfy ?? 0)} comfortably)</dd>
              </div>
              <div>
                <dt>Dates nobody said no to</dt>
                <dd>{ev.overlap.datesEveryoneCan.length ? ev.overlap.datesEveryoneCan.map((w) => w.label).join(", ") : "None yet"}</dd>
              </div>
              <div>
                <dt>Most loved</dt>
                <dd>
                  {ev.overlap.mostLoved.length
                    ? ev.overlap.mostLoved.slice(0, 3).map((x) => `${TYPES.find((t) => t.id === x.id)?.label} (${x.count})`).join(", ")
                    : "Nothing stands out"}
                </dd>
              </div>
              <div>
                <dt>Dealbreakers</dt>
                <dd>
                  {ev.overlap.wontDos.length
                    ? ev.overlap.wontDos.map((x) => `${x.who.join(", ")}: ${TAGS.find((t) => t.id === x.tag)?.label.toLowerCase()}`).join("; ")
                    : "None"}
                </dd>
              </div>
            </dl>
            {ev.submitted.some((m) => responses[m].note) && (
              <>
                <h3 style={{ marginTop: 24 }}>Notes</h3>
                <ul>
                  {ev.submitted.filter((m) => responses[m].note).map((m) => <li key={m}><b>{m}:</b> {responses[m].note}</li>)}
                </ul>
              </>
            )}
          </section>

          <p className="muted small" style={{ marginTop: 24 }}>
            Costs and travel times are rough estimates to compare options, not quotes. Group fit weighs the average and the least
            happy person equally, so an option only scores well if it works for everyone.
          </p>
        </>
      )}
    </div>
  );
}
