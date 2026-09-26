export type Avail = "yes" | "maybe" | "no";
export type Feel = "love" | "fine" | "no";

export type TypeId = "beach" | "mountains" | "heritage" | "nature" | "adventure" | "city";
export type Tag = "trek" | "cold" | "party" | "remote" | "crowds";
export type City =
  | "Bengaluru"
  | "Mumbai"
  | "Delhi"
  | "Chennai"
  | "Hyderabad"
  | "Pune"
  | "Kolkata";

export interface DateWindow {
  id: string;
  label: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

export interface TripMeta {
  id: string;
  name: string;
  coordinator: string;
  members: string[];
  windows: DateWindow[];
  createdAt: string;
  locked: boolean;
  decision?: { destId: string; windowId: string; at: string };
}

export interface Prefs {
  member: string;
  homeCity: City;
  budgetComfort: number;
  budgetMax: number;
  maxHours: number;
  avail: Record<string, Avail>;
  types: Record<TypeId, Feel>;
  wontDo: Tag[];
  note?: string;
  updatedAt: string;
}

export interface TripPayload {
  meta: TripMeta;
  responses: Record<string, Prefs>;
  storage: "redis" | "memory";
}
