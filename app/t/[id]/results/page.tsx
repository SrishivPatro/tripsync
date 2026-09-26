"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TAGS, TYPES, destById } from "@/lib/destinations";
import { evaluate, rupees, type Status } from "@/lib/scoring";
import type { TripPayload } from "@/lib/types";
import { Avatar, colorFor } from "@/lib/ui";

const STATUS_TEXT: Record<Status, string> = { happy: "Happy", okay: "Okay with it", stretch: "A stretch", cant: "Can't do it" };
const STATUS_COLOR: Record<Status, string> = { happy: "var(--happy)", okay: "var(--okay)", stretch: "var(--stretch)", cant: "var(--cant)" };
const RANK = ["1st", "2nd", "3rd"];

type BriefData = { headline: string; summary: string; picks: { option: string; why: string }[]; watchouts: string[]; whatsapp: string; model: string; at: string };
type BriefState = { status: "idle" | "loading" | "off" | "empty" | "error" | "ready"; data?: BriefData; stale?: boolean; message?: string };

function BriefCard({ brief }: { brief: BriefState }) {
  const [copied, setCopied] = useState(false);
  if (brief.status === "off" || brief.status === "idle" || brief.status === "empty") return null;
  if (brief.status === "loading" && !brief.data)
    return (
      <div className="card brief" style={{ marginTop: 18 }}>
        <div className="brief-by"><span className="spark" />Gemini is reading everyone's answers…</div>
        <div className="skeleton" /><div className="skeleton short" />
      </div>
    );
  if (!brief.data)
    return <div className="notice warn" style={{ marginTop: 18 }}>{brief.message || "The group briefing isn't available right now."} The options below are unaffected.</div>;
  const b = brief.data;
  const wa = `https://wa.me/?text=${encodeURIComponent(b.whatsapp)}`;
  return (
    <div className="card brief" style={{ marginTop: 18 }}>
      <div className="brief-by"><span className="spark" />Group briefing by Gemini{brief.stale ? " (from earlier answers)" : ""}</div>
      <h2>{b.headline}</h2>
      <p className="brief-summary">{b.summary}</p>
      <div className="brief-grid">
        {b.picks.length > 0 && (
          <div>
            <h4>Option by option</h4>
            <ul className="brief-list">{b.picks.map((p, i) => <li key={i}><b>{RANK[i] ?? ""} {p.option}:</b> {p.why}</li>)}</ul>
          </div>
        )}
        {b.watchouts.length > 0 && (
          <div>
            <h4>Before you book</h4>
            <ul className="brief-list warn">{b.watchouts.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}
      </div>
      {b.whatsapp && (
        <div className="brief-msg">
          <h4>Message for the group</h4>
          <blockquote>{b.whatsapp}</blockquote>
          <div className="row">
            <a className="btn sm" href={wa} target="_blank" rel="noreferrer">Send on WhatsApp</a>
            <button className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(b.whatsapp); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy message"}</button>
          </div>
        </div>
      )}
      <p className="brief-foot">Written by {b.model} from the scored options and everyone's notes. The ranking itself comes from the scoring rules, not the AI.</p>
    </div>
  );
}

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
  const [brief, setBrief] = useState<BriefState>({ status: "idle" });

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

  // Ask for a fresh Gemini briefing only when someone's answers (or the lock) actually change.
  const sig = trip
    ? trip.meta.members.map((m) => trip.responses[m]?.updatedAt ?? "-").join("|") + String(trip.meta.locked) + (trip.meta.decision?.destId ?? "")
    : "";
  useEffect(() => {
    if (!sig) return;
    let cancelled = false;
    setBrief((b) => ({ ...b, status: "loading" }));
    fetch(`/api/trips/${id}/brief`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.enabled === false) setBrief({ status: "off" });
        else if (d.brief) setBrief({ status: "ready", data: d.brief, stale: d.stale });
        else setBrief({ status: d.error ? "error" : "empty", message: d.error || d.reason });
      })
      .catch(() => !cancelled && setBrief({ status: "error", message: "Couldn't reach Gemini." }));
    return () => { cancelled = true; };
  }, [sig, id]);

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

  if (loadError)
    return (
      <div className="wrap narrow" style={{ marginTop: 40 }}>
        <div className="card center-empty"><h2>That link didn't work</h2><p>{loadError}</p><a className="btn" href="/">Start a new trip</a></div>
      </div>
    );
  if (!trip || !ev) return <div className="band"><div className="wrap"><p className="lede">Loading results…</p></div></div>;

  const { meta, responses } = trip;
  const isAdmin = Boolean(key);
  const col = (m: string) => colorFor(meta.members, m);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/t/${id}` : "";
  const nudge = `https://wa.me/?text=${encodeURIComponent(
    `${ev.pending.join(", ")}: we're only waiting on you for the trip 🙂 Two minutes: ${shareUrl}`,
  )}`;
  const decided = meta.decision
    ? { dest: destById(meta.decision.destId), win: meta.windows.find((w) => w.id === meta.decision!.windowId) }
    : null;
  const all = ev.submitted.length === meta.members.length;
  const typeName = (t: string) => TYPES.find((x) => x.id === t)?.label ?? t;

  return (
    <>
      <section className="band">
        <div className="wrap">
          <h1>{meta.name}</h1>
          <p className="lede">
            {all
              ? meta.locked
                ? "Everyone has answered and responses are locked. These are the final options."
                : "Everyone has answered. These options use all five sets of preferences."
              : `${ev.submitted.length} of ${meta.members.length} have answered, so these options could still change.`}
          </p>
          <div className="crew">
            {meta.members.map((m) => (
              <div className={`crew-item ${responses[m] ? "" : "out"}`} key={m}>
                <Avatar name={m} color={col(m)} size={34} dim={!responses[m]} />
                <div>{m}<small>{responses[m] ? "Answered" : "Waiting"}</small></div>
              </div>
            ))}
          </div>
          {ev.pending.length > 0 && !meta.locked && (
            <div className="row" style={{ marginTop: 22 }}>
              <a className="btn" href={nudge} target="_blank" rel="noreferrer">Nudge {ev.pending.join(", ")} on WhatsApp</a>
              <a className="btn ghost" href={`/t/${id}`}>Add or edit my answers</a>
            </div>
          )}
        </div>
      </section>

      <div className="wrap lift">
        {ev.submitted.length > 0 && (
          <dl className="stats">
            <div><dt>Answered</dt><dd>{ev.submitted.length} of {meta.members.length}</dd></div>
            <div><dt>Dates nobody ruled out</dt><dd>{ev.overlap.datesEveryoneCan.length ? `${ev.overlap.datesEveryoneCan[0].label}${ev.overlap.datesEveryoneCan.length > 1 ? ` +${ev.overlap.datesEveryoneCan.length - 1} more` : ""}` : "None yet"}</dd></div>
            <div><dt>Budget everyone can do</dt><dd>Up to {rupees(ev.overlap.budgetEveryoneCan ?? 0)}</dd></div>
            <div><dt>Best fit right now</dt><dd>{ev.recommended[0]?.dest.name ?? "No match yet"}</dd></div>
          </dl>
        )}

        {ev.submitted.length > 0 && <BriefCard brief={brief} />}

        {decided?.dest && decided.win && (
          <div className="decided" style={{ marginTop: 18 }}>
            <div>
              <h2>It's decided: {decided.dest.name}</h2>
              <p style={{ marginTop: 4 }}>{decided.win.label}, {fmt(decided.win.start)} to {fmt(decided.win.end)}. Time to book tickets.</p>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="card admin" style={{ marginTop: 18 }}>
            <div className="card-head">
              <div>
                <h2>Coordinator controls</h2>
                <p>
                  {meta.locked
                    ? "Responses are locked. Nobody can change their answers, so these results won't shift. Choose one option below to finish."
                    : "Lock responses once everyone has answered. After that, answers can't change and you can choose the final trip."}
                </p>
              </div>
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              {meta.locked ? (
                <button className="btn ghost sm" disabled={busy} onClick={() => act({ action: "unlock" })}>Unlock responses</button>
              ) : (
                <button className="btn dark" disabled={busy || ev.submitted.length === 0} onClick={() => act({ action: "lock" })}>
                  Lock responses{ev.pending.length ? ` without ${ev.pending.join(", ")}` : ""}
                </button>
              )}
              {meta.decision && <button className="btn link sm" disabled={busy} onClick={() => act({ action: "undecide" })}>Clear final choice</button>}
            </div>
            {actionError && <p className="error" role="alert">{actionError}</p>}
          </div>
        )}

        {trip.storage === "memory" && (
          <div className="notice warn" style={{ marginTop: 18 }}>Test mode: no database is connected, so answers may disappear.</div>
        )}

        {ev.submitted.length === 0 ? (
          <div className="card center-empty" style={{ marginTop: 18 }}>
            <h2>No answers yet</h2>
            <p>Options appear here as soon as the first person answers.</p>
            <a className="btn" href={`/t/${id}`}>Add my preferences</a>
          </div>
        ) : (
          <>
            <section className="section">
              <div className="section-head">
                <div>
                  <h2>{ev.recommended.length ? "Your best options" : "Nothing works for everyone yet"}</h2>
                  <p>
                    {ev.recommended.length
                      ? "Ranked by how well each works for the whole group, not just the majority."
                      : "Every option is ruled out for at least one person. See what's blocking the closest calls below."}
                  </p>
                </div>
              </div>
              <div className="podium">
                {ev.recommended.map((o, i) => {
                  const chosen = meta.decision?.destId === o.dest.id && meta.decision.windowId === o.window.id;
                  return (
                    <article key={o.key} className={`opt ${i === 0 ? "first" : ""}`}>
                      <div className="opt-top">
                        <div className="rank">{RANK[i]}</div>
                        <h3>{o.dest.name}</h3>
                        <div className="region">{o.dest.region}</div>
                        {i === 0 && <span className="opt-badge">Best fit</span>}
                      </div>
                      <div className="opt-body">
                        <div className="meter">
                          <div className="meter-num">{o.groupScore}</div>
                          <div className="meter-bar">
                            <small>Group fit out of 100</small>
                            <div className="meter-track"><i style={{ width: `${o.groupScore}%` }} /></div>
                          </div>
                        </div>
                        <ul className="facts">
                          <li><span>When</span><b>{o.window.label}<br />{fmt(o.window.start)} to {fmt(o.window.end)}</b></li>
                          <li><span>Cost per person</span><b>~{rupees(o.cost)} · {o.nights} night{o.nights > 1 ? "s" : ""}</b></li>
                        </ul>
                        <div className="tags">
                          {o.dest.types.map((t) => <span className="tag" key={t}>{typeName(t)}</span>)}
                          {!o.inSeason && <span className="tag warn">Off-season</span>}
                        </div>
                        <div className="faces" aria-label="How each person feels">
                          {o.fits.map((f) => (
                            <Avatar key={f.member} name={f.member} color={col(f.member)} size={30} ring={STATUS_COLOR[f.status]} title={`${f.member}: ${STATUS_TEXT[f.status]}`} />
                          ))}
                        </div>
                        {isAdmin && meta.locked && (
                          <button className={`btn ${chosen ? "dark" : ""} sm`} disabled={busy || chosen}
                            onClick={() => act({ action: "decide", destId: o.dest.id, windowId: o.window.id })}>
                            {chosen ? "Chosen ✓" : "Choose this trip"}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {ev.recommended.length > 0 && (
              <section className="section">
                <div className="section-head">
                  <div>
                    <h2>Where everyone stands</h2>
                    <p>Each person's verdict on each option, and the reason behind it.</p>
                  </div>
                  <div className="legend">
                    {(["happy", "okay", "stretch", "cant"] as Status[]).map((s) => (
                      <span key={s}><i className={`bg-${s}`} />{STATUS_TEXT[s]}</span>
                    ))}
                  </div>
                </div>
                <div className="standings">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col"><span>Person</span></th>
                        {ev.recommended.map((o, i) => <th scope="col" key={o.key}>{RANK[i]} · {o.dest.name}<span>{o.window.label}</span></th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {ev.submitted.map((m) => (
                        <tr key={m}>
                          <th scope="row">
                            <div className="p">
                              <Avatar name={m} color={col(m)} size={32} />
                              <div>{m}<small>From {responses[m].homeCity}</small></div>
                            </div>
                          </th>
                          {ev.recommended.map((o) => {
                            const f = o.fits.find((x) => x.member === m)!;
                            return (
                              <td key={o.key}>
                                <div className={`cell s-${f.status}`}>
                                  <b><span>{STATUS_TEXT[f.status]}</span>{f.status !== "cant" && <span>{f.score}</span>}</b>
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

            <section className="section two">
              <div className="card">
                <h2>Almost worked</h2>
                <p className="muted" style={{ marginTop: 4 }}>Each was ruled out by one person. If they're willing to bend, it's back on the table.</p>
                <div style={{ marginTop: 16 }}>
                  {ev.closeCalls.length === 0 && <p className="muted">No near misses.</p>}
                  {ev.closeCalls.map((o) => {
                    const b = o.blockers[0];
                    return (
                      <div className="miss" key={o.key}>
                        <h4>{o.dest.name}</h4>
                        <div className="small muted">{o.window.label} · ~{rupees(o.cost)} per person</div>
                        <div className="by">
                          <Avatar name={b.member} color={col(b.member)} size={24} />
                          {b.member}: {b.reasons.filter((r) => r.tone === "bad").map((r) => r.text).join("; ")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card">
                <h2>Where the group overlaps</h2>
                <dl className="overlap" style={{ marginTop: 16 }}>
                  <div><dt>Budget</dt><dd>Up to {rupees(ev.overlap.budgetEveryoneCan ?? 0)} each ({rupees(ev.overlap.budgetEveryoneComfy ?? 0)} comfortably)</dd></div>
                  <div><dt>Dates</dt><dd>{ev.overlap.datesEveryoneCan.length ? ev.overlap.datesEveryoneCan.map((w) => w.label).join(", ") : "None that everyone can do"}</dd></div>
                  <div>
                    <dt>Most loved</dt>
                    <dd>{ev.overlap.mostLoved.length ? ev.overlap.mostLoved.slice(0, 3).map((x) => `${typeName(x.id)} (${x.count})`).join(", ") : "Nothing stands out"}</dd>
                  </div>
                  <div>
                    <dt>Dealbreakers</dt>
                    <dd>{ev.overlap.wontDos.length ? ev.overlap.wontDos.map((x) => `${x.who.join(", ")}: ${TAGS.find((t) => t.id === x.tag)?.label.toLowerCase()}`).join("; ") : "None"}</dd>
                  </div>
                </dl>
                {ev.submitted.some((m) => responses[m].note) && (
                  <>
                    <h3 style={{ marginTop: 22 }}>Notes from the group</h3>
                    <ul className="notes">
                      {ev.submitted.filter((m) => responses[m].note).map((m) => (
                        <li key={m}><Avatar name={m} color={col(m)} size={26} /><span><b>{m}:</b> {responses[m].note}</span></li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>

            <p className="foot">
              Costs and travel times are rough estimates to compare options, not quotes. Group fit weighs the average and the least
              happy person equally, so an option only scores well if it works for everyone.
            </p>
          </>
        )}
        <div style={{ height: 40 }} />
      </div>
    </>
  );
}
