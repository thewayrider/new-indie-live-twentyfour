# NEW INDIE LIVE 24 — AGENT OPERATING GUIDELINES & LEARNINGS

This document establishes the permanent operational guidelines, discovery heuristics, and curation integrity rules for **`new-indie-live-twentyfour`**.

---

## 1. Core Mission & EveryNoise "Clean Track" Integrity
The bot tracks the open web 24/7 for true Indie Rock & Alternative music releases strictly dropped within the last 24–36 hours.

### The EveryNoise / AllMusic "Pure Track" Mandate
Every release candidate must conform strictly to the **`(Artist Name) — (Song Name)`** gold standard:
- **Clean Capitalization**: Title must start with a Capital letter and follow standard Title/Sentence casing. Automatically rejects all-lowercase bedroom titles (e.g. `black cockatoo`, `now youre mine`) and all-caps screaming titles.
- **Concise Word & Length Limits**: Title must be 1 to 6 words (max 45 characters). Artist must be 1 to 5 words (max 40 characters).
- **Clean Character Whitelist**: Strictly `A-Za-z0-9` and clean punctuation (`'`, `-`, `.`, `,`, `!`, `?`, `&`). Automatically rejects symbols (`_`, `/`, `\`, `|`, `@`, `#`, `~`, `+`, `$`, `%`, `^`, `*`, `{}`, `[]`).
- **No Unresolved Parentheticals**: Rejects titles carrying unstripped `(...)` or `[...]` annotations.
- **Language & Script Mandate**: English only. Rejects non-Western scripts (Vietnamese, Cyrillic, Asian, Arabic) and foreign-specific letters (Turkish ğ/ı/ş, Portuguese ã/õ).
- **Foreign Language Stopword Filter**: Rejects French, Spanish, Portuguese, Turkish, and Brazilian funk phrasing (`quand tu passes`, `vizinha gostosa`, `3 dias virado`, `dikenli tel`, `MC [Name]`, `speed + grave`).
- **No Internet Slang / Bad Grammar**: Rejects textisms (`ur`, `pls`, `thx`, `idk`, `ngl`, `saddisfaction`), missing contraction apostrophes (`youre`, `dont`, `cant`), and unspaced run-on words (`onmyfrontdresser`).
- **No Pseudo-Stylized / L33tspeak Spelling**: Rejects character/vowel swaps (e.g. `Cold MØde`, `lyc4n`, `13kjohny`, `k0vertessence`).
- **No Redundancy / Features**: Discard `feat.`, `ft.`, `with [Artist]`, `by [Artist]`, `remixes`, `covers`, `live @`, and titles repeating the artist name.
- **No Self-Titled Duplicates**: Drop self-titled album entries (e.g. `Artist - Artist`).

---

## 2. Multi-Channel Discovery & Quota Balancing

1. **SoundCloud Daily Stream (`src/channels/soundcloudChannel.js`)**:
   - Queries `filter.created_at=last_day` for indie rock and post-punk.
   - **SoundCloud Quota Cap (`maxSoundCloudTracks: 5`)**: Automatically capped at 5 tracks max per daily run to prevent high-velocity direct-upload flooding.
2. **YouTube Video Premieres (`src/channels/youtubeChannel.js`)**:
   - Scans uploads filtered to the last 24 hours (`sp=EgIIAg%3D%3D`).
   - Rejects future scheduled streams (`v.upcomingEventData`) and AI/synthetic disclosures (`Altered or synthetic content`, `Suno`, `Udio`, `AI Music`).
   - Inspects video descriptions and badges for live concert tags (`live recording`, `festival`, `concert`).
3. **US Indie Tastemaker Fleet (`src/channels/usIndieChannel.js`)**:
   - Curated US pipeline monitoring 8 premier hubs: *BrooklynVegan, Stereogum, The Big Takeover, Gorilla vs Bear, Aquarium Drunkard, Austin Town Hall, Glide Magazine, Post-Trash*.
   - Rejects non-release sections (/shows/, /interviews/, /podcasts/, /events/, /tour/) and radio broadcast episodes (`Takeover Show — Number XXX`).
   - Features dynamic 72h weekend fallback on Mondays.
   - Dispatches dedicated US briefing with blue `[US RADAR]` badging.
4. **MusicBrainz & Bandcamp & Deezer & Indie Blogs**:
   - Standard 24–36h recency window for catalog registrations and blog debuts.

---

## 3. Database Memory & Quotas

- **Master SQLite Catalog (`data/master_catalog.sqlite`)**: Unified cross-market memory.
- **Recycled Single Shield**: Blocks tracks first seen $>7$ days ago reappearing in album drops.
- **Artist Cap**: Max **2 tracks per artist per daily run**.
- **Channel Caps**: Max **5 tracks for SoundCloud**, max **8 tracks for other channels**.
- **Zero-Yield Inbox Silence**: If zero clean tracks qualify on a given day, no email is sent.

---

## 4. Production Deployment & Scheduling (Mini PC)

- **Mini PC Directory**: `C:\Antigravity Projects\new-indie-live-twentyfour`
- **Dual Daily Automated Schedule (Windows Task Scheduler)**:
  - **`NewIndieLive24_Global`**: Executes `run_daily_radar.bat` daily at **06:30 AM**.
  - **`NewIndieLive24_US`**: Executes `run_us_radar.bat` daily at **07:00 AM**.

---

## 5. Future Roadmap: Fleet Command Center & Android Mobile App
- **Unified Control Dashboard**: Central web UI and REST API bridging `live-music-search-agent` (weekly) and `new-indie-live-twentyfour` (daily).
- **1-Click On-Demand Execution**: Trigger single crawlers or entire radars on demand without opening the IDE.
- **Android App Integration**: Connect triggers and status directly into `live-music-crawler-monitor-android`.

