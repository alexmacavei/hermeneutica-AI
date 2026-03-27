# 📡 API Reference – AI Hermeneutica Orthodoxa

All endpoints are prefixed with `/api` (e.g. `http://localhost:3001/api`).

Endpoints marked **🔒** require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

---

## Authentication

### `POST /api/auth/register`

Registers a new user. Returns a JWT.

**Request:**
```json
{ "email": "user@example.com", "password": "secret123" }
```

**Response:**
```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

---

### `POST /api/auth/login`

Authenticates an existing user. Returns a JWT.

**Request:**
```json
{ "email": "user@example.com", "password": "secret123" }
```

**Response:**
```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

---

## Hermeneutic Analysis

### `POST /api/analyze` 🔒

Analyses a Bible passage and returns four hermeneutic cards.

**Request:**
```json
{
  "text": "Fiindcă Dumnezeu aşa a iubit lumea, că pe Fiul Său Cel Unul-Născut L-a dat...",
  "range": "Ioan 3:16",
  "language": "Sinodală Română",
  "translationId": "ro_sinodala"
}
```

> **Note:** `translationId` is optional. If provided and starts with `eng_`
> (e.g. `eng_kja` for KJV), the verse-to-English translation step for patristic
> embeddings is skipped automatically.

**Response:**
```json
{
  "reference": "Ioan 3:16",
  "language": "Sinodală Română",
  "text": "Fiindcă Dumnezeu aşa a iubit lumea...",
  "cards": {
    "hermeneutics": "Interpretare în 4 sensuri...",
    "philosophy": "Neoplatonism: coborârea Logosului...",
    "patristics": "Ioan Gură de Aur: «Priveşte înălţimea darului...» (Omilii la Ioan, 27)",
    "philology": "ἠγάπησεν (ēgapēsen): aorist activ, Strong's G25..."
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

> **Note:** The `patristics` card is generated via RAG (Retrieval-Augmented Generation)
> from the locally-indexed New Advent corpus, not directly from the AI model.

---

## PDF Export

### `POST /api/pdf/export` 🔒

Generates a formatted A4 PDF of the hermeneutical analysis (including optional personal
notes) and returns it as a binary download. See [docs/pdf-export.md](pdf-export.md) for
full details on the PDF structure and local setup.

**Request body:**
```json
{
  "reference": "Facerea 1:1",
  "language": "ro",
  "text": "La început a făcut Dumnezeu cerul și pământul.",
  "cards": {
    "hermeneutics": "...",
    "philosophy": "...",
    "patristics": "...",
    "philology": "..."
  },
  "timestamp": "2026-03-26T12:00:00.000Z",
  "notes": [
    { "note_title": "Titlu", "note_text": "...", "created_at": "2026-03-20T10:00:00.000Z" }
  ]
}
```

**Response:** `application/pdf` binary. The `Content-Disposition` header contains a
suggested filename (e.g. `analiza-Facerea_1_1.pdf`).

---

## Personal Notes

### `GET /api/notes` 🔒

Returns notes for a specific verse:

```bash
GET /api/notes?verse_reference=Ioan+3:16
```

### `POST /api/notes` 🔒

Creates a new note:

```json
{
  "verse_reference": "Ioan 3:16",
  "note_title": "Optional title",
  "note_text": "My reflection on this verse..."
}
```

### `PUT /api/notes/:id` 🔒

Updates an existing note:

```json
{ "note_title": "Updated title", "note_text": "Updated text..." }
```

### `DELETE /api/notes/:id` 🔒

Deletes a note: `DELETE /api/notes/42`

---

## Theological Chat

### `POST /api/chat/message` 🔒

Sends a message to the AI theological assistant. At each request a top-5 vector
similarity search over the patristic corpus is performed and injected into the
AI system prompt.

**Request:**
```json
{
  "message": "Ce spun Sfinții Părinți despre Ioan 3:16?",
  "history": [
    { "role": "user",      "content": "Bună ziua!" },
    { "role": "assistant", "content": "Bună ziua! Cum vă pot ajuta?" }
  ]
}
```

> **Note:** `history` is optional (empty array for first message). `role` accepts only
> `"user"` or `"assistant"`. The conversation history is capped at the last 40 messages
> on the frontend.

**Response:**
```json
{ "reply": "Sfântul Ioan Gură de Aur comentează în Omilii la Ioan..." }
```

---

## Semantic Search

### `GET /api/search`

Semantic search over indexed Bible verses. Verses are indexed lazily via
`POST /api/search/ingest` as the user navigates.

**Query params:**
- `q` *(required)* – search term (e.g. `mântuire`, `pocăință`)
- `translationId` *(required)* – translation ID (e.g. `ro_sinodala`)
- `limit` *(optional)* – max results (default: 10)

```bash
GET /api/search?q=iubire&translationId=ro_sinodala&limit=10
```

**Response:**
```json
{
  "query": "iubire",
  "translationId": "ro_sinodala",
  "results": [
    {
      "translationId": "ro_sinodala",
      "bookId": "JHN",
      "bookName": "Ioan",
      "chapter": 3,
      "verseNumber": 16,
      "verseText": "Fiindcă Dumnezeu aşa a iubit lumea...",
      "similarity": 0.92,
      "reference": "Ioan 3:16"
    }
  ],
  "total": 1
}
```

---

## Bible

### `GET /api/bible/translations`

Lists all available Bible translations.

| ID | Name | Language |
|----|------|----------|
| `hbo_wlc` | Westminster Leningrad Codex | Hebrew |
| `grc_bre` | Greek Bible (Brenton LXX) | Greek |
| `grc_byz` | Byzantine Greek NT | Greek NT |
| `eng_kja` | King James Version with Apocrypha | English |
| `ro_sinodala` | Biblia Sinodală Română | Romanian |
| `ro_anania` | Biblia Anania | Romanian |

> **Note:** `ro_sinodala` is available only when `data/bibles/ro_sinodala.json` has been
> populated by `scripts/biblia-pipeline.ts`. `ro_anania` requires `data/bibles/ro_anania.json`
> generated by `scripts/anania-pipeline.ts`. See the
> [Biblical Data](../README.md#-date-biblice--biblical-data) section in the README.

### `GET /api/bible/:translationId/books`

Lists available books for a given translation.

```bash
GET /api/bible/ro_sinodala/books
GET /api/bible/eng_kja/books
```

### `GET /api/bible/:translationId/:bookId/:chapter`

Returns the verses of a Bible chapter.

```bash
GET /api/bible/ro_sinodala/MAT/5
GET /api/bible/eng_kja/JHN/3
GET /api/bible/grc_byz/JHN/3
```

### `GET /api/bible/parallel/:bookId/:chapter`

Returns the selected verse(s) from all available translations in parallel.
Used by the "Studiu Paralel" panel.

**Query params:**
- `verseStart` *(required)* – first verse number
- `verseEnd` *(optional)* – last verse number (default = `verseStart`)
- `exclude` *(optional)* – translation ID to omit from the response

```bash
GET /api/bible/parallel/JHN/3?verseStart=16&exclude=ro_sinodala
```

**Response:**
```json
[
  { "translationId": "hbo_wlc",  "translationName": "Westminster Leningrad Codex", "available": false, "verses": [] },
  { "translationId": "grc_bre",  "translationName": "Greek Bible (Brenton LXX)",   "available": false, "verses": [] },
  { "translationId": "grc_byz",  "translationName": "Byzantine Greek NT",           "available": true,  "verses": [{ "number": "16", "text": "Οὕτως γὰρ ἠγάπησεν..." }] },
  { "translationId": "eng_kja",  "translationName": "King James Version",           "available": true,  "verses": [{ "number": "16", "text": "For God so loved..."   }] }
]
```

> **Note:** Translations with a different canon (e.g. `hbo_wlc` – OT only,
> `grc_byz` – NT only) return `available: false` and `verses: []` for verses
> outside their canon.
