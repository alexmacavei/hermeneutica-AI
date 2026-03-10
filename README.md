# ✝ AI Hermeneutica Orthodoxa

<div align="center">

[![NestJS](https://img.shields.io/badge/NestJS-10+-E0234E?style=for-the-badge&logo=nestjs)](https://nestjs.com)
[![Angular](https://img.shields.io/badge/Angular-18+-DD0031?style=for-the-badge&logo=angular)](https://angular.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-compose-2496ED?style=for-the-badge&logo=docker)](https://docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![CI](https://github.com/alexmacavei/hermeneutica-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/alexmacavei/hermeneutica-AI/actions)

**Instrument AI pentru analiză hermeneutică ortodoxă bazată pe Biblia Sinodală**

*AI Tool for Orthodox Hermeneutic Analysis based on the Synodal Bible*

[🚀 Demo Live](#demo) · [📖 Documentație](#instalare) · [🤝 Contribuie](#contributing)

</div>

---

## 📖 Descriere / Description

**RO:** AI Hermeneutica Orthodoxa este o aplicație web full-stack care permite navigarea textului biblic (Biblia Sinodală Română, Greacă NT) și oferă analiză hermeneutică ortodoxă în 4 dimensiuni prin AI (GPT-4o):

| Card | Conținut |
|------|----------|
| 📖 **Principii Hermeneutice** | Interpretare în 4 sensuri: literal, tropologic, alegoric, anagogic |
| 🧠 **Influențe Filozofice** | Platonism creștin, Neoplatonism, Stoicism patristic |
| ⛪ **Comentarii Patristice** | Citații din Sf. Ioan Gură de Aur, Chiril Alexandrianul, Vasile cel Mare etc. |
| 🔤 **Analiză Filologică** | Greacă/Ebraică biblică, Strong's, LXX, morfologie |

**EN:** AI Hermeneutica Orthodoxa is a full-stack web application for navigating Biblical text (Romanian Synodal Bible, Greek NT) and receiving AI-powered orthodox hermeneutic analysis across 4 dimensions via GPT-4o.

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
│   │   │   ├── analyze.service.ts
│   │   │   └── analyze.controller.ts
│   │   ├── ai/
│   │   │   ├── ai.service.ts   # OpenAI GPT-4o integration
│   │   │   └── prompts/hermeneutica.yaml  # System prompts
│   │   ├── bible/              # Bible data service
│   │   └── config/             # Configuration
│   └── Dockerfile
├── frontend/                   # Angular 18+ SPA
│   ├── src/app/
│   │   ├── bible-viewer/       # Text navigabil + selector
│   │   ├── analysis/           # 4 Carduri rezultate
│   │   └── services/           # HTTP analysis service
│   └── Dockerfile
├── data/
│   ├── bibles/                 # JSON: Sinodală RO + Greacă NT
│   └── patristic-snippets.json # Citații patristice
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## 🚀 Instalare / Installation

### Cerințe / Requirements

- Node.js 20+
- Docker & Docker Compose
- Cheie API OpenAI (pentru analiza AI)

### Quick Start cu Docker

```bash
# 1. Clonează repository-ul
git clone https://github.com/alexmacavei/hermeneutica-AI.git
cd hermeneutica-AI

# 2. Configurează variabilele de mediu
cp .env.example .env
# Editează .env și adaugă OPENAI_API_KEY=sk-...

# 3. Pornește toate serviciile
docker-compose up --build

# Frontend: http://localhost:4200
# API:      http://localhost:3001/api
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
# backend/.env
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o
PORT=3001
FRONTEND_URL=http://localhost:4200
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

### `GET /api/bible/:testament/:book/:chapter`

Returnează versetele unui capitol biblic.

```bash
GET /api/bible/NT/Matei/5?language=sinodala-ro
```

---

## 🛠️ Stack Tehnologic

| Layer | Tehnologie |
|-------|-----------|
| **Backend** | NestJS 10, TypeScript strict |
| **AI** | OpenAI GPT-4o, Prompt YAML |
| **Frontend** | Angular 18, Angular Material |
| **Styling** | SCSS, Dark theme teologic |
| **Database** | PostgreSQL + pgvector (extensibil) |
| **DevOps** | Docker, Docker Compose |
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

## 📚 Date Biblice / Biblical Data

Aplicația include:
- **Biblia Sinodală Română** – Matei 1, 5, 6; Ioan 1, 3; Psalmi 22, 50, 90; Geneza 1; Isaia 61
- **Greacă NT** – Matei 5 (Fericirile), Ioan 1, 3:16; Psalmi LXX

Textele sunt stocate în format JSON ierarhic:
```json
{
  "NT": {
    "Matei": {
      "5": {
        "3": "Fericiţi cei săraci cu duhul..."
      }
    }
  }
}
```

---

## 🤝 Contributing

Consultați [CONTRIBUTING.md](CONTRIBUTING.md) pentru ghidul de contribuție.

Arii de contribuție:
- [ ] Adăugare cărți biblice complete
- [ ] Integrare Ebraică (VT cu Strong's)
- [ ] Căutare semantică (pgvector)
- [ ] Export PDF analize
- [ ] Traducere în alte limbi

---

## 📄 Licență / License

MIT License – vezi [LICENSE](LICENSE)

---

## ✝ Mulțumiri / Acknowledgments

- Sfânta Scriptură – Biblia Sinodală (1914, rev. 2008)
- Părinții Bisericii – Patrologia Graeca (PG), Migne
- OpenAI pentru GPT-4o
- NestJS & Angular teams

---

<div align="center">
<em>„La început era Cuvântul" – Ioan 1:1</em>
<br>
Made with ✝ for Orthodox Hermeneutics
</div>