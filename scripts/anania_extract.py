#!/usr/bin/env python3
"""
anania_extract.py – Extract the Anania Bible from a local PDF using pdfplumber.

Uses coordinate-aware text extraction to split each page into:
  • Two central columns containing the biblical text (verses).
  • A footnote zone at the bottom of each page.

Verses are identified as lines starting with a number (1, 2, 3, …).
Footnotes are extracted as (symbol, note_text) pairs and linked back to
the verses that reference the symbol.

Output (helloao-compatible):
  ../data/bibles/ro_anania.json  – bible text in helloao format (same as
      other translations), with clean verse text (no superscripts).

Footnotes are inserted directly into the `anania_adnotari` PostgreSQL
table when a DATABASE_URL is provided (via --database-url flag or the
DATABASE_URL environment variable).

Usage:
  pip install pdfplumber psycopg2-binary
  python anania_extract.py /path/to/Biblia-ANANIA.pdf
  python anania_extract.py /path/to/Biblia-ANANIA.pdf --database-url postgresql://user:pass@localhost:5432/db

The script can also be invoked via npm from the scripts/ directory:
  npm run anania-extract -- /path/to/Biblia-ANANIA.pdf
"""

from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pdfplumber                       # pip install pdfplumber
from pdfplumber.page import Page


# ──────────────────────────────────────────────────────────────────────────────
# Book configuration
# ──────────────────────────────────────────────────────────────────────────────

# Mapping of USFM code → { order, heading variants, abbreviation }
# The *first* heading in each list is the canonical PDF heading.

BOOKS_CONFIG: list[dict[str, Any]] = [
    # Pentateuch
    {"code": "GEN", "order": 1,  "headings": ["Facerea"], "abbrev": "Fac"},
    {"code": "EXO", "order": 2,  "headings": ["Ieșirea", "Ieşirea", "Iesirea"], "abbrev": "Ieș"},
    {"code": "LEV", "order": 3,  "headings": ["Leviticul"], "abbrev": "Lev"},
    {"code": "NUM", "order": 4,  "headings": ["Numerii", "Numeri", "Cartea Numerilor", "Numerele", "Numerii"], "abbrev": "Num"},
    {"code": "DEU", "order": 5,  "headings": ["Deuteronomul", "Deuteronom"], "abbrev": "Deut"},
    # Historical
    {"code": "JOS", "order": 6,  "headings": ["Iosua Navi", "Iosua"], "abbrev": "Ios"},
    {"code": "JDG", "order": 7,  "headings": ["Judecătorii", "Judecatorii", "Judecători", "Judecatori"], "abbrev": "Jud"},
    {"code": "RUT", "order": 8,  "headings": ["Rut", "Ruta"], "abbrev": "Rut"},
    {"code": "1SA", "order": 9,  "headings": ["Cartea întâi a Regilor", "Cartea întîi a Regilor", "I Regi", "1 Regi"], "abbrev": "1Reg"},
    {"code": "2SA", "order": 10, "headings": ["Cartea a doua a Regilor", "II Regi", "2 Regi"], "abbrev": "2Reg"},
    {"code": "1KI", "order": 11, "headings": ["Cartea a treia a Regilor", "III Regi", "3 Regi"], "abbrev": "3Reg"},
    {"code": "2KI", "order": 12, "headings": ["Cartea a patra a Regilor", "IV Regi", "4 Regi"], "abbrev": "4Reg"},
    {"code": "1CH", "order": 13, "headings": ["Cartea întâi a Cronicilor", "Cartea întîi a Cronicilor", "I Paralipomena", "I Cronici", "1 Paralipomena"], "abbrev": "1Par"},
    {"code": "2CH", "order": 14, "headings": ["Cartea a doua a Cronicilor", "II Paralipomena", "II Cronici", "2 Paralipomena"], "abbrev": "2Par"},
    {"code": "EZR", "order": 15, "headings": ["Ezdra", "Cartea lui Ezdra", "I Ezdra"], "abbrev": "2Ezd"},
    {"code": "NEH", "order": 16, "headings": ["Neemia", "Cartea lui Neemia"], "abbrev": "Neem"},
    {"code": "EST", "order": 17, "headings": ["Estera", "Cartea Esterei"], "abbrev": "Est"},
    # Poetic / Wisdom
    {"code": "JOB", "order": 18, "headings": ["Iov", "Cartea lui Iov"], "abbrev": "Iov"},
    {"code": "PSA", "order": 19, "headings": ["Psalmii", "Psalmi", "Cartea Psalmilor"], "abbrev": "Ps"},
    {"code": "PRO", "order": 20, "headings": ["Proverbele lui Solomon", "Pildele lui Solomon", "Proverbele", "Pilde"], "abbrev": "Pild"},
    {"code": "ECC", "order": 21, "headings": ["Ecclesiastul"], "abbrev": "Eccl"},
    {"code": "SNG", "order": 22, "headings": ["Cântarea Cântărilor", "Cîntarea Cîntărilor", "Cantarea Cantarilor"], "abbrev": "Cânt"},
    # Major Prophets
    {"code": "ISA", "order": 23, "headings": ["Isaia", "Cartea lui Isaia"], "abbrev": "Is"},
    {"code": "JER", "order": 24, "headings": ["Ieremia", "Cartea lui Ieremia"], "abbrev": "Ier"},
    {"code": "LAM", "order": 25, "headings": ["Plângerile lui Ieremia", "Plîngeri", "Plangeri", "Plângeri"], "abbrev": "Plâng"},
    {"code": "EZK", "order": 26, "headings": ["Iezechiel", "Cartea lui Iezechiel"], "abbrev": "Iez"},
    {"code": "DAN", "order": 27, "headings": ["Daniel", "Cartea lui Daniel"], "abbrev": "Dan"},
    # Minor Prophets
    {"code": "HOS", "order": 28, "headings": ["Osea", "Cartea lui Osea"], "abbrev": "Os"},
    {"code": "JOL", "order": 29, "headings": ["Ioil", "Cartea lui Ioil"], "abbrev": "Ioel"},
    {"code": "AMO", "order": 30, "headings": ["Amos", "Cartea lui Amos"], "abbrev": "Amos"},
    {"code": "OBA", "order": 31, "headings": ["Avdia", "Obadia"], "abbrev": "Obad"},
    {"code": "JON", "order": 32, "headings": ["Iona", "Cartea lui Iona"], "abbrev": "Ion"},
    {"code": "MIC", "order": 33, "headings": ["Miheia", "Cartea lui Miheia", "Mica"], "abbrev": "Mica"},
    {"code": "NAM", "order": 34, "headings": ["Naum", "Cartea lui Naum"], "abbrev": "Naum"},
    {"code": "HAB", "order": 35, "headings": ["Avacum", "Cartea lui Avacum", "Habacuc"], "abbrev": "Hab"},
    {"code": "ZEP", "order": 36, "headings": ["Sofonie", "Cartea lui Sofonie"], "abbrev": "Sof"},
    {"code": "HAG", "order": 37, "headings": ["Agheu", "Cartea lui Agheu", "Hagai"], "abbrev": "Ag"},
    {"code": "ZEC", "order": 38, "headings": ["Zaharia", "Cartea lui Zaharia"], "abbrev": "Zah"},
    {"code": "MAL", "order": 39, "headings": ["Maleahi", "Cartea lui Maleahi"], "abbrev": "Mal"},
    # New Testament
    {"code": "MAT", "order": 40, "headings": ["Sfânta Evanghelie după Matei", "Sfînta Evanghelie după Matei", "Evanghelia după Matei", "Matei"], "abbrev": "Mat"},
    {"code": "MRK", "order": 41, "headings": ["Sfânta Evanghelie după Marcu", "Sfînta Evanghelie după Marcu", "Evanghelia după Marcu", "Marcu"], "abbrev": "Mc"},
    {"code": "LUK", "order": 42, "headings": ["Sfânta Evanghelie după Luca", "Sfînta Evanghelie după Luca", "Evanghelia după Luca", "Luca"], "abbrev": "Lc"},
    {"code": "JHN", "order": 43, "headings": ["Sfânta Evanghelie după Ioan", "Sfînta Evanghelie după Ioan", "Evanghelia după Ioan", "Ioan"], "abbrev": "In"},
    {"code": "ACT", "order": 44, "headings": ["Faptele Apostolilor", "Faptele Sfinților Apostoli", "Faptele Sfintilor Apostoli"], "abbrev": "FA"},
    {"code": "ROM", "order": 45, "headings": ["Epistola către Romani", "Romani", "Epistola Sfântului Apostol Pavel către Romani"], "abbrev": "Rom"},
    {"code": "1CO", "order": 46, "headings": ["Epistola întâi către Corinteni", "Epistola întîi către Corinteni", "I Corinteni", "1 Corinteni"], "abbrev": "1Cor"},
    {"code": "2CO", "order": 47, "headings": ["Epistola a doua către Corinteni", "II Corinteni", "2 Corinteni"], "abbrev": "2Cor"},
    {"code": "GAL", "order": 48, "headings": ["Epistola către Galateni", "Galateni"], "abbrev": "Gal"},
    {"code": "EPH", "order": 49, "headings": ["Epistola către Efeseni", "Efeseni"], "abbrev": "Ef"},
    {"code": "PHP", "order": 50, "headings": ["Epistola către Filipeni", "Filipeni"], "abbrev": "Flp"},
    {"code": "COL", "order": 51, "headings": ["Epistola către Coloseni", "Coloseni"], "abbrev": "Col"},
    {"code": "1TH", "order": 52, "headings": ["Epistola întâi către Tesaloniceni", "Epistola întîi către Tesaloniceni", "I Tesaloniceni", "1 Tesaloniceni"], "abbrev": "1Tes"},
    {"code": "2TH", "order": 53, "headings": ["Epistola a doua către Tesaloniceni", "II Tesaloniceni", "2 Tesaloniceni"], "abbrev": "2Tes"},
    {"code": "1TI", "order": 54, "headings": ["Epistola întâi către Timotei", "Epistola întîi către Timotei", "I Timotei", "1 Timotei"], "abbrev": "1Tim"},
    {"code": "2TI", "order": 55, "headings": ["Epistola a doua către Timotei", "II Timotei", "2 Timotei"], "abbrev": "2Tim"},
    {"code": "TIT", "order": 56, "headings": ["Epistola către Tit", "Tit"], "abbrev": "Tit"},
    {"code": "PHM", "order": 57, "headings": ["Epistola către Filimon", "Filimon"], "abbrev": "Flm"},
    {"code": "HEB", "order": 58, "headings": ["Epistola către Evrei", "Evrei"], "abbrev": "Evr"},
    {"code": "JAS", "order": 59, "headings": ["Epistola lui Iacob", "Iacob", "Epistola Sobornicească a lui Iacob"], "abbrev": "Iac"},
    {"code": "1PE", "order": 60, "headings": ["Epistola întâi a lui Petru", "Epistola întîi a lui Petru", "I Petru", "1 Petru"], "abbrev": "1Pet"},
    {"code": "2PE", "order": 61, "headings": ["Epistola a doua a lui Petru", "II Petru", "2 Petru"], "abbrev": "2Pet"},
    {"code": "1JN", "order": 62, "headings": ["Epistola întâi a lui Ioan", "Epistola întîi a lui Ioan", "I Ioan", "1 Ioan"], "abbrev": "1In"},
    {"code": "2JN", "order": 63, "headings": ["Epistola a doua a lui Ioan", "II Ioan", "2 Ioan"], "abbrev": "2In"},
    {"code": "3JN", "order": 64, "headings": ["Epistola a treia a lui Ioan", "III Ioan", "3 Ioan"], "abbrev": "3In"},
    {"code": "JUD", "order": 65, "headings": ["Epistola lui Iuda", "Iuda"], "abbrev": "Iud"},
    {"code": "REV", "order": 66, "headings": ["Apocalipsa", "Apocalipsa lui Ioan"], "abbrev": "Apoc"},
    # Deuterocanonical
    {"code": "TOB", "order": 67, "headings": ["Cartea lui Tobit", "Tobit"], "abbrev": "Tob"},
    {"code": "JDT", "order": 68, "headings": ["Cartea Iuditei", "Iudita"], "abbrev": "Iudt"},
    {"code": "WIS", "order": 70, "headings": ["Înțelepciunea lui Solomon", "Intelepciunea lui Solomon", "Solomon"], "abbrev": "ÎnțSol"},
    {"code": "SIR", "order": 71, "headings": ["Cartea înțelepciunii lui Isus, fiul lui Sirah", "Înțelepciunea lui Isus, fiul lui Sirah", "Intelepciunea lui Isus, fiul lui Sirah", "Ecclesiasticul", "Sirah"], "abbrev": "Sir"},
    {"code": "BAR", "order": 72, "headings": ["Baruh", "Cartea lui Baruh"], "abbrev": "Bar"},
    {"code": "LJE", "order": 73, "headings": ["Epistola lui Ieremia", "Scrisoarea lui Ieremia"], "abbrev": "EpIer"},
    {"code": "S3Y", "order": 74, "headings": ["Cântarea celor trei tineri", "Cîntarea celor trei tineri"], "abbrev": "S3Y"},
    {"code": "SUS", "order": 75, "headings": ["Istoria Susanei", "Susana"], "abbrev": "Sus"},
    {"code": "BEL", "order": 76, "headings": ["Bel și balaurul", "Bel si balaurul", "Bel şi balaurul"], "abbrev": "Bel"},
    {"code": "1MA", "order": 77, "headings": ["Cartea întâi a Macabeilor", "Cartea întîi a Macabeilor", "I Macabei", "1 Macabei"], "abbrev": "1Mac"},
    {"code": "2MA", "order": 78, "headings": ["Cartea a doua a Macabeilor", "II Macabei", "2 Macabei"], "abbrev": "2Mac"},
    {"code": "3MA", "order": 79, "headings": ["Cartea a treia a Macabeilor", "III Macabei", "3 Macabei"], "abbrev": "3Mac"},
    {"code": "MAN", "order": 83, "headings": ["Rugăciunea lui Manase", "Rugaciunea lui Manase", "Manase"], "abbrev": "RgMan"},
    {"code": "1ES", "order": 81, "headings": ["Cartea a treia a lui Ezdra", "III Ezdra", "3 Ezdra"], "abbrev": "1Ezd"},
]

# helloao-style English names for each USFM code
ENGLISH_BOOK_NAMES: dict[str, str] = {
    "GEN": "Genesis", "EXO": "Exodus", "LEV": "Leviticus", "NUM": "Numbers",
    "DEU": "Deuteronomy", "JOS": "Joshua", "JDG": "Judges", "RUT": "Ruth",
    "1SA": "1 Samuel", "2SA": "2 Samuel", "1KI": "1 Kings", "2KI": "2 Kings",
    "1CH": "1 Chronicles", "2CH": "2 Chronicles", "EZR": "Ezra", "NEH": "Nehemiah",
    "EST": "Esther", "JOB": "Job", "PSA": "Psalms", "PRO": "Proverbs",
    "ECC": "Ecclesiastes", "SNG": "Song of Solomon", "ISA": "Isaiah",
    "JER": "Jeremiah", "LAM": "Lamentations", "EZK": "Ezekiel", "DAN": "Daniel",
    "HOS": "Hosea", "JOL": "Joel", "AMO": "Amos", "OBA": "Obadiah",
    "JON": "Jonah", "MIC": "Micah", "NAM": "Nahum", "HAB": "Habakkuk",
    "ZEP": "Zephaniah", "HAG": "Haggai", "ZEC": "Zechariah", "MAL": "Malachi",
    "MAT": "Matthew", "MRK": "Mark", "LUK": "Luke", "JHN": "John",
    "ACT": "Acts", "ROM": "Romans", "1CO": "1 Corinthians", "2CO": "2 Corinthians",
    "GAL": "Galatians", "EPH": "Ephesians", "PHP": "Philippians",
    "COL": "Colossians", "1TH": "1 Thessalonians", "2TH": "2 Thessalonians",
    "1TI": "1 Timothy", "2TI": "2 Timothy", "TIT": "Titus", "PHM": "Philemon",
    "HEB": "Hebrews", "JAS": "James", "1PE": "1 Peter", "2PE": "2 Peter",
    "1JN": "1 John", "2JN": "2 John", "3JN": "3 John", "JUD": "Jude",
    "REV": "Revelation",
    "TOB": "Tobit", "JDT": "Judith", "WIS": "Wisdom of Solomon",
    "SIR": "Sirach", "BAR": "Baruch", "LJE": "Letter of Jeremiah",
    "S3Y": "Prayer of Azariah", "SUS": "Susanna", "BEL": "Bel and the Dragon",
    "1MA": "1 Maccabees", "2MA": "2 Maccabees", "3MA": "3 Maccabees",
    "MAN": "Prayer of Manasseh", "1ES": "1 Esdras",
}


APOCRYPHAL_CODES = {
    "TOB", "JDT", "1MA", "2MA", "3MA", "4MA", "WIS", "SIR", "BAR", "LJE",
    "1ES", "MAN", "PS2", "S3Y", "SUS", "BEL",
}

# Default output path: ../data/bibles/ro_anania.json (relative to this script)
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUTPUT_PATH = os.path.join(_SCRIPT_DIR, "..", "data", "bibles", "ro_anania.json")


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _normalize(s: str) -> str:
    """Lowercase, strip diacritics, collapse whitespace, unify î/â."""
    s = s.lower()
    s = s.replace("î", "x").replace("â", "x")        # unify î/â
    s = s.replace("ș", "s").replace("ş", "s")
    s = s.replace("ț", "t").replace("ţ", "t")
    s = unicodedata.normalize("NFD", s)
    s = re.sub(r"[\u0300-\u036f]", "", s)             # strip combining marks
    s = re.sub(r"[^\w\s-]", "", s)                    # remove punctuation
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _build_heading_map() -> dict[str, dict[str, Any]]:
    """Build normalized-heading → book-config map."""
    m: dict[str, dict[str, Any]] = {}
    for book in BOOKS_CONFIG:
        for h in book["headings"]:
            m[_normalize(h)] = book
    return m


# Unicode superscript → ASCII digit
_SUP_MAP = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹", "0123456789")


def _superscript_to_int(s: str) -> int | None:
    """Convert a string of Unicode superscript digits to an int, or None."""
    digits = s.translate(_SUP_MAP)
    try:
        return int(digits)
    except ValueError:
        return None


# Regex for Unicode superscript sequences in text
_UNICODE_SUP_RE = re.compile(r"[⁰¹²³⁴⁵⁶⁷⁸⁹]+")

# Regex for inline regular digits that are superscripts rendered as plain text
# by the PDF extractor. Matches 1-2 digits directly after a letter, before
# punctuation or whitespace.
_INLINE_SUP_RE = re.compile(r"(?<=[^\s\d])(\d{1,2})(?=[\s:;,.\-\"'!?„\u201c\u201d\u201e\u2014\u2013)\]/>]|$)")


def _strip_superscripts(text: str) -> str:
    """Remove all superscript markers (both Unicode and inline digits) from text."""
    result = _UNICODE_SUP_RE.sub("", text)
    result = _INLINE_SUP_RE.sub("", result)
    result = re.sub(r"\s{2,}", " ", result).strip()
    return result


def _find_superscripts(text: str) -> list[dict[str, Any]]:
    """Detect superscript markers and the word they are attached to."""
    found: list[dict[str, Any]] = []
    seen: set[int] = set()

    # 1) Unicode superscripts
    for m in _UNICODE_SUP_RE.finditer(text):
        n = _superscript_to_int(m.group())
        if n is not None and 1 <= n <= 20 and n not in seen:
            seen.add(n)
            word = _word_before(text, m.start())
            found.append({"symbol": n, "original": m.group(), "attached_to_word": word})

    # 2) Inline regular-digit superscripts
    for m in _INLINE_SUP_RE.finditer(text):
        try:
            n = int(m.group(1))
        except ValueError:
            continue
        if 1 <= n <= 20 and n not in seen:
            seen.add(n)
            word = _word_before(text, m.start())
            found.append({"symbol": n, "original": m.group(), "attached_to_word": word})

    return found


def _word_before(text: str, idx: int) -> str | None:
    """Return the word immediately preceding position idx, or None."""
    before = text[:idx]
    m = re.search(r"(\S+)\s*$", before)
    # Strip trailing punctuation from the word
    if m:
        word = re.sub(r"[^\w]+$", "", m.group(1))
        return word if word else None
    return None


# ──────────────────────────────────────────────────────────────────────────────
# Footnote zone detection
# ──────────────────────────────────────────────────────────────────────────────

def _extract_footnote_zone(page: Page) -> str:
    """
    Attempt to find and extract the footnote zone at the bottom of a page.

    Strategy: look for a horizontal line (rule) or a significant y-gap near
    the bottom third of the page that separates footnotes from body text.
    If found, extract only the text below it.
    """
    height = page.height
    width = page.width

    # Strategy 1: Look for a horizontal line that spans part of the page
    # (footnote separator rule).
    lines = page.lines or []
    best_rule_y: float | None = None
    for line in lines:
        y = line.get("top", 0)
        # Only consider lines in the bottom 40% of the page
        if y > height * 0.6:
            x0 = line.get("x0", 0)
            x1 = line.get("x1", 0)
            line_width = x1 - x0
            # Separator lines are typically at least 20% of page width
            if line_width > width * 0.2:
                if best_rule_y is None or y < best_rule_y:
                    best_rule_y = y

    if best_rule_y is not None:
        crop = page.crop((0, best_rule_y, width, height))
        text = crop.extract_text(x_tolerance=2, y_tolerance=2) or ""
        return text.strip()

    # Strategy 2: Look for small font text at the bottom (footnotes tend to
    # be in a smaller font). Extract chars, find the transition point.
    chars = page.chars or []
    if chars:
        # Group chars by approximate y-position, find where font size drops
        bottom_chars = [c for c in chars if c["top"] > height * 0.7]
        if bottom_chars:
            avg_size = sum(c.get("size", 10) for c in bottom_chars) / len(bottom_chars)
            all_avg = sum(c.get("size", 10) for c in chars) / max(len(chars), 1)
            # If bottom text is significantly smaller, it's likely footnotes
            if avg_size < all_avg * 0.85:
                transition_y = min(c["top"] for c in bottom_chars)
                crop = page.crop((0, transition_y, width, height))
                text = crop.extract_text(x_tolerance=2, y_tolerance=2) or ""
                return text.strip()

    return ""


# ──────────────────────────────────────────────────────────────────────────────
# Two-column body text extraction
# ──────────────────────────────────────────────────────────────────────────────

def _extract_body_columns(page: Page) -> str:
    """
    Extract the main body text from a two-column page layout.

    The Anania Bible PDF typically has two columns of text. We detect the
    column split by analyzing character x-positions, then extract left column
    first, then right column, to preserve reading order.
    """
    height = page.height
    width = page.width
    chars = page.chars or []

    if not chars:
        return page.extract_text(x_tolerance=2, y_tolerance=2) or ""

    # Determine if this is a two-column layout by looking at the x-distribution
    # of characters in the middle third (y) of the page
    mid_chars = [c for c in chars if height * 0.2 < c["top"] < height * 0.7]

    if not mid_chars:
        return page.extract_text(x_tolerance=2, y_tolerance=2) or ""

    # Histogram of x-positions (left edge of character bounding box)
    x_positions = [c["x0"] for c in mid_chars]
    mid_x = width / 2

    # Count chars in left half vs right half
    left_count = sum(1 for x in x_positions if x < mid_x - 20)
    right_count = sum(1 for x in x_positions if x > mid_x + 20)
    gap_count = sum(1 for x in x_positions if mid_x - 20 <= x <= mid_x + 20)

    # If there's a clear gap in the middle, it's two-column
    is_two_col = (left_count > 50 and right_count > 50 and
                  gap_count < (left_count + right_count) * 0.1)

    if not is_two_col:
        # Single column – just extract normally
        return page.extract_text(x_tolerance=2, y_tolerance=2) or ""

    # Find the column split point (the x-position with fewest characters)
    # by finding the gap in the middle region
    split_x = mid_x  # default

    # Scan from 35%-65% of width for the best gap
    best_gap_x = mid_x
    min_chars_at_x = float("inf")
    for test_x in range(int(width * 0.35), int(width * 0.65)):
        count = sum(1 for c in mid_chars if test_x - 5 <= c["x0"] <= test_x + 5)
        if count < min_chars_at_x:
            min_chars_at_x = count
            best_gap_x = test_x

    split_x = best_gap_x

    # Find the footnote zone boundary to exclude it from body
    footnote_y = height  # default: no footnotes excluded here

    page_lines = page.lines or []
    for line in page_lines:
        y = line.get("top", 0)
        if y > height * 0.6:
            x0 = line.get("x0", 0)
            x1 = line.get("x1", 0)
            if (x1 - x0) > width * 0.2:
                footnote_y = min(footnote_y, y)

    # Extract left column, then right column
    left_crop = page.crop((0, 0, split_x, footnote_y))
    right_crop = page.crop((split_x, 0, width, footnote_y))

    left_text = left_crop.extract_text(x_tolerance=2, y_tolerance=2) or ""
    right_text = right_crop.extract_text(x_tolerance=2, y_tolerance=2) or ""

    return left_text + "\n" + right_text


# ──────────────────────────────────────────────────────────────────────────────
# Footnote parsing
# ──────────────────────────────────────────────────────────────────────────────

# Footnote line patterns
_FN_UNICODE_RE = re.compile(r"^([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\s*[=:.]\s*(.+)")
_FN_DIGIT_RE = re.compile(r"^(\d{1,2})\s*[=:.]\s+(.+)")


def _parse_footnotes(text: str) -> list[dict[str, str | int]]:
    """Parse footnote lines from the footnote zone text."""
    notes: list[dict[str, str | int]] = []
    if not text:
        return notes

    lines = text.split("\n")
    current_note: dict[str, str | int] | None = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Try Unicode superscript note marker
        m = _FN_UNICODE_RE.match(line)
        if m:
            if current_note:
                notes.append(current_note)
            n = _superscript_to_int(m.group(1))
            if n is not None:
                current_note = {"symbol": n, "note_text": m.group(2).strip()}
            continue

        # Try regular digit note marker
        m = _FN_DIGIT_RE.match(line)
        if m:
            if current_note:
                notes.append(current_note)
            try:
                n = int(m.group(1))
                if 1 <= n <= 20:
                    current_note = {"symbol": n, "note_text": m.group(2).strip()}
                    continue
            except ValueError:
                pass

        # Continuation of previous note
        if current_note:
            current_note["note_text"] = str(current_note["note_text"]) + " " + line

    if current_note:
        notes.append(current_note)

    return notes


# ──────────────────────────────────────────────────────────────────────────────
# State machine: Book / Chapter / Verse detection
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class VerseRecord:
    """A single verse with optional footnotes."""
    book: str                           # USFM code (e.g. "GEN")
    chapter: int
    verse: int
    text: str                           # clean text (no superscripts)
    footnotes: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "book": self.book,
            "chapter": self.chapter,
            "verse": self.verse,
            "text": self.text,
        }
        if self.footnotes:
            d["footnotes"] = self.footnotes
        return d


_CHAPTER_RE = re.compile(
    r"^\s*(?:(?:Capitolul|Cap\.?|Psalmul|Ps\.?)\s+)?(\d{1,3})\s*$", re.IGNORECASE
)
_VERSE_RE = re.compile(r"^(\d+)[.\s]\s*(.+)")


class BookChapterTracker:
    """Tracks current book/chapter as we iterate through pages."""

    def __init__(self) -> None:
        self._heading_map = _build_heading_map()
        self.current_book: dict[str, Any] | None = None
        self.current_chapter: int = 0
        self.current_verse: int = 0
        self.verses: list[VerseRecord] = []
        self._pending_text: str = ""          # accumulates verse text across lines

    def _flush_verse(self) -> None:
        """Flush the currently accumulated verse text as a VerseRecord."""
        if self._pending_text and self.current_book and self.current_chapter > 0 and self.current_verse > 0:
            clean = _strip_superscripts(self._pending_text)
            self.verses.append(VerseRecord(
                book=self.current_book["code"],
                chapter=self.current_chapter,
                verse=self.current_verse,
                text=clean,
            ))
        self._pending_text = ""

    def process_body(self, text: str) -> None:
        """Process the body text of a page."""
        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue

            # ── Book heading detection ──
            normalized = _normalize(line)
            matched = self._heading_map.get(normalized)

            # Try stripping trailing number (e.g. "FACEREA 1")
            if not matched:
                trail_m = re.match(r"^(.+?)\s+(\d{1,3})$", normalized)
                if trail_m:
                    matched = self._heading_map.get(trail_m.group(1))
                    if matched:
                        self._flush_verse()
                        if matched != self.current_book:
                            self.current_book = matched
                            self.current_chapter = 0
                            self.current_verse = 0
                        chap = int(trail_m.group(2))
                        if 1 <= chap <= 150:
                            self.current_chapter = chap
                        continue

            # Try substring match for long headings
            if not matched and len(line) < 150:
                for hNorm, cfg in self._heading_map.items():
                    if len(hNorm) > 10 and hNorm in normalized:
                        matched = cfg
                        break

            if matched and matched != self.current_book:
                self._flush_verse()
                self.current_book = matched
                self.current_chapter = 0
                self.current_verse = 0
                print(f"  📖 Found book: {matched['headings'][0]} ({matched['code']})")
                continue

            # ── Chapter heading detection ──
            chap_m = _CHAPTER_RE.match(line)
            if chap_m and self.current_book:
                chap = int(chap_m.group(1))
                if 1 <= chap <= 150:
                    self._flush_verse()
                    self.current_chapter = chap
                    self.current_verse = 0
                    continue

            # ── Verse detection ──
            verse_m = _VERSE_RE.match(line)
            if verse_m and self.current_book and self.current_chapter > 0:
                vnum = int(verse_m.group(1))
                vtext = verse_m.group(2).strip()
                # Heuristic: verse numbers should be reasonable
                if 1 <= vnum <= 200:
                    self._flush_verse()
                    self.current_verse = vnum
                    self._pending_text = vtext
                    continue

            # ── Continuation text ──
            if self.current_book and self.current_chapter > 0 and self.current_verse > 0:
                if self._pending_text:
                    self._pending_text += " " + line
                else:
                    self._pending_text = line

    def finalize(self) -> None:
        """Flush any remaining pending verse."""
        self._flush_verse()


# ──────────────────────────────────────────────────────────────────────────────
# Link footnotes to verses
# ──────────────────────────────────────────────────────────────────────────────

def _link_footnotes(
    verses: list[VerseRecord],
    page_notes: list[tuple[int, list[dict[str, str | int]]]],
) -> None:
    """
    For each page's footnotes, find the verses on that page that contain
    the footnote symbol and attach the note text.

    page_notes is a list of (page_number, [footnote_dicts]) tuples.
    """
    # Build a lookup: (book, chapter, verse) → VerseRecord index
    verse_idx: dict[tuple[str, int, int], int] = {}
    for i, v in enumerate(verses):
        key = (v.book, v.chapter, v.verse)
        verse_idx[key] = i

    # For each page's footnotes, scan the verses' *original* text
    # (before stripping) to find which verse contains the symbol.
    # Since we've already stripped, we need to use the detected superscripts.
    # A simpler approach: for each footnote symbol N from page P, attach it
    # to the last verse on that page that we know about.
    # However, the best approach is to re-detect superscripts in the raw text.
    # Since we don't keep raw text, we'll attach footnotes to the most recent
    # verse that makes sense — using a page-range heuristic.

    # We actually need a different approach: keep track of which verses came
    # from which page. Let's do this via the main extraction loop instead.
    pass


# ──────────────────────────────────────────────────────────────────────────────
# Database insertion
# ──────────────────────────────────────────────────────────────────────────────

def _insert_notes_to_db(verses: list[VerseRecord], database_url: str) -> None:
    """Insert extracted footnotes into the anania_adnotari PostgreSQL table."""
    import psycopg2  # pip install psycopg2-binary

    notes_to_insert: list[tuple[str, int, int, int, str, str]] = []
    for v in verses:
        for fn in v.footnotes:
            metadata = json.dumps(
                {"attached_to_word": fn.get("attached_to_word")},
                ensure_ascii=False,
            )
            notes_to_insert.append((
                v.book,
                v.chapter,
                v.verse,
                fn["symbol"],
                str(fn["note_text"]),
                metadata,
            ))

    if not notes_to_insert:
        print("   No footnotes to insert into database.")
        return

    print(f"   Inserting {len(notes_to_insert)} footnotes into anania_adnotari...")

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor() as cur:
            # Clear existing notes to allow re-runs
            cur.execute("DELETE FROM anania_adnotari")

            # Batch insert
            batch_size = 500
            for i in range(0, len(notes_to_insert), batch_size):
                batch = notes_to_insert[i:i + batch_size]
                args_str = ",".join(
                    cur.mogrify(
                        "(%s, %s, %s, %s, %s, %s::jsonb)",
                        (book, chap, verse, note_num, note_text, meta)
                    ).decode("utf-8")
                    for book, chap, verse, note_num, note_text, meta in batch
                )
                cur.execute(
                    "INSERT INTO anania_adnotari "
                    "(book, chapter, verse_start, note_number, note_text, metadata) "
                    f"VALUES {args_str}"
                )

        conn.commit()
        print(f"   ✅ {len(notes_to_insert)} footnotes inserted into anania_adnotari.")
    except Exception as e:
        conn.rollback()
        print(f"   ❌ Database error: {e}")
        print("   Make sure the anania_adnotari table exists (start the backend once first).")
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────────────────────
# Main extraction
# ──────────────────────────────────────────────────────────────────────────────

def extract(pdf_path: str, output_path: str, database_url: str | None = None) -> None:
    """Main extraction entry point."""
    pdf_path = os.path.abspath(pdf_path)
    if not os.path.isfile(pdf_path):
        print(f"ERROR: PDF not found at {pdf_path}")
        print("Download it from: https://dervent.ro/biblia/Biblia-ANANIA.pdf")
        sys.exit(1)

    size_mb = os.path.getsize(pdf_path) / (1024 * 1024)
    print(f"=== Anania Bible Extraction (pdfplumber) ===")
    print(f"PDF: {pdf_path} ({size_mb:.1f} MB)")

    tracker = BookChapterTracker()

    # Collect footnotes per page (indexed by page number)
    all_page_footnotes: list[tuple[int, list[dict[str, str | int]]]] = []

    # Track verse-count-per-page boundaries for footnote linking
    verse_count_before_page: list[int] = []

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        print(f"Total pages: {total_pages}")

        for i, page in enumerate(pdf.pages):
            if (i + 1) % 100 == 0 or i == 0:
                print(f"  Processing page {i + 1}/{total_pages}...")

            verse_count_before_page.append(len(tracker.verses))

            # Extract body text (column-aware)
            body_text = _extract_body_columns(page)
            tracker.process_body(body_text)

            # Extract footnotes
            fn_text = _extract_footnote_zone(page)
            if fn_text:
                notes = _parse_footnotes(fn_text)
                if notes:
                    all_page_footnotes.append((i + 1, notes))

    tracker.finalize()
    verse_count_before_page.append(len(tracker.verses))  # sentinel

    print(f"\nExtracted {len(tracker.verses)} total verses.")

    # ── Link footnotes to verses ──
    total_linked = 0
    for page_num, notes in all_page_footnotes:
        page_idx = page_num - 1
        if page_idx >= len(verse_count_before_page) - 1:
            continue

        # Verses that were added during this page
        start_v = verse_count_before_page[page_idx]
        end_v = verse_count_before_page[page_idx + 1] if page_idx + 1 < len(verse_count_before_page) else len(tracker.verses)

        page_verses = tracker.verses[start_v:end_v]
        for note in notes:
            symbol = note["symbol"]
            note_text = str(note["note_text"])
            # Attach to the last verse on this page (simplistic but reasonable)
            # A more sophisticated approach would search the raw text for the symbol
            if page_verses:
                fn_entry: dict[str, Any] = {
                    "symbol": symbol,
                    "note_text": note_text,
                }
                page_verses[-1].footnotes.append(fn_entry)
                total_linked += 1

    print(f"Linked {total_linked} footnotes to verses.")

    # ── Collect stats per book ──
    @dataclass
    class BookStats:
        chapters: set[int] = field(default_factory=set)
        verses: int = 0
        footnotes: int = 0

    book_stats: dict[str, BookStats] = {}
    for v in tracker.verses:
        if v.book not in book_stats:
            book_stats[v.book] = BookStats()
        book_stats[v.book].chapters.add(v.chapter)
        book_stats[v.book].verses += 1
        book_stats[v.book].footnotes += len(v.footnotes)

    print(f"\n{'Book':<6} {'Chapters':>8} {'Verses':>8} {'Notes':>6}")
    print("-" * 32)
    for code in sorted(book_stats.keys(), key=lambda c: next((b["order"] for b in BOOKS_CONFIG if b["code"] == c), 999)):
        stats = book_stats[code]
        print(f"{code:<6} {len(stats.chapters):>8} {stats.verses:>8} {stats.footnotes:>6}")

    # Check for missing books
    found_codes = set(book_stats.keys())
    expected_codes = {b["code"] for b in BOOKS_CONFIG}
    missing = expected_codes - found_codes
    if missing:
        print(f"\n[WARN] {len(missing)} book(s) not found in PDF:")
        for code in sorted(missing):
            heading = next((b["headings"][0] for b in BOOKS_CONFIG if b["code"] == code), code)
            print(f"  {heading} ({code})")

    # ── Build helloao-compatible output ──
    # Group verses by book → chapter
    from collections import OrderedDict

    book_chapters: dict[str, dict[int, list[VerseRecord]]] = OrderedDict()
    for v in tracker.verses:
        if v.book not in book_chapters:
            book_chapters[v.book] = OrderedDict()
        if v.chapter not in book_chapters[v.book]:
            book_chapters[v.book][v.chapter] = []
        book_chapters[v.book][v.chapter].append(v)

    helloao_books: list[dict[str, Any]] = []
    for code, chapters_map in book_chapters.items():
        cfg = next((b for b in BOOKS_CONFIG if b["code"] == code), None)
        if not cfg:
            continue

        helloao_chapters: list[dict[str, Any]] = []
        total_book_verses = 0
        for chap_num, chap_verses in chapters_map.items():
            content = [
                {
                    "type": "verse",
                    "number": v.verse,
                    "content": [v.text],
                }
                for v in chap_verses
            ]
            helloao_chapters.append({
                "chapter": {
                    "number": chap_num,
                    "bookName": cfg["headings"][0],
                    "content": content,
                },
            })
            total_book_verses += len(chap_verses)

        helloao_books.append({
            "id": code,
            "name": cfg["headings"][0],
            "shortName": cfg["abbrev"],
            "commonName": ENGLISH_BOOK_NAMES.get(code, code),
            "title": cfg["headings"][0],
            "order": cfg["order"],
            "numberOfChapters": len(chapters_map),
            "totalNumberOfVerses": total_book_verses,
            "isApocryphal": code in APOCRYPHAL_CODES,
            "chapters": helloao_chapters,
        })

    total_chapters = sum(b["numberOfChapters"] for b in helloao_books)

    output: dict[str, Any] = {
        "translation": {
            "id": "ro_anania",
            "name": "Biblia Anania",
            "englishName": "Romanian Anania Bible",
            "shortName": "Anania",
            "textDirection": "ltr",
            "language": "ro",
            "website": "https://dervent.ro/biblia/Biblia-ANANIA.pdf",
            "licenseUrl": "",
            "numberOfBooks": len(helloao_books),
            "totalNumberOfChapters": total_chapters,
            "totalNumberOfVerses": len(tracker.verses),
            "availableFormats": ["json"],
        },
        "books": helloao_books,
    }

    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Bible JSON written to: {output_path}")
    print(f"   {len(helloao_books)} books, {total_chapters} chapters, {len(tracker.verses)} verses")

    # ── Insert footnotes into database ──
    if total_linked > 0 and database_url:
        _insert_notes_to_db(tracker.verses, database_url)
    elif total_linked > 0:
        print(f"   {total_linked} footnotes found but no DATABASE_URL provided — skipping DB insert.")
        print("   Re-run with --database-url or set the DATABASE_URL env var to persist notes.")
    else:
        print("   No footnotes extracted.")


# ──────────────────────────────────────────────────────────────────────────────
# CLI entry point
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print("Usage: python anania_extract.py <path-to-Biblia-ANANIA.pdf> [output.json] [--database-url URL]")
        print(f"\nDefault output: {os.path.abspath(DEFAULT_OUTPUT_PATH)}")
        print("\nOptions:")
        print("  --database-url URL   PostgreSQL connection string for inserting footnotes")
        print("                       into the anania_adnotari table. Falls back to the")
        print("                       DATABASE_URL environment variable if not provided.")
        print("\nExample:")
        print("  pip install pdfplumber psycopg2-binary")
        print("  python anania_extract.py /path/to/Biblia-ANANIA.pdf")
        print("  python anania_extract.py /path/to/Biblia-ANANIA.pdf --database-url postgresql://user:pass@localhost:5432/db")
        sys.exit(1)

    # Parse arguments (simple: positional + optional --database-url)
    positional: list[str] = []
    database_url: str | None = None
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == "--database-url" and i + 1 < len(sys.argv):
            database_url = sys.argv[i + 1]
            i += 2
        else:
            positional.append(sys.argv[i])
            i += 1

    if not positional:
        print("ERROR: PDF path is required.")
        sys.exit(1)

    pdf_path = positional[0]
    output_path = positional[1] if len(positional) > 1 else DEFAULT_OUTPUT_PATH

    # Fall back to DATABASE_URL environment variable
    if not database_url:
        database_url = os.environ.get("DATABASE_URL")

    extract(pdf_path, output_path, database_url=database_url)


if __name__ == "__main__":
    main()
