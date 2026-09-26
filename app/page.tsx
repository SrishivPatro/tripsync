"use client";

import { useState } from "react";

type WinDraft = { label: string; start: string; end: string };

const DEFAULT_WINDOWS: WinDraft[] = [
  { label: "Last weekend of October", start: "2026-10-30", end: "2026-11-01" },
  { label: "Mid-November weekend", start: "2026-11-20", end: "2026-11-22" },
  { label: "Christmas weekend", start: "2026-12-25", end: "2026-12-27" },
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
    return (
      <div className="narrow">
        <section className="hero">
          <h1>{name} is ready</h1>
          <p className="lede">Send the group link once. Keep the coordinator link to yourself.</p>
        </section>

        <div className="panel">
          <h3>Link for the group</h3>
          <p className="muted small">Everyone picks their name and adds their preferences.</p>
          <div className="linkbox">
            <input type="text" readOnly value={share} aria-label="Group link" />
            <button className="btn ghost" onClick={() => copy(share, "share")}>{copied === "share" ? "Copied" : "Copy"}</button>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <a className="btn" href={wa} target="_blank" rel="noreferrer">Share on WhatsApp</a>
            <a className="btn ghost" href={share}>Add my own preferences</a>
          </div>
        </div>

        <div className="panel">
          <h3>Your coordinator link</h3>
          <p className="muted small">
            Opens the results with controls to lock responses and choose the final trip. Bookmark it; it can't be recovered.
          </p>
          <div className="linkbox">
            <input type="text" readOnly value={admin} aria-label="Coordinator link" />
            <button className="btn ghost" onClick={() => copy(admin, "admin")}>{copied === "admin" ? "Copied" : "Copy"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="narrow">
      <section className="hero">
        <h1>One link. Three options. One decision.</h1>
        <p className="lede">
          Everyone adds their dates, budget and dealbreakers once. You get the trips that work for the whole group, and
          exactly where each person stands on each one.
        </p>
        <div className="steps">
          <div><h3>Set it up</h3><p>Names and a few possible weekends.</p></div>
          <div><h3>Everyone answers</h3><p>Two minutes each, from one link.</p></div>
          <div><h3>Decide</h3><p>Lock answers, compare three options, pick one.</p></div>
        </div>
      </section>

      <div className="panel">
        <h2>Start a trip</h2>

        <div className="field">
          <label htmlFor="tname">Trip name</label>
          <input id="tname" type="text" placeholder="College gang trip 2026" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="cname">Your name</label>
          <input id="cname" type="text" placeholder="Riya" value={coordinator} onChange={(e) => setCoordinator(e.target.value)} />
        </div>

        <div className="field">
          <span className="label">Who else is coming?</span>
          <p className="hint">Use the names people go by in the group chat.</p>
          {friends.map((f, i) => (
            <div className="row" key={i} style={{ marginTop: 8, flexWrap: "nowrap" }}>
              <input
                type="text"
                aria-label={`Friend ${i + 1}`}
                placeholder={["Siddharth", "Karan", "Aisha", "Preethi"][i] ?? "Name"}
                value={f}
                onChange={(e) => setFriends(friends.map((x, j) => (j === i ? e.target.value : x)))}
              />
              {friends.length > 1 && (
                <button className="btn quiet sm" aria-label={`Remove friend ${i + 1}`} onClick={() => setFriends(friends.filter((_, j) => j !== i))}>
                  Remove
                </button>
              )}
            </div>
          ))}
          <button className="btn quiet sm" style={{ marginTop: 6 }} onClick={() => setFriends([...friends, ""])}>+ Add a person</button>
        </div>

        <div className="field">
          <span className="label">Possible dates</span>
          <p className="hint">Two to four weekends is plenty. People will mark each one yes, if needed, or no.</p>
          {windows.map((w, i) => (
            <div className="grid-3" key={i} style={{ marginTop: 10 }}>
              <div>
                <input type="text" aria-label="Label" value={w.label} placeholder="Diwali weekend"
                  onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              </div>
              <div>
                <input type="date" aria-label="Start date" value={w.start}
                  onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
              </div>
              <div>
                <input type="date" aria-label="End date" value={w.end}
                  onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
              </div>
              <button className="btn quiet sm" aria-label={`Remove date window ${i + 1}`} onClick={() => setWindows(windows.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
          <button className="btn quiet sm" style={{ marginTop: 6 }} onClick={() => setWindows([...windows, { label: "", start: "", end: "" }])}>
            + Add dates
          </button>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        <div style={{ marginTop: 24 }}>
          <button className="btn" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create trip"}</button>
        </div>
      </div>
    </div>
  );
}
