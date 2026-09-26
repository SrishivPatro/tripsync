"use client";

import { useState } from "react";
import { Avatar, PALETTE, RouteArt } from "@/lib/ui";

type WinDraft = { label: string; start: string; end: string };

const DEFAULT_WINDOWS: WinDraft[] = [
  { label: "Last weekend of October", start: "2026-10-30", end: "2026-11-01" },
  { label: "Mid-November weekend", start: "2026-11-20", end: "2026-11-22" },
  { label: "Christmas weekend", start: "2026-12-25", end: "2026-12-27" },
];

const ASKED = [
  "Which of your weekends work: yes, if needed, or no",
  "A comfortable budget and an absolute max",
  "The longest they'll travel from their city",
  "How they feel about beaches, mountains, heritage and more",
  "Real dealbreakers, like long treks or a party scene",
];

export default function CreateTrip() {
  const [name, setName] = useState("");
  const [coordinator, setCoordinator] = useState("");
  const [friends, setFriends] = useState<string[]>(["", "", "", ""]);
  const [windows, setWindows] = useState<WinDraft[]>(DEFAULT_WINDOWS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id: string; adminKey: string } | null>(null);
  const [copied, setCopied] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function create() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, coordinator, members: [coordinator, ...friends], windows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create the trip.");
      setCreated(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, which: string) {
    navigator.clipboard?.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(""), 1500);
  }

  if (created) {
    const share = `${origin}/t/${created.id}`;
    const admin = `${origin}/t/${created.id}/results?key=${created.adminKey}`;
    const wa = `https://wa.me/?text=${encodeURIComponent(
      `Trip planning, one last time 🙏 Add your dates, budget and must-avoids here (takes 2 minutes): ${share}`,
    )}`;
    const everyone = [coordinator, ...friends].map((f) => f.trim()).filter(Boolean);
    return (
      <>
        <section className="band">
          <div className="wrap narrow">
            <h1>{name} is ready</h1>
            <p className="lede">Send the group link once. Keep the coordinator link to yourself.</p>
            <div className="crew">
              {everyone.map((m, i) => (
                <div className="crew-item" key={m}><Avatar name={m} color={PALETTE[i % PALETTE.length]} size={34} />{m}</div>
              ))}
            </div>
          </div>
        </section>
        <div className="wrap narrow lift">
          <div className="card">
            <div className="card-head">
              <span className="step">1</span>
              <div><h2>Share this with the group</h2><p>Everyone taps their name and answers. Takes about two minutes.</p></div>
            </div>
            <div className="card-body">
              <div className="linkbox">
                <input type="text" readOnly value={share} aria-label="Group link" />
                <button className="btn ghost" onClick={() => copy(share, "share")}>{copied === "share" ? "Copied" : "Copy"}</button>
              </div>
              <div className="row" style={{ marginTop: 14 }}>
                <a className="btn" href={wa} target="_blank" rel="noreferrer">Share on WhatsApp</a>
                <a className="btn ghost" href={share}>Add my own preferences</a>
              </div>
            </div>
          </div>
          <div className="card admin">
            <div className="card-head">
              <span className="step">2</span>
              <div><h2>Keep your coordinator link</h2><p>It opens the results with controls to lock answers and choose the final trip. Bookmark it; it can't be recovered.</p></div>
            </div>
            <div className="card-body">
              <div className="linkbox">
                <input type="text" readOnly value={admin} aria-label="Coordinator link" />
                <button className="btn ghost" onClick={() => copy(admin, "admin")}>{copied === "admin" ? "Copied" : "Copy"}</button>
              </div>
              <div className="row" style={{ marginTop: 14 }}><a className="btn dark" href={admin}>Open results</a></div>
            </div>
          </div>
        </div>
        <div style={{ height: 60 }} />
      </>
    );
  }

  return (
    <>
      <section className="band">
        <div className="wrap hero-grid">
          <div>
            <h1>Five friends. Five cities. One trip.</h1>
            <p className="lede">
              Everyone adds their dates, budget and dealbreakers once. You get the three trips that work for the whole group,
              and exactly where each person stands on each one.
            </p>
            <div className="how">
              <div><b><span className="n">1</span>Set it up</b><p>Names and a few possible weekends.</p></div>
              <div><b><span className="n">2</span>Everyone answers</b><p>Two minutes each, from one link.</p></div>
              <div><b><span className="n">3</span>Decide</b><p>Lock answers, compare three options, pick one.</p></div>
            </div>
          </div>
          <RouteArt />
        </div>
      </section>

      <div className="wrap lift cols">
        <div>
          <div className="card">
            <div className="card-head">
              <span className="step">1</span>
              <div><h2>Name the trip</h2><p>Something the group will recognise.</p></div>
            </div>
            <div className="card-body">
              <div className="field">
                <label htmlFor="tname">Trip name</label>
                <input id="tname" type="text" placeholder="College gang trip 2026" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="cname">Your name</label>
                <input id="cname" type="text" placeholder="Riya" value={coordinator} onChange={(e) => setCoordinator(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="step">2</span>
              <div><h2>Who else is coming?</h2><p>Use the names people go by in the group chat.</p></div>
            </div>
            <div className="card-body">
              {friends.map((f, i) => (
                <div className="person-row" key={i}>
                  <Avatar name={f || "?"} color={PALETTE[(i + 1) % PALETTE.length]} size={34} dim={!f.trim()} />
                  <input
                    type="text"
                    aria-label={`Friend ${i + 1}`}
                    placeholder={["Siddharth", "Karan", "Aisha", "Preethi"][i] ?? "Name"}
                    value={f}
                    onChange={(e) => setFriends(friends.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  {friends.length > 1 && (
                    <button className="btn link sm" aria-label={`Remove friend ${i + 1}`} onClick={() => setFriends(friends.filter((_, j) => j !== i))}>Remove</button>
                  )}
                </div>
              ))}
              <button className="btn ghost sm" style={{ marginTop: 14 }} onClick={() => setFriends([...friends, ""])}>+ Add a person</button>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="step">3</span>
              <div><h2>Possible dates</h2><p>Two to four weekends is plenty. People mark each one yes, if needed, or no.</p></div>
            </div>
            <div className="card-body">
              {windows.map((w, i) => (
                <div className="date-row" key={i}>
                  <input type="text" aria-label="Label" value={w.label} placeholder="Diwali weekend"
                    onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <input type="date" aria-label="Start date" value={w.start}
                    onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                  <input type="date" aria-label="End date" value={w.end}
                    onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                  <button className="btn link sm" aria-label={`Remove date window ${i + 1}`} onClick={() => setWindows(windows.filter((_, j) => j !== i))}>Remove</button>
                </div>
              ))}
              <button className="btn ghost sm" style={{ marginTop: 14 }} onClick={() => setWindows([...windows, { label: "", start: "", end: "" }])}>+ Add dates</button>
            </div>
          </div>

          {error && <p className="error" role="alert">{error}</p>}
          <div style={{ margin: "22px 0 60px" }}>
            <button className="btn lg" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create trip"}</button>
          </div>
        </div>

        <aside className="card aside">
          <h3>What your friends will answer</h3>
          <ul>{ASKED.map((a) => <li key={a}><i />{a}</li>)}</ul>
          <p className="muted small" style={{ marginTop: 14 }}>
            Anything that's a hard no for one person is ruled out for everyone, so the options you get are ones the whole group can actually do.
          </p>
        </aside>
      </div>
    </>
  );
}
