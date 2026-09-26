import type { City, Tag, TypeId } from "./types";

export const CITIES: City[] = [
  "Bengaluru",
  "Mumbai",
  "Delhi",
  "Chennai",
  "Hyderabad",
  "Pune",
  "Kolkata",
];

export const TYPES: { id: TypeId; label: string }[] = [
  { id: "beach", label: "Beaches" },
  { id: "mountains", label: "Mountains" },
  { id: "heritage", label: "Heritage & culture" },
  { id: "nature", label: "Forests, lakes & wildlife" },
  { id: "adventure", label: "Adventure activities" },
  { id: "city", label: "Food, cafés & nightlife" },
];

export const TAGS: { id: Tag; label: string }[] = [
  { id: "trek", label: "Long treks or strenuous hikes" },
  { id: "cold", label: "Very cold weather" },
  { id: "party", label: "A party-heavy scene" },
  { id: "remote", label: "Remote places with patchy network" },
  { id: "crowds", label: "Packed, very touristy spots" },
];

export interface Destination {
  id: string;
  name: string;
  region: string;
  types: TypeId[];
  tags: Tag[]; // always true of the place
  coldMonths?: number[]; // "cold" applies only in these months
  perNight: number; // rough on-ground spend per person per night, INR (stay + food + local travel + activities)
  best: number[]; // months (1-12) that are good to visit
  closed?: number[]; // months when the trip is impractical
  hours: Record<City, number>; // rough fastest door-to-door hours, one way
}

// Estimates are deliberately rough; they are meant to separate "easy" from "hard", not to quote prices.
export const DESTINATIONS: Destination[] = [
  {
    id: "goa", name: "North Goa", region: "Goa", types: ["beach", "city"], tags: ["party", "crowds"],
    perNight: 3500, best: [10, 11, 12, 1, 2, 3],
    hours: { Bengaluru: 4, Mumbai: 4, Delhi: 5, Chennai: 4.5, Hyderabad: 4, Pune: 4, Kolkata: 5.5 },
  },
  {
    id: "gokarna", name: "Gokarna", region: "Karnataka", types: ["beach", "nature"], tags: [],
    perNight: 2500, best: [10, 11, 12, 1, 2, 3],
    hours: { Bengaluru: 7, Mumbai: 7.5, Delhi: 7, Chennai: 8, Hyderabad: 7, Pune: 7.5, Kolkata: 8 },
  },
  {
    id: "pondy", name: "Puducherry", region: "Puducherry", types: ["beach", "heritage", "city"], tags: [],
    perNight: 3000, best: [10, 11, 12, 1, 2, 3],
    hours: { Bengaluru: 6, Mumbai: 5.5, Delhi: 6, Chennai: 3.5, Hyderabad: 5.5, Pune: 6, Kolkata: 6 },
  },
  {
    id: "varkala", name: "Varkala", region: "Kerala", types: ["beach", "city"], tags: [],
    perNight: 3000, best: [10, 11, 12, 1, 2, 3],
    hours: { Bengaluru: 6, Mumbai: 6, Delhi: 7.5, Chennai: 6, Hyderabad: 6, Pune: 6.5, Kolkata: 7.5 },
  },
  {
    id: "andaman", name: "Havelock Island", region: "Andaman", types: ["beach", "adventure"], tags: ["remote"],
    perNight: 5500, best: [11, 12, 1, 2, 3, 4], closed: [6, 7, 8],
    hours: { Bengaluru: 7.5, Mumbai: 8, Delhi: 8.5, Chennai: 6, Hyderabad: 7.5, Pune: 8.5, Kolkata: 6 },
  },
  {
    id: "coorg", name: "Coorg", region: "Karnataka", types: ["mountains", "nature"], tags: [],
    perNight: 3500, best: [9, 10, 11, 12, 1, 2, 3, 4, 5],
    hours: { Bengaluru: 5.5, Mumbai: 6.5, Delhi: 7, Chennai: 7, Hyderabad: 6.5, Pune: 7, Kolkata: 7.5 },
  },
  {
    id: "munnar", name: "Munnar", region: "Kerala", types: ["mountains", "nature"], tags: [],
    perNight: 3000, best: [9, 10, 11, 12, 1, 2, 3, 4, 5],
    hours: { Bengaluru: 7, Mumbai: 7, Delhi: 8, Chennai: 7, Hyderabad: 7, Pune: 7.5, Kolkata: 8 },
  },
  {
    id: "wayanad", name: "Wayanad", region: "Kerala", types: ["nature", "adventure"], tags: ["trek"],
    perNight: 3000, best: [10, 11, 12, 1, 2, 3, 4, 5],
    hours: { Bengaluru: 6, Mumbai: 7, Delhi: 8, Chennai: 7.5, Hyderabad: 7, Pune: 7.5, Kolkata: 8.5 },
  },
  {
    id: "hampi", name: "Hampi", region: "Karnataka", types: ["heritage", "adventure"], tags: [],
    perNight: 2000, best: [10, 11, 12, 1, 2],
    hours: { Bengaluru: 7, Mumbai: 8.5, Delhi: 8, Chennai: 8.5, Hyderabad: 6.5, Pune: 8.5, Kolkata: 9 },
  },
  {
    id: "udaipur", name: "Udaipur", region: "Rajasthan", types: ["heritage", "city"], tags: ["crowds"],
    perNight: 4500, best: [9, 10, 11, 12, 1, 2, 3],
    hours: { Bengaluru: 5, Mumbai: 3.5, Delhi: 4, Chennai: 5.5, Hyderabad: 5, Pune: 4, Kolkata: 5.5 },
  },
  {
    id: "jaipur", name: "Jaipur", region: "Rajasthan", types: ["heritage", "city"], tags: ["crowds"],
    perNight: 3500, best: [10, 11, 12, 1, 2, 3],
    hours: { Bengaluru: 4.5, Mumbai: 4, Delhi: 5, Chennai: 5, Hyderabad: 4.5, Pune: 4.5, Kolkata: 5 },
  },
  {
    id: "rishikesh", name: "Rishikesh", region: "Uttarakhand", types: ["adventure", "mountains"], tags: [],
    perNight: 2500, best: [9, 10, 11, 2, 3, 4, 5],
    hours: { Bengaluru: 6.5, Mumbai: 6.5, Delhi: 6, Chennai: 7, Hyderabad: 6.5, Pune: 7, Kolkata: 7 },
  },
  {
    id: "manali", name: "Manali", region: "Himachal", types: ["mountains", "adventure", "city"], tags: ["crowds"],
    coldMonths: [11, 12, 1, 2, 3], perNight: 3000, best: [3, 4, 5, 6, 9, 10, 11],
    hours: { Bengaluru: 10, Mumbai: 10, Delhi: 11, Chennai: 10.5, Hyderabad: 10, Pune: 10.5, Kolkata: 10.5 },
  },
  {
    id: "kasol", name: "Kasol & Parvati Valley", region: "Himachal", types: ["mountains", "nature"], tags: ["trek", "remote"],
    coldMonths: [11, 12, 1, 2], perNight: 2000, best: [3, 4, 5, 6, 9, 10],
    hours: { Bengaluru: 11, Mumbai: 11, Delhi: 11.5, Chennai: 11.5, Hyderabad: 11, Pune: 11.5, Kolkata: 11.5 },
  },
  {
    id: "leh", name: "Leh", region: "Ladakh", types: ["mountains", "adventure"], tags: ["cold", "remote"],
    perNight: 4500, best: [5, 6, 7, 8, 9], closed: [12, 1, 2],
    hours: { Bengaluru: 6.5, Mumbai: 5.5, Delhi: 3.5, Chennai: 6.5, Hyderabad: 6, Pune: 6, Kolkata: 6 },
  },
  {
    id: "meghalaya", name: "Shillong & Cherrapunji", region: "Meghalaya", types: ["nature", "mountains"], tags: ["trek", "remote"],
    perNight: 3000, best: [10, 11, 12, 1, 2, 3, 4, 5],
    hours: { Bengaluru: 8, Mumbai: 8.5, Delhi: 7, Chennai: 8, Hyderabad: 8, Pune: 8.5, Kolkata: 4.5 },
  },
  {
    id: "darjeeling", name: "Darjeeling", region: "West Bengal", types: ["mountains", "heritage"], tags: [],
    coldMonths: [12, 1, 2], perNight: 3000, best: [3, 4, 5, 9, 10, 11],
    hours: { Bengaluru: 8, Mumbai: 8, Delhi: 7, Chennai: 8, Hyderabad: 8, Pune: 8.5, Kolkata: 5 },
  },
];

export function destById(id: string) {
  return DESTINATIONS.find((d) => d.id === id);
}
