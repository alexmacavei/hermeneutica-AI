# Ghid extracție Biblie Anania din PDF local

## De ce PDF local?

Biblia Anania (Bartolomeu Valeriu Anania) este protejată de drepturi de autor.
Proiectul **nu** include textul biblic în repository – utilizatorul trebuie să
descarce manual un exemplar PDF obținut legal.

Pipeline-ul de extracție:
1. Citește PDF-ul local (fără descărcare automată) folosind `pdfplumber` (Python).
2. Detectează layout-ul cu 2 coloane și zona de note de subsol pe fiecare pagină.
3. Extrage textul versetelor **curat** (fără superscript-uri) în format JSON.
4. Extrage notele/comentariile Anania și le atașează versetelor corespunzătoare.

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

### 3. Verifică că Python 3 este instalat

Scriptul necesită Python 3.8+. Verifică:
```bash
python3 --version
```

> **Nu** trebuie să instalezi manual `pdfplumber` sau alte pachete Python –
> comanda `npm run anania-extract` creează automat un *virtual environment*
> (`.venv/`) în directorul `scripts/` și instalează totul acolo.

---

## Cum rulezi extracția

### Varianta 1 (recomandată): cu `npm run`

Comanda creează automat un virtual environment Python, instalează dependințele
și rulează extracția. Nu trebuie să faci nimic manual cu `pip` sau `venv`:

```bash
cd scripts
npm run anania-extract
```

> Scriptul citește `ANANIA_PDF_PATH` din `.env`. Dacă variabila nu este setată,
> poți pasa calea explicit:
> ```bash
> npm run anania-extract -- /calea/către/Biblia-ANANIA.pdf
> ```

### Varianta 2: manual cu Python (avansat)

Dacă preferi să gestionezi singur environment-ul Python:

```bash
cd scripts
python3 -m venv .venv                 # creează virtual environment
source .venv/bin/activate             # activează-l (macOS/Linux)
pip install -r requirements.txt       # instalează pdfplumber + psycopg2
python3 anania_extract.py /calea/către/Biblia-ANANIA.pdf
```

Pipeline-ul va afișa progresul în consolă:

```
=== Anania Bible Extraction (pdfplumber) ===
PDF: /calea/către/Biblia-ANANIA.pdf (11.0 MB)
Total pages: 2163
  Processing page 1/2163...
  📖 Found book: Facerea (GEN)
  Processing page 100/2163...
  ...

Extracted 31102 total verses.
Linked 850 footnotes to verses.

Book   Chapters   Verses  Notes
--------------------------------
GEN          50     1533     42
EXO          40     1213     38
...

✅ Output written to: anania_output.json
   31102 verses, 850 footnotes
```

---

## Ce obții

### 1. Fișier JSON (`data/bibles/ro_anania.json`)

Format helloao-compatibil, identic cu celelalte biblii. Conține **doar** textul
versetelor – fără superscript-uri, fără note, fără prefixe.

Structura:
```json
{
  "translation": {
    "id": "ro_anania",
    "name": "Biblia Anania",
    "englishName": "Romanian Anania Bible",
    "language": "ro",
    "numberOfBooks": 73,
    "totalNumberOfChapters": 1189,
    "totalNumberOfVerses": 31102
  },
  "books": [
    {
      "id": "GEN",
      "name": "Facerea",
      "shortName": "Fac",
      "commonName": "Genesis",
      "order": 1,
      "numberOfChapters": 50,
      "totalNumberOfVerses": 1533,
      "isApocryphal": false,
      "chapters": [
        {
          "chapter": {
            "number": 1,
            "bookName": "Facerea",
            "content": [
              { "type": "verse", "number": 1, "content": ["La început a făcut Dumnezeu cerul și pământul."] }
            ]
          }
        }
      ]
    }
  ]
}
```

### 2. Note în baza de date (`anania_adnotari`)

Notele/comentariile extrase din zona de subsol sunt inserate direct în tabelul
PostgreSQL `anania_adnotari`. Pentru aceasta, trebuie să pasezi `--database-url`:

```bash
python3 anania_extract.py /calea/către/Biblia-ANANIA.pdf --database-url postgresql://user:pass@localhost:5432/db
```

Sau setează variabila de mediu `DATABASE_URL`:
```bash
export DATABASE_URL=postgresql://hermeneutica:hermeneutica_pass@localhost:5432/hermeneutica
python3 anania_extract.py /calea/către/Biblia-ANANIA.pdf
```

Structura tabelului:
| Coloană       | Tip        | Descriere                                      |
|---------------|------------|-------------------------------------------------|
| `id`          | SERIAL     | PK auto-increment                               |
| `book`        | VARCHAR    | Cod USFM (ex: GEN, MAT)                        |
| `chapter`     | INT        | Număr capitol                                   |
| `verse_start` | INT        | Număr verset                                    |
| `verse_end`   | INT / NULL | Verset final (pentru range)                     |
| `note_number` | INT        | Simbol notă (1, 2, 3…)                         |
| `note_text`   | TEXT       | Textul complet al notei                          |
| `metadata`    | JSONB      | `{ "attached_to_word": "..." }`                 |

Notele sunt afișate automat în frontend prin endpoint-ul
`GET /api/anania-notes?book=...&chapter=...&verse=...`.

### 3. Card "Note Anania" în frontend

Când analizezi un verset din Biblia Anania, cardul **"📝 Note Anania"** apare
automat sub cele 4 carduri de analiză hermeneutică – doar dacă există note
pentru acel verset. Fiecare notă afișează:
- Superscript-ul original (ex: ¹, ¹⁵)
- Indicația cuvântului asociat (ex: *(la „Cincizecimii")*)
- Textul complet al notei

---

## Depanare frecventă

### ❌ „ERROR: PDF not found at ..."

**Cauza**: Fișierul PDF nu există la calea specificată.

**Soluție**:
1. Verifică că ai descărcat PDF-ul de la https://dervent.ro/biblia/Biblia-ANANIA.pdf
2. Verifică calea pe care o pasezi scriptului: `python3 anania_extract.py /calea/corectă/Biblia-ANANIA.pdf`

### ❌ „No book headings were detected"

**Cauza**: PDF-ul nu conține titluri standard de cărți românești (Facerea, Ieșirea etc.).

**Soluție**: Asigură-te că folosești PDF-ul oficial de la Dervent. Alte ediții PDF
pot avea structură diferită.

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
