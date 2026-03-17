# ✝ AI Hermeneutica Orthodoxa

<div align="center">

[![NestJS](https://img.shields.io/badge/NestJS-10+-E0234E?style=for-the-badge&logo=nestjs)](https://nestjs.com)
[![Angular](https://img.shields.io/badge/Angular-19.2-DD0031?style=for-the-badge&logo=angular)](https://angular.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![PrimeNG](https://img.shields.io/badge/PrimeNG-19-4CAF50?style=for-the-badge)](https://primeng.org)
[![Docker](https://img.shields.io/badge/Docker-compose-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com)
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

**RO:** AI Hermeneutica Orthodoxa este o aplicație web full-stack care permite navigarea textului biblic (via helloao.org API) și oferă analiză hermeneutică ortodoxă în 4 dimensiuni prin AI (GPT-4o), precum și studiu biblic paralel între toate traducerile disponibile:

| Card | Conținut |
|------|----------|
| 📖 **Principii Hermeneutice** | Interpretare în 4 sensuri: literal, tropologic, alegoric, anagogic |
| 🧠 **Influențe Filozofice** | Platonism creștin, Neoplatonism, Stoicism patristic |
| ⛪ **Comentarii Patristice** | Citații din Sf. Ioan Gură de Aur, Chiril Alexandrianul, Vasile cel Mare etc. |
| 🔤 **Analiză Filologică** | Greacă/Ebraică biblică, Strong's, LXX, morfologie |
| 📚 **Studiu Paralel** | Versetul selectat afișat simultan în toate traducerile disponibile (N/A pentru traduceri cu canon diferit) |

**EN:** AI Hermeneutica Orthodoxa is a full-stack web application for navigating Biblical text (via helloao.org API), receiving AI-powered orthodox hermeneutic analysis across 4 dimensions via GPT-4o, and comparing selected verses side-by-side across all available translations.

---

## 🎥 Demo

> **Exemplu: Matei 5:3 → 4 Carduri AI**

```
Utilizator selectează: "Fericiţi cei săraci cu duhul, că a lor este Împărăţia cerurilor."

📖 Principii Hermeneutice:
  Literal: sărăcia materială și conștientizarea dependenței de Dumnezeu
  Tropologic: virtutea smereniei, lepădarea de sine
  Alegoric: tipul Israelului rob în Egipt, dependenți de Dumnezeu
  Anagogic: moștenirea Împărăției cerești, theosis

🧠 Influențe Filozofice:
  Platonism: scala ființei – coborârea (katabasis) ca premisă a înălțării
  Dionisie Areopagitul: apofatismul → cunoașterea prin sărăcie cognitivă
  Stoicism: apatheia → nepătimire = libertate de patimi

⛪ Comentarii Patristice:
  Ioan Gură de Aur: «Sărăcia cu duhul = smerenia sufletului» (PG 57:226)
  Grigorie de Nyssa: «Recunoașterea sărăciei naturii proprii» (PG 44:1200)

🔤 Analiză Filologică:
  πτωχοί (ptōchoi): cerșetor total (≠ πένης = sărac modest)
  LXX Is 61:1: ἀναγγεῖλαι πτωχοῖς
  Strong's G4434: from ptōssō (to crouch, cower)
```

---

## 🏗️ Arhitectură / Architecture

```
AI-Hermeneutica-Orthodoxa/
├── backend/                    # NestJS 10+ API
│   ├── src/
│   │   ├── analyze/            # POST /api/analyze → 4 carduri
│   │   │   ├── dto/            # AnalyzeDto (validare)
│   │   │   ├── analyze.controller.ts
│   │   │   ├── analyze.module.ts
│   │   │   ├── analyze.service.ts
│   │   │   └── analyze.service.spec.ts
│   │   ├── ai/
│   │   │   ├── ai.module.ts
│   │   │   ├── ai.service.ts   # OpenAI GPT-4o integration
│   │   │   └── prompts/hermeneutica.yaml  # System prompts (YAML)
│   │   ├── bible/              # Bible API proxy + local BSR loader
│   │   │   ├── bible.controller.ts
│   │   │   ├── bible.module.ts
│   │   │   ├── bible.service.ts
│   │   │   └── bible.service.spec.ts
│   │   ├── config/             # Configuration
│   │   │   └── configuration.ts
│   │   ├── patristic/          # Patristic corpus integration (local files)
│   │   │   ├── pipeline.config.ts           # Chunk size, similarity threshold
│   │   │   ├── patristic-loader.service.ts  # File scan, HTML clean, chunking
│   │   │   ├── patristic-embedding.service.ts # Embed + store in patristic_chunks
│   │   │   ├── patristic-queries.ts         # SQL queries
│   │   │   └── patristic.module.ts
│   │   ├── scripts/
│   │   │   └── index-patristic.ts  # CLI: PATRISTIC_DATA_DIR=... npm run index:patristic
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── Dockerfile
├── frontend/                   # Angular 19+ SPA
│   ├── src/app/
│   │   ├── bible-viewer/       # Text navigabil + selector versete
│   │   │   ├── bible-selector.component.ts
│   │   │   ├── bible-text.component.ts
│   │   │   ├── bible-viewer.component.ts
│   │   │   ├── parallel-viewer.component.ts  # Studiu paralel
│   │   │   └── verse-highlighter.directive.ts
│   │   ├── analysis/           # 4 Carduri rezultate
│   │   │   └── results-viewer.component.ts
│   │   └── services/           # HTTP services
│   │       ├── analysis.service.ts
│   │       └── bible-api.service.ts
│   └── Dockerfile
├── scripts/                    # Utilitare de date / Data utilities
│   └── biblia-pipeline.ts      # Script descărcare/procesare BSR locală
├── data/
│   ├── bibles/                 # Traduceri locale (ex. BSR.json)
│   │   └── .gitkeep
│   └── patristic-snippets.json # Citații patristice
├── .env.example                # Template variabile de mediu
├── docker-compose.yml          # PostgreSQL + backend + frontend
└── .github/workflows/ci.yml
```

---

## 🚀 Instalare / Installation

### Cerințe / Requirements

- Node.js 20+
- Podman & Podman Compose **or** Docker & Docker Compose
- Cheie API OpenAI (pentru analiza AI)

### Quick Start cu Podman / Docker

```bash
# 1. Clonează repository-ul
git clone https://github.com/alexmacavei/hermeneutica-AI.git
cd hermeneutica-AI

# 2. Configurează variabilele de mediu
cp .env.example .env
# Editează .env și adaugă OPENAI_API_KEY=sk-...

# 3. (Opțional) Populează Biblia Sinodală locală (BSR)
cd scripts && npm install && npm run biblia-pipeline
cd ..

# 4. Pornește toate serviciile (Podman sau Docker)
podman compose up --build --force-recreate --remove-orphans
# sau:
# docker compose up --build --force-recreate --remove-orphans

# 5. Oprește toate serviciile
podman compose down
# sau: docker compose down

# Frontend: http://localhost:4200
# API:      http://localhost:3001/api
# DB:       localhost:5432 (PostgreSQL cu pgvector)
```

### Instalare Manuală / Manual Installation

```bash
# Backend
cd backend
npm install
npm run start:dev    # API pe :3001

# Frontend (alt terminal)
cd frontend
npm install
npm start            # UI pe :4200
```

### Variabile de Mediu / Environment Variables

```env
# backend/.env  (or root .env mounted by docker-compose)
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o
PORT=3001
FRONTEND_URL=http://localhost:4200
# Path to the data directory containing bibles/ subfolder.
# Defaults to <cwd>/data (correct for Docker where cwd=/app).
# For manual dev (cd backend && npm run start:dev), set to ../data.
DATA_DIR=./data
```

---

## 📡 API Reference

### `POST /api/analyze`

Analizează un fragment biblic și returnează 4 carduri hermeneutice.

**Request:**
```json
{
  "text": "Fericiţi cei săraci cu duhul...",
  "range": "Matei 5:3",
  "language": "Sinodală Română"
}
```

**Response:**
```json
{
  "reference": "Matei 5:3",
  "language": "Sinodală Română",
  "text": "Fericiţi cei săraci cu duhul...",
  "cards": {
    "hermeneutics": "Interpretare în 4 sensuri...",
    "philosophy": "Platonism creștin...",
    "patristics": "Ioan Gură de Aur: «...» (PG 57:226)",
    "philology": "πτωχοί (ptōchoi): Strong's G4434..."
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### `GET /api/bible/parallel/:bookId/:chapter`

Returnează versetul/versetele selectate din toate traducerile disponibile (mai puțin traducerea curentă), în paralel. Folosit de panoul "Studiu Paralel".

**Query params:**
- `verseStart` *(obligatoriu)* – numărul primului verset
- `verseEnd` *(opțional)* – numărul ultimului verset (implicit = `verseStart`)
- `exclude` *(opțional)* – ID-ul traducerii active; aceasta va fi omisă din răspuns

```bash
GET /api/bible/parallel/JHN/3?verseStart=16&exclude=BSR
```

**Response:**
```json
[
  { "translationId": "WLC",  "translationName": "Westminster Leningrad Codex", "available": false, "verses": [] },
  { "translationId": "LXX",  "translationName": "Septuaginta",                 "available": false, "verses": [] },
  { "translationId": "UGNT", "translationName": "Unlocked Greek New Testament","available": true,  "verses": [{ "number": "16", "text": "Οὕτως γὰρ ἠγάπησεν..." }] },
  { "translationId": "KJVA", "translationName": "King James Version",          "available": true,  "verses": [{ "number": "16", "text": "For God so loved..."   }] }
]
```

> **Notă:** Traducerile cu un canon diferit (ex. `WLC` – doar VT, `UGNT` – doar NT) vor returna `available: false` și `verses: []` pentru versetele din afara canonului lor.

### `GET /api/bible/translations`

Listează traducerile biblice disponibile.

Traducerile suportate / Supported translations:

| ID | Nume / Name | Limbă / Language |
|----|-------------|------------------|
| `WLC` | Westminster Leningrad Codex | Ebraică / Hebrew |
| `LXX` | Septuaginta | Greacă / Greek |
| `UGNT` | Unlocked Greek New Testament | Greacă NT / Greek NT |
| `KJVA` | King James Version with Apocrypha | Engleză / English |
| `BSR` | Biblia Sinodală Română | Română / Romanian |

> **Notă:** Traducerea `BSR` este disponibilă doar dacă fișierul local `data/bibles/BSR.json` a fost populat cu scriptul `scripts/biblia-pipeline.ts`. Vezi secțiunea [Script Date](#script-date--data-pipeline-script) de mai jos.

### `GET /api/bible/:translationId/books`

Listează cărțile disponibile pentru o anumită traducere.

```bash
GET /api/bible/BSR/books
```

### `GET /api/bible/:translationId/:bookId/:chapter`

Returnează versetele unui capitol biblic.

```bash
GET /api/bible/BSR/MAT/5
GET /api/bible/LXX/MAT/5
```

---

## 🛠️ Stack Tehnologic

| Layer | Tehnologie |
|-------|-----------|
| **Backend** | NestJS 10, TypeScript 5.7 |
| **AI** | OpenAI GPT-4o, Prompt YAML |
| **Frontend** | Angular 19.2, PrimeNG 19.1 |
| **Styling** | SCSS, PrimeIcons |
| **Database** | PostgreSQL 16 + pgvector (semantic search – viitor) |
| **Data Source** | bible.helloao.org (External API) + local BSR JSON |
| **DevOps** | Podman / Docker, Compose |
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
> Fișierele sursă (New Advent – Church Fathers, Migne Patrologia Graeca etc.) nu sunt incluse
> din motive de dimensiune și copyright.  
> Codul de integrare este prezent; textele trebuie obținute legal de către utilizator.

### Cum se integrează texte patristice locale

1. Descarcă sau achiziționează arhiva patristică (de ex. [New Advent Church Fathers](https://www.newadvent.org/fathers/)).
2. Dezarhivează fișierele într-un director local (ex. `/home/user/patristic-data`).
   Structura recomandată (flexibilă):
   ```
   /home/user/patristic-data/
   ├── chrysostom/
   │   ├── homilies-matthew/
   │   │   ├── homily1.html
   │   │   └── homily2.html
   │   └── on-the-priesthood/
   │       └── book1.html
   └── basil/
       └── hexaemeron/
           └── homily1.html
   ```
3. Setează variabila de mediu și rulează indexarea:
   ```bash
   cd backend
   PATRISTIC_DATA_DIR=/home/user/patristic-data npm run index:patristic
   ```
4. Comanda populează tabelul `patristic_chunks` în baza de date PostgreSQL cu embeddings vectoriale,
   gata pentru căutare semantică.

### Variabile de mediu pentru date patristice

| Variabilă | Descriere |
|-----------|-----------|
| `PATRISTIC_DATA_DIR` | Calea absolută către directorul cu fișierele patristice locale (`.html` / `.txt`). Dacă nu este setată, indexarea este omisă fără erori. |

> Adaugă `PATRISTIC_DATA_DIR=/calea/ta` în fișierul `.env` (copiat din `.env.example`).

---

## 📚 Date Biblice / Biblical Data

Aplicația utilizează atât API-ul extern furnizat de [bible.helloao.org](https://bible.helloao.org/api), cât și un fișier local JSON pentru Biblia Sinodală Română (BSR). Aceasta permite navigarea integrală a Sfintei Scripturi.

Caracteristici:
- **Acces dinamic:** Navigare prin toate cărțile și capitolele disponibile în traducerile suportate.
- **Traduceri remote:** `WLC` (Ebraică Masoretică), `LXX` (Septuaginta), `UGNT` (Greacă NT), `KJVA` (KJV cu Apocrife) – servite live via bible.helloao.org.
- **Traducere locală:** `BSR` (Biblia Sinodală Română) – populată cu scriptul `scripts/biblia-pipeline.ts` și stocată în `data/bibles/BSR.json`.
- **Interfață simplificată:** Backend-ul NestJS acționează ca un proxy/adaptor, asigurând stabilitate și maparea corectă a versetelor pentru procesarea AI.

### Script Date / Data Pipeline Script

```bash
# Descarcă și procesează Biblia Sinodală Română locală
cd scripts
npm install
npm run biblia-pipeline
# Generează: data/bibles/BSR.json
```

---

## 🤝 Contributing

Consultați [CONTRIBUTING.md](CONTRIBUTING.md) pentru ghidul de contribuție.

Arii de contribuție:
- [ ] Adăugare cărți biblice complete
- [ ] Integrare Ebraică (VT cu Strong's)
- [ ] Căutare semantică (pgvector)
- [x] Studiu paralel (comparare versete între traduceri)
- [ ] Export PDF analize
- [ ] Traducere în alte limbi

---

## 📄 Licență / License

MIT License – vezi [LICENSE](LICENSE)

---

## ✝ Mulțumiri / Acknowledgments

- Sfânta Scriptură – Biblia Sinodală (1914, rev. 2008)
- **[Bible API (helloao.org)](https://bible.helloao.org)** – Sursă de date scripturistice deschise
- Părinții Bisericii – Patrologia Graeca (PG), Migne
- OpenAI pentru GPT-4o
- NestJS & Angular teams

---

<div align="center">
<em>„La început era Cuvântul" – Ioan 1:1</em>
<br>
Made with ✝ for Orthodox Hermeneutics
</div>