# Ghid extracție Biblie Anania din PDF local

## De ce PDF local?

Biblia Anania (Bartolomeu Valeriu Anania) este protejată de drepturi de autor.
Proiectul **nu** include textul biblic în repository – utilizatorul trebuie să
descarce manual un exemplar PDF obținut legal.

Pipeline-ul de extracție:
1. Citește PDF-ul local (fără descărcare automată).
2. Extrage textul versetelor **curat** (fără superscript-uri) în format helloao JSON.
3. Extrage notele/comentariile Anania (cu superscript fidel) și le stochează în baza de date PostgreSQL.

---

## Pași de pregătire

### 1. Descarcă PDF-ul

Descarcă de la:

```
https://dervent.ro/biblia/Biblia-ANANIA.pdf
```

Salvează fișierul oriunde pe disc (de exemplu: `~/Downloads/Biblia-ANANIA.pdf`).

### 2. Configurează calea în `.env`

Adaugă în fișierul `.env` din rădăcina proiectului:

```bash
# Calea completă către PDF-ul Bibliei Anania
ANANIA_PDF_PATH=/calea/către/Biblia-ANANIA.pdf
```

**Alternativ**: dacă nu setezi `ANANIA_PDF_PATH`, pipeline-ul va căuta automat
în `data/bibles/anania-source.pdf`. Poți copia PDF-ul direct acolo:

```bash
cp ~/Downloads/Biblia-ANANIA.pdf data/bibles/anania-source.pdf
```

### 3. Asigură-te că baza de date este pornită

Notele Anania sunt stocate în PostgreSQL. Asigură-te că `DATABASE_URL` este
setat corect în `.env` și că baza de date rulează:

```bash
# Pornește doar PostgreSQL cu Podman Compose
podman compose -f docker-compose.dev.yml up -d postgres
```

---

## Cum rulezi extracția

```bash
cd scripts
npm install          # prima dată sau după actualizări
npm run anania-pipeline
```

Pipeline-ul va afișa progresul în consolă:

```
=== Biblia Anania Pipeline (PDF source) ===

Reading PDF from: /calea/către/Biblia-ANANIA.pdf
PDF file size: 12.3 MB
Extracted 1250 pages, 4500000 characters of text.

Identified 73 book segment(s) in the PDF.

[GEN] Facerea
Detected superscript 1 attached to word 'începutul' on GEN 1:1
  ✓ 50 chapters, 1533 verses, 42 notes
[EXO] Ieșirea
  ✓ 40 chapters, 1213 verses, 38 notes
...

✅ JSON output complete.
   Written: data/bibles/ro_anania.json
   73 books, 1189 chapters, 31102 verses
   850 total annotation notes collected.

Inserting 850 Anania notes into database...
  ✓ Inserted 850 notes into anania_adnotari.

✅ Pipeline complete.
```

---

## Ce obții

### 1. Fișier JSON (`data/bibles/ro_anania.json`)

Format helloao-compatibil, identic cu celelalte biblii. Conține **doar** textul
versetelor – fără superscript-uri, fără note, fără prefixe.

Structura:
```json
{
  "id": "ro_anania",
  "name": "Biblia Anania",
  "books": [
    {
      "id": "GEN",
      "name": "Facerea",
      "chapters": [
        {
          "number": 1,
          "verses": [
            { "number": 1, "text": "La început a făcut Dumnezeu cerul și pământul." }
          ]
        }
      ]
    }
  ]
}
```

### 2. Tabelă PostgreSQL (`anania_adnotari`)

| Coloană | Tip | Descriere |
|---------|-----|-----------|
| `id` | SERIAL PK | Identificator unic |
| `book` | VARCHAR(10) | Cod USFM (ex: `GEN`, `ACT`) |
| `chapter` | INT | Număr capitol |
| `verse_start` | INT | Verset de început |
| `verse_end` | INT NULL | Verset de final (NULL = verset unic) |
| `note_number` | INT | Număr notă (1 pentru ¹, 15 pentru ¹⁵ etc.) |
| `note_text` | TEXT | Textul complet al notei |
| `metadata` | JSONB | `{ attached_to_word?, original_marker? }` |

### 3. Card "Note Anania" în frontend

Când analizezi un verset din Biblia Anania, cardul **"📝 Note Anania"** apare
automat sub cele 4 carduri de analiză hermeneutică – doar dacă există note
pentru acel verset. Fiecare notă afișează:
- Superscript-ul original (ex: ¹, ¹⁵)
- Indicația cuvântului asociat (ex: *(la „Cincizecimii")*)
- Textul complet al notei

---

## Depanare frecventă

### ❌ „Cannot read PDF file at: ..."

**Cauza**: Fișierul PDF nu există la calea specificată.

**Soluție**:
1. Verifică că ai descărcat PDF-ul de la https://dervent.ro/biblia/Biblia-ANANIA.pdf
2. Verifică calea din `.env`: `ANANIA_PDF_PATH=/calea/corectă/Biblia-ANANIA.pdf`
3. Sau copiază PDF-ul în `data/bibles/anania-source.pdf`

### ❌ „No book headings were detected"

**Cauza**: PDF-ul nu conține titluri standard de cărți românești (Facerea, Ieșirea etc.).

**Soluție**: Asigură-te că folosești PDF-ul oficial de la Dervent. Alte ediții PDF
pot avea structură diferită.

### ❌ „DATABASE_URL not set – skipping database insertion"

**Cauza**: Variabila `DATABASE_URL` nu e setată în `.env`.

**Soluție**: JSON-ul a fost generat corect, dar notele nu au fost salvate în baza
de date. Setează `DATABASE_URL` și rerulează pipeline-ul.

### Note cu text gol

Unele superscript-uri din textul versetului nu au o notă de subsol
corespunzătoare în PDF (pot fi referințe încrucișate sau erori OCR). Acestea
sunt salvate cu `note_text` gol.

---

## Actualizări viitoare

- **Îmbunătățirea parser-ului**: Pe măsură ce se identifică mai multe pattern-uri
  în PDF-uri de la ediții diferite, pattern-urile regex pot fi extinse.
- **Range de versete**: Detecția automată a expresiilor de tip „vezi nota de la
  v. 3" pentru a popula `verse_end`.
- **Embeddings RAG**: Într-o versiune viitoare, notele Anania ar putea fi indexate
  cu embeddings pentru căutare semantică (similar cu comentariile patristice).
