# NEW INDIE LIVE 24 — AGENT OPERATING GUIDELINES & LEARNINGS

This document establishes the permanent operational guidelines, discovery heuristics, and curation integrity rules for **`new-indie-live-twentyfour`**.

---

## 1. Core Mission & EveryNoise "Clean Track" Integrity
The bot tracks the open web 24/7 for true Indie Rock & Alternative music releases strictly dropped within the last 24–36 hours.

### The Clean Track Mandate
Every release candidate must conform to the pure **`(Artist Name) — (Song Name)`** structure:
- **No Features / Collaborations**: Discard `feat.`, `ft.`, `featuring`, and `with [Artist]` tracks (preserves original compositions).
- **No Mixes / Covers / Live Cuts**: Discard `remix`, `re-mix`, `rmx`, `vip mix`, `club mix`, `cover version`, `live @`, `live at`, `session`, `reissue`, `deluxe`, and `remaster`.
- **No Video / Blog Clutter**: Strip and reject `[Official Music Video]`, `(Lyric Video)`, `(Short Film)`, `| Album Review`, `| Post-Trash Premiere`, `[4K]`, etc.
- **Language / Script Mandate**: English / Latin-1 Western alphabet only (`^[\x20-\x7E\u00C0-\u017F]+$`). Automatically reject non-Western scripts (Vietnamese, Cyrillic, Asian scripts, Arabic, emojis).
- **No All-Lowercase Bedroom Aesthetic**: Reject amateur entries where both artist and title are all-lowercase (e.g. `caspers pishogue — now youre mine`, `mori — god complex`).
- **No Bad Grammar / Internet Slang / Run-on Words**: Reject textisms (`ur`, `pls`, `thx`, `idk`, `ngl`, `saddisfaction`), missing contraction apostrophes (`youre`, `dont`, `cant`), and unspaced run-on words (`onmyfrontdresser`).
- **No Pseudo-Stylized / L33tspeak Spelling**: Reject character/vowel swaps (e.g. `Cold MØde`, `lyc4n`, `13kjohny`, `k0vertessence`).
- **Length & Complexity Cap**: Max 7 words per title, max 55 characters. Reject titles repeating the artist name or jamming convoluted phrases together.
- **No Self-Titled Duplicates**: Drop self-titled album entries (e.g. `Artist - Artist`).

---

## 2. Multi-Channel Discovery Heuristics

1. **YouTube Video Premieres (`src/channels/youtubeChannel.js`)**:
   - Scans uploads filtered to the last 24 hours (`sp=EgIIAg%3D%3D`).
   - Rejects future scheduled/unreleased streams (`v.upcomingEventData`).
   - Rejects AI / Synthetic disclosures (`Altered or synthetic content`, `Suno`, `Udio`, `AI Music`, `AI Art`).
   - Inspects video description snippets and badges for live performance tags (`live recording`, `live at`, `glastonbury`, `concert`, `live in`).
   - Rejects reaction videos (`reaction`, `reactions`, `reacting to`), vlogs, tutorials/lessons, and episodic numbering (`#01`, `ep. 2`, `Twenty-Four From`).
2. **SoundCloud Daily Streams (`src/channels/soundcloudChannel.js`)**:
   - Queries `filter.created_at=last_day` for indie rock, post-punk, and alternative.
   - Strictly drops non-indie tags (`Hip-hop & Rap`, `Rap`, `Electronic`, `EDM`, `Techno`, `House`, `Trap`, `R&B`, `Dream Pop`, `Ambient`, `DJ Set`, `Radio Show`).
3. **Strict Banned Sub-Genres & Themes (`configs/exclusions.json`)**:
   - Rejects: `Doom Metal`, `Gothic Rock / Goth Metal`, `K-Pop`, `C-Pop`, `J-Pop`, `Vaporwave`, `Space Rock`, `Synthwave`, `Coldwave`, `Indie Folk / Folk Pop / Singer-Songwriter`.
   - Rejects pseudo-stylized AI naming (e.g. `MØde`, `Vampshow`).
4. **US Indie Tastemaker Fleet (`src/channels/usIndieChannel.js`)**:
   - Curated US pipeline monitoring 8 premier hubs: *BrooklynVegan, Stereogum, The Big Takeover, Gorilla vs Bear, Aquarium Drunkard, Austin Town Hall, Glide Magazine, Post-Trash*.
   - Rejects non-release sections (/shows/, /interviews/, /podcasts/, /events/, /tour/).
   - Rejects radio broadcast episodes (e.g. `The Big Takeover Show — Number XXX`).
   - Features dynamic 72h weekend fallback on Mondays to capture Friday/weekend US premieres.
   - Dispatches dedicated US briefing with blue `[US RADAR]` badging.
5. **MusicBrainz Catalog Registrations (`src/channels/musicbrainzChannel.js`)**:
   - Queries Lucene index for fresh single/EP release groups from `[yesterday TO today]`.
6. **Indie Review RSS Feeds (`src/channels/blogsChannel.js`)**:
   - Scrapes real-time premieres from global indie blogs.
7. **Bandcamp Live Discover (`src/channels/bandcampChannel.js`)**:
   - Scans live discover endpoints across primary indie music hubs.
8. **Deezer Open Drops (`src/channels/deezerChannel.js`)**:
   - Checks editorial alternative catalog additions.

---

## 3. Database Memory & Flood Prevention

- **Master SQLite Catalog (`data/master_catalog.sqlite`)**:
  - Unified memory shared across Global and US radars. Persists `artist::title` pairs and sighting counts.
- **Recycled Pre-Release Single Shield**:
  - If a track was first cataloged $>7$ days ago and reappears during a full album drop, it is blocked as a recycled pre-release single.
- **Artist Flood Protection**:
  - Caps discoveries to at most **2 tracks per artist per daily run** to prevent bulk-single uploaders from flooding the briefing.
- **Zero-Yield Inbox Silence**:
  - If zero clean tracks pass all criteria on a given day, no email is sent.

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

