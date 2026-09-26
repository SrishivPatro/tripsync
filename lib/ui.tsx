import type { CSSProperties } from "react";

// One colour per friend, used on every screen so people recognise themselves at a glance.
export const PALETTE = ["#F2A007", "#2BB3A3", "#E4572E", "#7B6CF6", "#3D9BE9", "#D6457A", "#6BAA3B", "#B7793A", "#14A0C4", "#9B59B6", "#E07B39", "#4C6EF5"];

export function colorFor(members: string[], name: string) {
  const i = Math.max(0, members.indexOf(name));
  return PALETTE[i % PALETTE.length];
}

export function Avatar({
  name, color, size = 36, ring, dim, title,
}: { name: string; color: string; size?: number; ring?: string; dim?: boolean; title?: string }) {
  const style: CSSProperties = {
    width: size, height: size, fontSize: Math.round(size * 0.42), background: color,
    boxShadow: ring ? `0 0 0 3px var(--surface), 0 0 0 5px ${ring}` : undefined,
    opacity: dim ? 0.45 : 1,
  };
  return (
    <span className="avatar" style={style} title={title ?? name} aria-label={title ?? name}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

// Five routes from five cities converging on one pin: the whole product in one picture.
export function RouteArt({ colors }: { colors?: string[] }) {
  const cs = colors ?? PALETTE.slice(0, 5);
  const ys = [28, 72, 116, 160, 204];
  const labels = ["Bengaluru", "Mumbai", "Delhi", "Chennai", "Hyderabad"];
  return (
    <svg className="route-art" viewBox="0 0 420 232" role="img" aria-label="Five routes from five cities meeting at one destination">
      {ys.map((y, i) => (
        <g key={i}>
          <path className="route" d={`M 26 ${y} C 170 ${y}, 220 116, 336 116`} stroke={cs[i % cs.length]} style={{ animationDelay: `${i * 90}ms` }} />
          <circle cx="26" cy={y} r="9" fill={cs[i % cs.length]} stroke="#0E3B43" strokeWidth="3" />
          <text x="44" y={y - 12} className="route-label">{labels[i]}</text>
        </g>
      ))}
      <g className="pin" transform="translate(356 116)">
        <path d="M0 -34 C 19 -34 30 -21 30 -6 C 30 13 0 34 0 34 C 0 34 -30 13 -30 -6 C -30 -21 -19 -34 0 -34 Z" fill="#F2A007" />
        <circle cx="0" cy="-6" r="10" fill="#0E3B43" />
      </g>
    </svg>
  );
}

export function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="4" cy="5" r="3" fill="#2BB3A3" />
      <circle cx="4" cy="13" r="3" fill="#E4572E" />
      <circle cx="4" cy="21" r="3" fill="#7B6CF6" />
      <path d="M7 5 C14 5 14 13 20 13 M7 21 C14 21 14 13 20 13 M7 13 H20" stroke="#E7F1F2" strokeWidth="1.8" fill="none" />
      <circle cx="21.5" cy="13" r="4" fill="#F2A007" />
    </svg>
  );
}
