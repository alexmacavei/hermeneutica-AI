# ✝ AI Hermeneutica Orthodoxa

<div align="center">

[![NestJS](https://img.shields.io/badge/NestJS-10+-E0234E?style=for-the-badge&logo=nestjs)](https://nestjs.com)
[![Angular](https://img.shields.io/badge/Angular-21.2-DD0031?style=for-the-badge&logo=angular)](https://angular.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![PrimeNG](https://img.shields.io/badge/PrimeNG-21-4CAF50?style=for-the-badge)](https://primeng.org)
[![NgRx Signals](https://img.shields.io/badge/%40ngrx%2Fsignals-21-BA2BD2?style=for-the-badge)](https://ngrx.io/guide/signals)
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

**RO:** AI Hermeneutica Orthodoxa este o aplicație web full-stack care permite navigarea textului biblic – via API [helloao.org](https://bible.helloao.org) pentru traducerile remote și local pentru **Biblia Sinodală Română** și **Biblia Anania** – și oferă analiză hermeneutică ortodoxă prin modele OpenAI, studiu biblic paralel între toate traducerile disponibile, **căutare semantică vectorială** în textul biblic (pgvector), **autentificare utilizator** (JWT), **notițe personale** per verset și un **chatbot teologic RAG** accesibil utilizatorilor autentificați.

Funcționalitățile principale ale aplicației sunt:

| Card | Conținut | Sursă |
|------|----------|-------|
| 📖 **Principii Hermeneutice** | Interpretare în 4 sensuri: literal, tropologic, alegoric, anagogic | OpenAI (LLM) |
| 🧠 **Influențe Filozofice** | Platonism creștin, Neoplatonism, Stoicism patristic | OpenAI (LLM) |
| ⛪ **Comentarii Patristice** | Citații din Părinții Bisericii (ex. Sf. Ioan Gură de Aur, Vasile cel Mare etc.) extrase din corpus **New Advent** prin căutare semantică RAG | New Advent + OpenAI Embeddings |
| 🔤 **Analiză Filologică** | Greacă/Ebraică biblică, Strong's (date reale via biblesdk.com), LXX, morfologie | OpenAI (LLM) + biblesdk |
| 📚 **Studiu Paralel** | Versetul selectat afișat simultan în toate traducerile disponibile (N/A pentru traduceri cu canon diferit) | bible.helloao.org |
| 💬 **Chat Teologic** | Conversație liberă cu asistentul AI, fundamentată pe corpusul patristic RAG și traducerile biblice disponibile (doar utilizatori autentificați) | New Advent RAG + OpenAI LLM |

**EN:** AI Hermeneutica Orthodoxa is a full-stack web application for navigating Biblical text (via helloao.org API), receiving AI-powered orthodox hermeneutic analysis using OpenAI models, comparing selected verses side-by-side across all available translations, **dual-layer semantic search** over Bible verses (local pgvector + biblesdk.com cross-reference, with consensus boosting), **user authentication** (JWT), **personal notes** per verse, and a **RAG-based theological chatbot** for authenticated users.

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

⛪ Comentarii Patristice:
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
                        ┌──────────────────────────────┐
                        │   OpenAI API                 │
                        │   • LLM (hermeneutică)       │
                        │   • gpt-4o-mini (traducere)  │
                        │   • text-embedding-3-small   │
                        └──────────────┬───────────────┘
                                       │ HTTPS
┌───────────────────────┐              │              ┌────────────────────────┐
│   Browser / Frontend  │  HTTP REST   │              │  bible.helloao.org     │
│   (Angular 21 SPA)    │◄────────────►│              │  (traduceri remote)    │
│                       │  :3001       │              └────────────┬───────────┘
│   • Navigare biblică  │              │                           │ HTTPS
│   • Studiu Paralel    │   ┌──────────▼──────────────────────────▼──────────┐
│   • 4 Carduri AI      │   │           NestJS Backend (:3001)               │
│   • Căutare semantică │   │                                                │
│   • Autentificare JWT │   │  POST /api/analyze          (JWT required)     │
│   • Notițe personale  │   │   ├─ 2 carduri LLM (hermeneutică+filologie)   │
│   • Chat teologic     │   │   │                             → OpenAI LLM    │
│   • Export PDF        │   │   ├─ card filozofie (RAG ext) → BiblIndex /    │
└───────────────────────┘   │   │                              Wikidata /     │
                            │   │                              Philosophers   │
                            │   └─ card patristic RAG:                       │
                            │       ├─ traducere EN          → OpenAI LLM    │
                            │       ├─ embedding query       → OpenAI API    │
                            │       ├─ căutare vectorială    → pgvector DB   │
                            │       └─ sinteză citate        → OpenAI LLM    │
                            │                                                │
                            │  POST /api/pdf/export       (JWT required)     │
                            │   └─ Puppeteer/Chromium → PDF binary           │
                            │                                                │
                            │  POST /api/chat/message     (JWT required)     │
                            │   ├─ RAG top-5 chunks        → pgvector DB    │
                            │   └─ răspuns conversațional  → OpenAI LLM     │
                            │                                                │
                            │  POST /api/auth/register                       │
                            │  POST /api/auth/login                          │
                            │                                                │
                            │  GET /api/notes             (JWT required)     │
                            │  POST /api/notes            (JWT required)     │
                            │  PUT  /api/notes/:id        (JWT required)     │
                            │  DELETE /api/notes/:id      (JWT required)     │
                            │                                                │
                            │  GET /api/search                               │
                            │  POST /api/search/ingest/:tr/:book/:ch         │
                            │                                                │
                            │  GET /api/bible/*                              │
                            │   ├─ traduceri remote          → helloao.org   │
                            │   └─ Biblia Sinodală Română    → fișier local  │
                            └────────────────────┬───────────────────────────┘
                                                 │
                            ┌────────────────────▼───────────────────────────┐
                            │         PostgreSQL 16 + pgvector               │
                            │   patristic_chunks  (embeddings New Advent)    │
                            │   verse_embeddings  (semantic search)          │
                            │   users             (autentificare)            │
                            │   user_notes        (notițe personale)         │
                            └────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────┐
    │  Indexare offline (npm run index:patristic)     │
    │  New Advent .htm → chunks → OpenAI embeddings   │
    │  → salvare în patristic_chunks (PostgreSQL)     │
    └─────────────────────────────────────────────────┘
```

---

## 🚀 Instalare / Installation

### Cerințe / Requirements

- Node.js 20+
- Podman & Podman Compose
- Cheie API OpenAI (pentru analiza AI)
- **Biblia Sinodală Română** – generată local din scriptul `scripts/biblia-pipeline.ts` (vezi [Date Biblice](#-date-biblice--biblical-data))
- **Biblia Anania** – generată local din scriptul `scripts/anania-pipeline.ts` (opțional; vezi [Date Biblice](#-date-biblice--biblical-data))
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

# 3b. (Opțional) Populează Biblia Anania locală
cd scripts && npm run anania-pipeline
cd ..

# 4. Pornește toate serviciile
podman compose up --build --force-recreate --remove-orphans

# 5. Oprește toate serviciile
podman compose down

# Frontend: http://localhost:4200
# API:      http://localhost:3001/api
# DB:       localhost:5432 (PostgreSQL cu pgvector)
```

### Local Development (with hot-reload)

For a better developer experience, you can run the backend and frontend locally (with hot-reload) while keeping only PostgreSQL in Podman Compose.

```bash
# 1. Clone and configure (same as above – steps 1–3)

# 2. In .env make sure DATA_DIR=../data (so the backend finds data/ from its cwd)
#    DATABASE_URL should point to localhost:5432 (default in .env.example)

# 3. Start only the database in Podman Compose
podman compose -f docker-compose.dev.yml up -d

# 4. Install root dev dependencies (concurrently)
npm install

# 5. Start both backend and frontend simultaneously with hot-reload
npm run dev

# Or start them separately in different terminals:
npm run dev:backend   # NestJS with --watch (restarts on file changes)
npm run dev:frontend  # Angular dev-server with hot-reload

# Frontend: http://localhost:4200
# API:      http://localhost:3001/api
# DB:       localhost:5432 (PostgreSQL via Podman Compose)
```

Key environment variables for local dev (`.env`):

| Variable | Local dev value | Docker Compose value |
|----------|----------------|---------------------|
| `DATABASE_URL` | `postgresql://...@localhost:5432/hermeneutica` | `postgresql://...@postgres:5432/hermeneutica` |
| `DATA_DIR` | `../data` | `./data` |
| `JWT_SECRET` | orice string lung, aleator | același string în producție |

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

# JWT – schimbă această valoare cu un string aleator lung în producție!
JWT_SECRET=changeme-set-a-strong-random-secret-here

# PostgreSQL
# Local dev (npm run dev): backend se conectează la postgres din Podman via localhost
DATABASE_URL=postgresql://hermeneutica:hermeneutica_pass@localhost:5432/hermeneutica
# Full Docker Compose (docker-compose.yml): folosiți @postgres:5432 în loc de @localhost:5432

# Calea către directorul cu fișierele biblice locale (ro_sinodala.json)
# Local dev (npm run dev:backend): DATA_DIR=../data  (relativ la backend/)
# Full Docker Compose: DATA_DIR=./data  (relativ la /app în container)
DATA_DIR=../data

# Corpus patristic New Advent (opțional)
# Setează calea absolută către directorul fathers/ din arhiva New Advent
# și rulează: cd backend && npm run index:patristic
# PATRISTIC_DATA_DIR=/calea/ta/absoluta/catre/fathers
```

---

## 📡 API Reference

> **Documentație completă:** [docs/api-reference.md](docs/api-reference.md)

Toate endpoint-urile sunt prefixate cu `/api` (ex. `http://localhost:3001/api`).
Endpoint-urile marcate **🔒** necesită un JWT valid în header-ul `Authorization: Bearer <token>`.

| Endpoint | Metodă | Auth | Descriere |
|----------|--------|------|-----------|
| `/api/auth/register` | POST | – | Înregistrează utilizator, returnează JWT |
| `/api/auth/login` | POST | – | Autentifică utilizator, returnează JWT |
| `/api/analyze` | POST | 🔒 | Analizează un verset; returnează 4 carduri hermeneutice |
| `/api/pdf/export` | POST | 🔒 | Generează PDF al analizei (Puppeteer/Chromium) |
| `/api/notes` | GET / POST | 🔒 | Listează / creează notițe personale per verset |
| `/api/notes/:id` | PUT / DELETE | 🔒 | Actualizează / șterge o notiță |
| `/api/chat/message` | POST | 🔒 | Trimite mesaj chatbot teologic RAG |
| `/api/search` | GET | – | Căutare semantică duală: pgvector local + biblesdk cross-reference, cu consensus boost |
| `/api/bible/translations` | GET | – | Listează traducerile disponibile |
| `/api/bible/:tr/books` | GET | – | Listează cărțile pentru o traducere |
| `/api/bible/:tr/:book/:ch` | GET | – | Returnează versetele unui capitol |
| `/api/bible/parallel/:book/:ch` | GET | – | Studiu paralel: verset în toate traducerile |

Pentru detalii complete (parametri, exemple request/response), consultați **[docs/api-reference.md](docs/api-reference.md)**.

---

## 🛠️ Stack Tehnologic

| Layer | Tehnologie |
|-------|-----------|
| **Backend** | NestJS 10, TypeScript 5.9 |
| **AI** | OpenAI API (modele configurabile: LLM pentru carduri hermeneutice, `gpt-4o-mini` pentru traducere, `text-embedding-3-small` pentru embeddings), Prompt YAML |
| **Frontend** | Angular 21.2.5, PrimeNG 21.1.3, @ngrx/signals 21.0.1 |
| **Styling** | SCSS, PrimeIcons 7 |
| **Database** | PostgreSQL 16 + pgvector (căutare semantică vectorială); tabele: `verse_embeddings`, `patristic_chunks`, `users`, `user_notes` |
| **Auth** | JWT (NestJS Passport + `@nestjs/jwt`) |
| **PDF Export** | Puppeteer (`puppeteer-core`) + system Chromium – server-side PDF generation |
| **Data Source** | bible.helloao.org (External API) + `ro_sinodala.json` (local) + `ro_anania.json` (local, opțional) + New Advent corpus (local, opțional) |
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

> Pentru detalii complete (inclusiv corectarea chunk-urilor cu autor/operă necunoscute), consultă **[docs/patristic-setup.md](docs/patristic-setup.md)**.

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
- **Traduceri locale:** `ro_sinodala` (Biblia Sinodală Română) – populată cu scriptul `scripts/biblia-pipeline.ts` și stocată în `data/bibles/ro_sinodala.json`; `ro_anania` (Biblia Anania) – populată cu scriptul `scripts/anania-pipeline.ts` și stocată în `data/bibles/ro_anania.json`.
- **Interfață simplificată:** Backend-ul NestJS acționează ca un proxy/adaptor, asigurând stabilitate și maparea corectă a versetelor pentru procesarea AI.

### Script Date / Data Pipeline Script

```bash
# Descarcă și procesează Biblia Sinodală Română locală
cd scripts
npm install
npm run biblia-pipeline
# Generează: data/bibles/ro_sinodala.json

# Descarcă și procesează Biblia Anania locală (opțional)
npm run anania-pipeline
# Generează: data/bibles/ro_anania.json
```

---

## 📄 Export PDF

Utilizatorii autentificați pot descărca analiza hermeneutică a oricărui verset ca document PDF formatat. Exportul include toate cele 4 carduri AI și notițele personale ale utilizatorului.

- Butonul **📄 PDF export** apare în antetul rezultatelor, lângă butonul de notițe.
- Generarea se face server-side prin Puppeteer (Chromium headless) – fără dialog de printare.
- **Local dev:** setează `PUPPETEER_EXECUTABLE_PATH` în `.env` (vezi [docs/pdf-export.md](docs/pdf-export.md)).
- **Docker/Podman:** Chromium este instalat automat din Dockerfile; nicio configurare suplimentară.

Pentru detalii complete (structura PDF, setup local, endpoint API), consultă **[docs/pdf-export.md](docs/pdf-export.md)**.

---

## 🤝 Contributing

Consultați [CONTRIBUTING.md](CONTRIBUTING.md) pentru ghidul de contribuție.

Arii de contribuție:
- [ ] Adăugare cărți biblice complete
- [x] Integrare Ebraică/Greacă (hbo_wlc, grc_bre, grc_byz) – disponibile via Studiu Paralel
- [x] Căutare semantică (pgvector) – implementată
- [x] Studiu paralel (comparare versete între traduceri) – implementat
- [x] Comentarii patristice prin RAG (New Advent) – implementat
- [x] Autentificare utilizator (JWT register/login) – implementată
- [x] Notițe personale per verset – implementate
- [x] Chatbot teologic RAG (conversație bazată pe corpusul patristic) – implementat
- [x] Export PDF analize – implementat
- [ ] Traducere interfață în alte limbi (i18n)

### 💡 Sugestii viitoare / Future Suggestions

- [ ] **Bookmark versete** – salvarea versetelor favorite cu etichete personalizate
- [ ] **Profil utilizator** – pagină de setări (limbă implicită, traducere implicită, temă)
- [x] **Temă întunecată / Dark mode** – comutator light/dark integrat în UI
- [ ] **Notificări push (PWA)** – memento-uri pentru studiu biblic zilnic
- [ ] **Commentarii comunitare** – posibilitatea de a publica (opțional) notițe ca reflecții publice moderate
- [x] **Integrare Strong's Concordance** – afișare directă a numărului Strong și a definiției pentru cuvinte cheie din verset
- [ ] **Comparare analize** – afișarea analizei a două versete diferite side-by-side
- [ ] **Istoric analize** – log local/server al analizelor anterioare, cu posibilitate de revenire
- [ ] **Suport corpus patristic suplimentar** – integrare CCEL (Christian Classics Ethereal Library) sau alte surse
- [ ] **Rate limiting & caching** – cache Redis/in-memory pentru rezultatele OpenAI pentru a reduce costurile API
- [ ] **Grafic de influențe filozofice** – vizualizare interactivă (D3.js) a rețelei de influențe patristice/filozofice identificate de AI
- [ ] **Export DOCX / ePub** – formate suplimentare de export al analizelor

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
