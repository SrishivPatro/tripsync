# Trip Decider

Everyone submits preferences through one link. The app returns the three trip options that work best for the
whole group, and shows where each person stands on each option.

## How it works
- **Coordinator** creates a trip at `/` with names and 2–4 candidate date windows. She gets a group link and a private coordinator link.
- **Each friend** opens `/t/<id>`, picks their name, and answers: home city, availability per window (yes / if needed / no),
  comfortable and max budget, max one-way travel hours, feelings about 6 trip types, and dealbreakers.
- **Results** at `/t/<id>/results` score every destination × date window against every person.
  - Any hard no (date = no, over max budget, far over travel limit, a dealbreaker) rules the option out.
  - Group fit = 50% average + 50% least-happy person, so an option must work for everyone to rank.
  - Shows the top 3 options, a person × option grid with reasons, "almost worked" options, and where the group overlaps.
- **Coordinator controls**: see who hasn't answered and nudge them on WhatsApp, lock responses (no more mind-changing), choose the final trip.

## Deploy to Vercel
1. Push this folder to a new GitHub repo.
2. In Vercel: **Add New → Project**, import the repo, and deploy (Next.js defaults are fine).
3. In the project: **Storage → Create Database → Upstash for Redis**, and connect it to this project.
   This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
4. **Deployments → ⋯ → Redeploy** so the new env vars are picked up.

Without the database the app runs in test mode (in-memory). That's fine locally, but data gets lost on Vercel.

## Run locally
```
npm install
npm run dev
```

## Files
- `lib/destinations.ts`: catalog of 17 Indian destinations (rough costs, travel hours from 7 cities, seasons)
- `lib/scoring.ts`: per-person fit, group score, ranking, overlap
- `lib/store.ts`: Upstash Redis storage (one hash field per person, so simultaneous saves can't clash)
- `app/api/trips/...`: create trip, read trip, save preferences, coordinator actions
- `app/page.tsx`, `app/t/[id]/page.tsx`, `app/t/[id]/results/page.tsx`: the three screens
