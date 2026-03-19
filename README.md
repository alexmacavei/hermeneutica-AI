# ✝ AI Hermeneutica Orthodoxa

<div align="center">

[![NestJS](https://img.shields.io/badge/NestJS-10+-E0234E?style=for-the-badge&logo=nestjs)](https://nestjs.com)
[![Angular](https://img.shields.io/badge/Angular-19.2-DD0031?style=for-the-badge&logo=angular)](https://angular.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![PrimeNG](https://img.shields.io/badge/PrimeNG-19-4CAF50?style=for-the-badge)](https://primeng.org)
[![Podman](https://img.shields.io/badge/Podman-compose-892CA0?style=for-the-badge&logo=podman)](https://podman.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?style=for-the-badge&logo=postgresql)](https://github.com/pgvector/pgvector)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![CI](https://github.com/alexmacavei/hermeneutica-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/alexmacavei/hermeneutica-AI/actions)

**Instrument AI pentru analiză hermeneutică ortodoxă bazată pe Biblia Sinodală**

*AI Tool for Orthodox Hermeneutic Analysis based on the Synodal Bible*

[🚀 Demo Live](#demo) · [📖 Documentație](#instalare) · [🤝 Contribuie](#contributing)

</div>

---

## 📖 Descriere / Description

**RO:** AI Hermeneutica Orthodoxa este o aplicație web full-stack care permite navigarea textului biblic (via helloao.org API) și oferă analiză hermeneutică ortodoxă prin modele OpenAI, precum și studiu biblic paralel între toate traducerile disponibile.

Analiza unui verset generează 4 carduri:

| Card | Conținut | Sursă |
|------|----------|-------|
| 📖 **Principii Hermeneutice** | Interpretare în 4 sensuri: literal, tropologic, alegoric, anagogic | OpenAI (LLM) |
| 🧠 **Influențe Filozofice** | Platonism creștin, Neoplatonism, Stoicism patristic | OpenAI (LLM) |
| ⛪ **Comentarii Patristice** | Citații din Părinții Bisericii (ex. Sf. Ioan Gură de Aur, Vasile cel Mare etc.) extrase din corpus **New Advent** prin căutare semantică RAG | New Advent + OpenAI Embeddings |
| 🔤 **Analiză Filologică** | Greacă/Ebraică biblică, Strong's, LXX, morfologie | OpenAI (LLM) |
| 📚 **Studiu Paralel** | Versetul selectat afișat simultan în toate traducerile disponibile (N/A pentru traduceri cu canon diferit) | bible.helloao.org |

**EN:** AI Hermeneutica Orthodoxa is a full-stack web application for navigating Biblical text (via helloao.org API), receiving AI-powered orthodox hermeneutic analysis using OpenAI models, and comparing selected verses side-by-side across all available translations.

---

## 🎥 Demo

> **Exemplu: Ioan 3:16 → 4 Carduri AI**

```
Utilizator selectează: "Fiindcă Dumnezeu aşa a iubit lumea, că pe Fiul Său Cel Unul-Născut L-a dat..."

📖 Principii Hermeneutice:
  Literal: actul iubirii divine manifestat prin Întrupare și Jertfă
  Tropologic: chemarea omului la iubire jertfelnică față de aproapele
  Alegoric: tipologia lui Isaac, fiul sacrificat – prefigurare a lui Hristos
  Anagogic: scopul ultim – îndumnezeirea (theosis), viața veșnică în comuniune cu Dumnezeu

🧠 Influențe Filozofice:
  Neoplatonism: coborârea (κατάβασις) Logosului în materie ca act al Binelui absolut
  Dionisie Areopagitul: iubirea divină (ἔρως) ca forță unificatoare ce leagă creatul de Necreat
  Stoicism patristic: Logosul cosmic identificat cu Hristos – providența activă în creație

⛪ Comentarii Patristice (New Advent RAG):
  Ioan Gură de Aur: „Priveşte înălţimea darului: Cel Unul-Născut, Cel negrăit, Cel fără de
  margini, Cel egal cu Tatăl – a fost dat pentru noi." (Omilii la Ioan, 27)
  Chiril al Alexandriei: „Prin aceasta arată că nu din necesitate, ci din iubire curată
  S-a întrupat Fiul." (Comentariu la Ioan, III)
  Teofilact al Bulgariei: „«A dat» înseamnă că S-a predat cu totul morții, nu doar că
  S-a arătat sau că a trecut pe aici." (Tâlcuire la Ioan, 3)

🔤 Analiză Filologică:
  ἠγάπησεν (ēgapēsen): aorist activ – act unic, definitiv; ἀγάπη ≠ ἔρως (iubire
  necondiționată, nu sentimentală)
  μονογενῆ (monogenē): Strong's G3439 – unicul născut din fire, nu prin adopție
  LXX Ps 21:21: „singura mea sufleteasca" – rezonanță terminologică
```

---

## 🏗️ Arhitectură / Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (Angular 19)                         │
│  BibleSelector ──► BibleText ──► VerseHighlighter                  │
│        │                  │                                         │
│        │         ParallelViewer (Studiu Paralel)                    │
│        │                  │                                         │
│        └──────────────────┴──────► ResultsViewer (4 Carduri)       │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTP (REST)
┌────────────────────────▼────────────────────────────────────────────┐
│                     NestJS 10 Backend (API :3001)                   │
│                                                                     │
│   POST /api/analyze                                                 │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │  AnalyzeService                                         │      │
│   │   ├─ AiService.generateThreeCards()   → OpenAI LLM     │      │
│   │   │   └─ Prompts: hermeneutica.yaml                     │      │
│   │   └─ PatristicRagService.buildPatristicSummary()        │      │
│   │       ├─ AiService.translateToEnglish()  (gpt-4o-mini)  │      │
│   │       ├─ AiService.generateEmbedding()  (embedding-3-s) │      │
│   │       ├─ DatabaseService  ──► pgvector cosine search    │      │
│   │       └─ AiService.chat()               (LLM summary)  │      │
│   └─────────────────────────────────────────────────────────┘      │
│                                                                     │
│   GET /api/bible/*  ──► BibleService                               │
│   ├─ bible.helloao.org  (hbo_wlc, grc_bre, grc_byz, eng_kja)      │
│   └─ data/bibles/ro_sinodala.json  (Biblia Sinodală Română)        │
└────────────────────────┬────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│              PostgreSQL 16 + pgvector                               │
│   patristic_chunks  (text, embedding, author, work, chapter)       │
│   verse_embeddings  (semantic search pentru versete)               │
└─────────────────────────────────────────────────────────────────────┘

         ┌──────────────────────────────────────────┐
         │  Indexare offline (npm run index:patristic)│
         │  PatristicLoaderService  ──► HTML parse   │
         │  PatristicEmbeddingService ──► OpenAI     │
         │  PATRISTIC_DATA_DIR (New Advent .htm)     │
         └──────────────────────────────────────────┘
```

---

## 🚀 Instalare / Installation

### Cerințe / Requirements

- Node.js 20+
- Podman & Podman Compose
- Cheie API OpenAI (pentru analiza AI)
- **Biblia Sinodală Română** – generată local din scriptul `scripts/biblia-pipeline.ts` (vezi [Date Biblice](#-date-biblice--biblical-data))
- **Corpus patristic New Advent** *(opțional, pentru cardul Comentarii Patristice)* – vezi [docs/patristic-setup.md](docs/patristic-setup.md)

### Quick Start cu Podman

```bash
# 1. Clonează repository-ul
git clone https://github.com/alexmacavei/hermeneutica-AI.git
cd hermeneutica-AI

# 2. Configurează variabilele de mediu
cp .env.example .env
# Editează .env și adaugă OPENAI_API_KEY=sk-...

# 3. (Opțional) Populează Biblia Sinodală locală
cd scripts && npm install && npm run biblia-pipeline
cd ..

# 4. Pornește toate serviciile
podman compose up --build --force-recreate --remove-orphans

# 5. Oprește toate serviciile
podman compose down

# Frontend: http://localhost:4200
# API:      http://localhost:3001/api
# DB:       localhost:5432 (PostgreSQL cu pgvector)
```

### Variabile de Mediu / Environment Variables

```env
# .env (copiat din .env.example)

# OpenAI – obligatoriu
OPENAI_API_KEY=sk-your-openai-key
# Modelul principal folosit pentru cardurile hermeneutice (default: gpt-4o)
OPENAI_MODEL=gpt-4o

# Backend
PORT=3001
FRONTEND_URL=http://localhost:4200

# PostgreSQL
DATABASE_URL=postgresql://hermeneutica:hermeneutica_pass@localhost:5432/hermeneutica

# Calea către directorul cu fișierele biblice locale (ro_sinodala.json)
# Default: ./data (corect pentru container; pentru dev local: ../data)
DATA_DIR=./data

# Corpus patristic New Advent (opțional)
# Setează calea absolută către directorul fathers/ din arhiva New Advent
# și rulează: cd backend && npm run index:patristic
# PATRISTIC_DATA_DIR=/calea/ta/absoluta/catre/fathers
```

---

## 📡 API Reference

### `POST /api/analyze`

Analizează un fragment biblic și returnează 4 carduri hermeneutice.

**Request:**
```json
{
  "text": "Fiindcă Dumnezeu aşa a iubit lumea, că pe Fiul Său Cel Unul-Născut L-a dat...",
  "range": "Ioan 3:16",
  "language": "Sinodală Română",
  "translationId": "ro_sinodala"
}
```

> **Notă:** `translationId` este opțional. Dacă este furnizat și începe cu `eng_`
> (ex. `eng_kja` pentru KJV), traducerea textului în engleză pentru embedding patristic
> este omisă automat.

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

> **Notă:** Câmpul `patristics` este generat prin RAG (Retrieval-Augmented Generation)
> din corpusul New Advent indexat local, nu direct de la modelul AI.

### `GET /api/bible/parallel/:bookId/:chapter`

Returnează versetul/versetele selectate din toate traducerile disponibile (mai puțin traducerea curentă), în paralel. Folosit de panoul "Studiu Paralel".

**Query params:**
- `verseStart` *(obligatoriu)* – numărul primului verset
- `verseEnd` *(opțional)* – numărul ultimului verset (implicit = `verseStart`)
- `exclude` *(opțional)* – ID-ul traducerii active; aceasta va fi omisă din răspuns

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

> **Notă:** Traducerile cu un canon diferit (ex. `hbo_wlc` – doar VT, `grc_byz` – doar NT) vor returna `available: false` și `verses: []` pentru versetele din afara canonului lor.

### `GET /api/bible/translations`

Listează traducerile biblice disponibile.

Traducerile suportate / Supported translations:

| ID | Nume / Name | Limbă / Language |
|----|-------------|------------------|
| `hbo_wlc` | Westminster Leningrad Codex | Ebraică / Hebrew |
| `grc_bre` | Greek Bible (Brenton LXX) | Greacă / Greek |
| `grc_byz` | Byzantine Greek NT | Greacă NT / Greek NT |
| `eng_kja` | King James Version with Apocrypha | Engleză / English |
| `ro_sinodala` | Biblia Sinodală Română | Română / Romanian |

> **Notă:** Traducerea `ro_sinodala` este disponibilă doar dacă fișierul local `data/bibles/ro_sinodala.json` a fost populat cu scriptul `scripts/biblia-pipeline.ts`. Vezi secțiunea [Date Biblice](#-date-biblice--biblical-data) de mai jos.

### `GET /api/bible/:translationId/books`

Listează cărțile disponibile pentru o anumită traducere.

```bash
GET /api/bible/ro_sinodala/books
GET /api/bible/eng_kja/books
```

### `GET /api/bible/:translationId/:bookId/:chapter`

Returnează versetele unui capitol biblic.

```bash
GET /api/bible/ro_sinodala/MAT/5
GET /api/bible/eng_kja/JHN/3
GET /api/bible/grc_byz/JHN/3
```

---

## 🛠️ Stack Tehnologic

| Layer | Tehnologie |
|-------|-----------|
| **Backend** | NestJS 10, TypeScript 5.7 |
| **AI** | OpenAI API (modele configurabile: LLM pentru carduri hermeneutice, `gpt-4o-mini` pentru traducere, `text-embedding-3-small` pentru embeddings), Prompt YAML |
| **Frontend** | Angular 19.2, PrimeNG 19.1 |
| **Styling** | SCSS, PrimeIcons |
| **Database** | PostgreSQL 16 + pgvector (căutare semantică vectorială) |
| **Data Source** | bible.helloao.org (External API) + `ro_sinodala.json` (local) + New Advent corpus (local, opțional) |
| **DevOps** | Podman, Podman Compose |
| **CI/CD** | GitHub Actions |
| **PWA** | Service Worker, Web Manifest |

---

## 🧪 Testare / Testing

```bash
# Backend unit tests (cu coverage)
cd backend && npm run test:cov

# Frontend tests
cd frontend && npm test
```

---

## 📜 Date Patristice / Patristic Data

> **Important:** Repository-ul NU conține texte patristice.
> Singura sursă testată este **New Advent – Church Fathers** (fișiere `.htm`).
> Utilizatorul este responsabil pentru achiziționarea și respectarea termenilor de utilizare.

Pentru un ghid complet pas cu pas, consultă **[docs/patristic-setup.md](docs/patristic-setup.md)**.

### Rezumat rapid

1. Achiziționează arhiva de la [https://newadvent.gumroad.com/l/na2](https://newadvent.gumroad.com/l/na2)
2. Dezarhivează și setează `PATRISTIC_DATA_DIR=/calea/catre/fathers` în `.env`
3. Rulează indexarea:
   ```bash
   cd backend && \
     DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/hermeneutica \
     PATRISTIC_DATA_DIR=/calea/ta/absoluta/catre/fathers \
     OPENAI_API_KEY=sk-proj-... \
     npm run index:patristic
   ```
4. Durată estimată: **20–30 minute**

### Actualizare chunk-uri cu autor/operă necunoscute

Unele chunk-uri pot rămâne cu `author = 'unknown'` sau `work = 'unknown'` după indexare
(fișiere fără referințe directe în `index.html`). Identifică-le și corectează-le manual:

```sql
-- Identifică chunk-urile cu metadate lipsă
SELECT chapter, count(*)
FROM patristic_chunks
WHERE work = 'unknown' OR author = 'unknown'
GROUP BY chapter;

-- Actualizează manual (exemplu: Canoanele Apostolice)
UPDATE patristic_chunks
SET work = 'The Apostolic Canons',
    author = 'Anonymous'
WHERE chapter = '3820';
```

> **Important:** Valorile din exemplu sunt ilustrative. Verifică ce fișiere corespund
> capitolelor cu `unknown` înainte de a rula `UPDATE`.

### Variabile de mediu pentru date patristice

| Variabilă | Descriere |
|-----------|-----------|
| `PATRISTIC_DATA_DIR` | Calea absolută către directorul `fathers/` din arhiva New Advent, care conține `index.html` și fișierele `.htm`. Dacă nu este setată, indexarea este omisă fără erori. |

---

## 📚 Date Biblice / Biblical Data

Aplicația utilizează atât API-ul extern furnizat de [bible.helloao.org](https://bible.helloao.org/api), cât și un fișier local JSON pentru Biblia Sinodală Română. Aceasta permite navigarea integrală a Sfintei Scripturi.

Caracteristici:
- **Acces dinamic:** Navigare prin toate cărțile și capitolele disponibile în traducerile suportate.
- **Traduceri remote:** `hbo_wlc` (Ebraică Masoretică), `grc_bre` (Septuaginta Brenton), `grc_byz` (Greacă Byzantină NT), `eng_kja` (KJV cu Apocrife) – servite live via bible.helloao.org.
- **Traducere locală:** `ro_sinodala` (Biblia Sinodală Română) – populată cu scriptul `scripts/biblia-pipeline.ts` și stocată în `data/bibles/ro_sinodala.json`.
- **Interfață simplificată:** Backend-ul NestJS acționează ca un proxy/adaptor, asigurând stabilitate și maparea corectă a versetelor pentru procesarea AI.

### Script Date / Data Pipeline Script

```bash
# Descarcă și procesează Biblia Sinodală Română locală
cd scripts
npm install
npm run biblia-pipeline
# Generează: data/bibles/ro_sinodala.json
```

---

## 🤝 Contributing

Consultați [CONTRIBUTING.md](CONTRIBUTING.md) pentru ghidul de contribuție.

Arii de contribuție:
- [ ] Adăugare cărți biblice complete
- [ ] Integrare Ebraică (VT cu Strong's)
- [x] Căutare semantică (pgvector) – implementată
- [x] Studiu paralel (comparare versete între traduceri) – implementat
- [x] Comentarii patristice prin RAG (New Advent) – implementat
- [ ] Export PDF analize
- [ ] Traducere în alte limbi

---

## 📄 Licență / License

MIT License – vezi [LICENSE](LICENSE)

---

## ✝ Mulțumiri / Acknowledgments

- Sfânta Scriptură – Biblia Sinodală (1914, rev. 2008)
- **[Bible API (helloao.org)](https://bible.helloao.org)** – Sursă de date scripturistice deschise
- **[New Advent – Church Fathers](https://www.newadvent.org/fathers/)** – Corpus patristic (texte obținute separat de utilizator)
- **[OpenAI](https://openai.com)** – Modele de limbaj și embeddings (API)
- NestJS & Angular teams

---

<div align="center">
<em>„La început era Cuvântul" – Ioan 1:1</em>
<br>
Made with ✝ for Orthodox Hermeneutics
</div>
