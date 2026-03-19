# 📜 Ghid de integrare corpus patristic (New Advent)

Acest ghid explică pas cu pas cum poți integra textele patristice de la **New Advent** în
aplicația AI Hermeneutica Orthodoxa, fără a fi nevoie să citești codul sursă.

---

## 1. Ce este corpusul patristic și ce NU include acest repo

Aplicația poate lucra cu texte ale Părinților Bisericii furnizate de
[New Advent – Church Fathers](https://www.newadvent.org/fathers/), dar **nu le distribuie**.

> **Repository-ul nu conține și nu va conține niciodată textele patristice în sine.**
> Utilizatorul este singurul responsabil pentru descărcarea acestor texte și pentru
> respectarea drepturilor de autor și a termenilor de utilizare ai sursei.

Codul de integrare din acest proiect oferă exclusiv **infrastructura tehnică** (parsare HTML,
creare chunks, generare embeddings, stocare în baza de date vectorială) necesară pentru
căutarea semantică în corpus.

---

## 2. De unde poți obține corpusul patristic

Sursa testată și recomandată este **New Advent – Church Fathers**:

- 🌐 Site: [https://www.newadvent.org/fathers/](https://www.newadvent.org/fathers/)
- 🛒 Achiziție arhivă offline: [https://newadvent.gumroad.com/l/na2](https://newadvent.gumroad.com/l/na2)

Arhiva conține scrierile Părinților Bisericii în format HTML, cu structura de directoare
specifică New Advent. **Aceasta este singura sursă testată cu scriptul de indexare.**

---

## 3. Cum pregătești fișierele pentru aplicație

### Pasul 1 – Descarcă arhiva

Achiziționează și descarcă arhiva New Advent pe calculatorul tău. Exemplu:

```
~/patristic-corpus/
```

### Pasul 2 – Dezarhivează

Dezarhivează conținutul în directorul ales. Structura creată de New Advent arată astfel:

```
~/patristic-corpus/fathers/
├── index.html          ← index principal cu toți autorii și operele
├── 0101.htm
├── 0102.htm
├── ...
├── 1001.htm
└── ...
```

Directorul va conține fișiere `.htm` numerotate și un `index.html` cu structura de navigare.

### Pasul 3 – Setează variabila de mediu

Adaugă calea către directorul `fathers/` (cel care conține `index.html`) în fișierul `.env`
din rădăcina proiectului:

```env
PATRISTIC_DATA_DIR=/Users/utilizator/patristic-corpus/fathers
```

> **Notă:** Calea trebuie să fie **absolută** și să indice exact directorul care conține
> `index.html` și fișierele `.htm`.

---

## 4. Cum rulezi indexarea

### Comanda de indexare

Rulează comanda de mai jos din **rădăcina proiectului** (nu din `backend/`):

```bash
cd backend && \
  DATABASE_URL=postgresql://<pg_user>:<pg_pass>@localhost:5432/hermeneutica \
  PATRISTIC_DATA_DIR=/Users/<utilizator>/patristic-corpus/fathers \
  OPENAI_API_KEY=sk-proj-... \
  npm run index:patristic
```

Înlocuiește:
- `<pg_user>` și `<pg_pass>` cu credențialele tale PostgreSQL
- `/Users/<utilizator>/patristic-corpus/fathers` cu calea reală
- `sk-proj-...` cu cheia ta OpenAI

### Ce face scriptul

1. **Scanează** recursiv directorul `PATRISTIC_DATA_DIR` după fișiere `.htm`
2. **Parsează** `index.html` pentru a mapa fiecare fișier la autor și operă
3. **Curăță** HTML-ul (elimină navigare, reclame, elemente de interfață)
4. **Împarte** textul în chunk-uri semantice de dimensiuni optime
5. **Generează embeddings** pentru fiecare chunk folosind OpenAI `text-embedding-3-small`
6. **Salvează** chunk-urile cu embeddings în tabelul `patristic_chunks` din baza de date PostgreSQL (pgvector)

> ⏱️ **Durată estimată:** 20–30 de minute, în funcție de dimensiunea arhivei și de viteza
> conexiunii la internet (API OpenAI).

### Actualizare autor/operă pentru chunk-uri necunoscute

În urma indexării, pot rămâne un număr mic de chunk-uri cu `author = 'unknown'` sau
`work = 'unknown'`. Aceasta se poate datora unor fișiere fără referințe în index sau unor
limitări de parsare.

Identifică-le și corectează-le manual cu interogări SQL similare cu exemplul de mai jos
(înlocuiește valorile cu cele reale din baza ta de date):

```sql
-- Identifică chunk-urile cu autor sau operă necunoscute
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

> **Important:** Valorile din exemplu (`The Apostolic Canons`, `Anonymous`, `3820`) sunt
> doar ilustrative. Verifică ce fișiere corespund capitolelor cu `unknown` înainte de a rula
> `UPDATE`.

---

## 5. Cum verifici că totul funcționează

1. Pornește aplicația:
   ```bash
   podman compose up
   ```

2. Deschide [http://localhost:4200](http://localhost:4200) în browser.

3. Navighează la un verset cunoscut, de exemplu **Ioan 3:16**.

4. Apasă butonul **Analizează**.

5. Verifică dacă cardul **„Comentarii Patristice"** afișează citate din Părinții Bisericii.

6. Dacă nu apar comentarii patristice:
   - Verifică că variabila `PATRISTIC_DATA_DIR` este setată corect și că baza de date este pornită.
   - Verifică că indexarea s-a finalizat fără erori (loggurile scriptului `index:patristic`).
   - Verifică că tabelul `patristic_chunks` nu este gol:
     ```sql
     SELECT count(*) FROM patristic_chunks;
     ```
   - Asigură-te că variabila `DATABASE_URL` din `.env` este corectă și că aplicația backend poate conecta la baza de date.

---

## 6. Disclaimer legal / Copyright

> **Repository-ul AI Hermeneutica Orthodoxa nu oferă, nu distribuie și nu include textele
> patristice din New Advent sau orice altă sursă.**
>
> Utilizatorul este singurul responsabil pentru:
> - Achiziționarea sau descărcarea textelor patristice
> - Respectarea drepturilor de autor și a termenilor de utilizare ai sursei (New Advent)
> - Utilizarea textelor exclusiv în scopuri personale, de cercetare sau educaționale, conform
>   licenței sursei
>
> Proiectul oferă **exclusiv infrastructura tehnică** (cod open-source sub licența MIT)
> pentru procesarea și căutarea în texte patristice pe care utilizatorul le deține legal.
>
> Autorii proiectului nu sunt responsabili pentru utilizarea neconformă a textelor patristice.
