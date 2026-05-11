"""
Wordlist Generator Service v2 — Massively expanded mutation engine.

Major improvements over v1:
  - Comprehensive leetspeak with 2-4 substitutions per letter (all common letters)
  - NEW: Number infix mutations — digits BETWEEN letters (an1der, b3rta, m4r1a)
  - NEW: 3-word combinations with full appendages (anderibai2008, ibai_ander_2008)
  - NEW: Symbol pair appendages (ander!@, ander#$, ander!1)
  - NEW: Common Spanish names (top 100 male/female names)
  - Massively expanded Spanish base (250+ words: cities, family, food, sports...)
  - Improved leet pair combinations (4nd3r, 4nd3r1)
  - Better preview/estimate endpoint for live UI feedback

Ideal for offensive security audits where seed words come from OSINT
(target's name, dog's name, kid names, birthdate, sport team, etc.).
"""

from __future__ import annotations
import asyncio
import hashlib
import itertools
import json
import os
import random
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterator, Optional, Set
from app.config import settings
import logging

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
# CONSTANTS — Mutation rules
# ═══════════════════════════════════════════════════════════

# COMPREHENSIVE LEETSPEAK — Multiple substitutions per letter
# Ordered by popularity in real-world password leaks (RockYou-style analyses)
LEET_MAP = {
    'a': ['4', '@', '^'],
    'b': ['8', '6'],
    'c': ['(', '<', 'k'],
    'd': ['0'],
    'e': ['3', '&', '€'],
    'f': ['ph'],
    'g': ['9', '6'],
    'h': ['#'],
    'i': ['1', '!', '|'],
    'j': ['7'],
    'k': ['<', 'c'],
    'l': ['1', '|', '7', '!'],
    'n': ['^'],
    'o': ['0', '*', '()'],
    'p': ['9'],
    'q': ['9'],
    'r': ['2'],
    's': ['5', '$', 'z', '§'],
    't': ['7', '+', '1'],
    'u': ['v'],
    'v': ['u'],
    'w': ['vv'],
    'x': ['*', '%'],
    'y': ['j'],
    'z': ['2', 's'],
}

# Most common letter pairs for combined leet (medium intensity)
# These pairs cover the most-used patterns in real password leaks
LEET_COMMON_PAIRS = [
    ('a', '4'), ('e', '3'), ('i', '1'), ('o', '0'), ('s', '5'),
    ('a', '@'), ('i', '!'), ('s', '$'), ('t', '7'), ('l', '1'),
    ('b', '8'), ('g', '9'), ('z', '2'),
]

# WiFi / password symbols — most common on the keyboard
SYMBOLS = [
    '!', '@', '#', '$', '%', '&', '?', '*',
    '.', '_', '-', '+', '=', '~', '^',
]

# COMMON SYMBOL PAIRS — combinations seen frequently in real passwords
SYMBOL_PAIRS = [
    '!!', '!@', '!.', '!_', '!?', '!1', '!2', '!3', '!#',
    '@!', '@@', '@1', '@2', '@.', '@#',
    '##', '#!', '#1', '#2', '#@',
    '$$', '$!', '$1', '$.',
    '..', '...', '._', '.!', '.1',
    '_!', '_.', '_1', '_-',
    '-1', '-2', '-_', '--',
    '?!', '!?', '??',
    '*!', '*.',
    '+1', '+_',
]

# Years (full and abbreviated)
YEARS_FULL = [str(y) for y in range(1950, 2031)]
YEARS_SHORT = [str(y)[-2:] for y in range(1950, 2031)]
YEARS_COMMON = ['2024', '2025', '2026', '2023', '2022', '2021', '2020',
                '1990', '1991', '1992', '1993', '1994', '1995', '1996',
                '1997', '1998', '1999', '2000', '2001', '2002', '2003',
                '2004', '2005', '2006', '2007', '2008', '2009', '2010',
                '2011', '2012', '2013', '2014', '2015', '2016']

# Numeric suffixes
NUMBERS_1 = [str(n) for n in range(0, 10)]
NUMBERS_2 = [str(n).zfill(2) for n in range(0, 100)]
NUMBERS_3 = [str(n).zfill(3) for n in range(0, 1000)]
NUMBERS_4 = [str(n).zfill(4) for n in range(0, 10000)]

# Digits to use in INFIX mutations (between letters)
INFIX_DIGITS = ['1', '2', '3', '4', '5', '0', '7', '8', '9']

# Common compound suffixes (high hit-rate from leak analysis)
COMMON_SUFFIXES = [
    '123', '1234', '12345', '123456', '1234567', '12345678',
    '123!', '1234!', '12345!', '123#', '1234#',
    '!', '!!', '!!!', '@', '@@', '#', '?', '.', '_',
    '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12',
    '00', '69', '99', '88', '77', '66', '55', '44', '33', '22', '11',
    '!1', '!2', '!3', '@1', '@2', '@3', '#1', '#2',
    'abc', 'xyz', '321', 'qwerty', 'asdf',
    '0!', '1!', '2!', '3!',
]

COMMON_PREFIXES = [
    '!', '@', '#', '$', '_', '.',
    '1', '2', '0', '00', '11', '22',
]

# COMMON GENERAL BASE WORDS (English/universal)
COMMON_BASE_WORDS = [
    'password', 'pass', 'passwd', 'pwd',
    'admin', 'root', 'user', 'login', 'welcome', 'guest',
    'wifi', 'internet', 'red', 'router', 'modem', 'network',
    'home', 'office', 'work', 'casa',
    'qwerty', 'asdf', 'zxcv', '1234', 'abcd',
    'love', 'amor', 'family', 'master', 'secret',
    'hello', 'changeme', 'letmein',
]

# MASSIVELY EXPANDED SPANISH BASE WORDS
# Family / relationships, places, sports, food, time, common terms
SPANISH_BASE = [
    # Authentication terms
    'contraseña', 'contrasena', 'clave', 'secreto', 'pin',
    'admin', 'administrador', 'usuario', 'codigo',
    'password', 'login', 'acceso',

    # Family
    'familia', 'mama', 'papa', 'mami', 'papi', 'mamá', 'papá',
    'madre', 'padre', 'hijo', 'hija', 'hijos', 'hijas',
    'hermano', 'hermana', 'hermanos', 'hermanas',
    'abuelo', 'abuela', 'abuelos', 'abuelita', 'abuelito',
    'tio', 'tia', 'tío', 'tía', 'tios', 'tias',
    'primo', 'prima', 'primos', 'primas',
    'sobrino', 'sobrina', 'nieto', 'nieta', 'nietos',
    'novio', 'novia', 'esposo', 'esposa', 'marido', 'mujer',
    'cuñado', 'cuñada', 'suegro', 'suegra', 'compadre',
    'bebe', 'bebé', 'niño', 'niña', 'nino', 'nina',

    # Pets / animals
    'perro', 'perra', 'perrito', 'perrita',
    'gato', 'gata', 'gatito', 'gatita',
    'mascota', 'cachorro', 'chiqui',
    'pajaro', 'loro', 'pez', 'tortuga', 'conejo', 'hamster',
    'caballo', 'leon', 'tigre', 'aguila',

    # Affection / love
    'amor', 'amores', 'amante', 'amada', 'amado',
    'cariño', 'cariñin', 'cielo', 'sol', 'corazon', 'corazón',
    'tesoro', 'querido', 'querida', 'mivida', 'mialma',
    'beso', 'besos', 'besito', 'besitos', 'abrazo',
    'angel', 'angelito', 'angelita', 'principe', 'princesa',
    'rey', 'reina', 'reinita', 'amorcito', 'amorcita',
    'guapo', 'guapa', 'bonito', 'bonita', 'lindo', 'linda',
    'precioso', 'preciosa', 'hermoso', 'hermosa',

    # Religious
    'dios', 'jesus', 'jesús', 'maria', 'maría', 'cristo', 'jesucristo',
    'virgen', 'santo', 'santa', 'iglesia', 'cielo', 'paraiso',
    'angeles', 'fe', 'esperanza', 'fatima', 'lourdes',

    # Time & seasons
    'verano', 'invierno', 'primavera', 'otoño', 'otono',
    'navidad', 'reyes', 'noche', 'dia', 'tarde', 'mañana', 'manana',
    'hoy', 'ayer', 'siempre', 'nunca', 'eterno',
    'lunes', 'martes', 'miercoles', 'miércoles',
    'jueves', 'viernes', 'sabado', 'sábado', 'domingo',
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'setiembre',
    'octubre', 'noviembre', 'diciembre',
    'fiesta', 'cumpleaños', 'cumpleanos',

    # Cities — Spain
    'madrid', 'barcelona', 'sevilla', 'valencia', 'zaragoza',
    'malaga', 'bilbao', 'granada', 'cordoba', 'alicante',
    'murcia', 'palma', 'oviedo', 'gijon', 'gijón', 'vigo',
    'salamanca', 'leon', 'león', 'burgos', 'caceres', 'cáceres',
    'badajoz', 'merida', 'mérida', 'toledo', 'cuenca',
    'guadalajara', 'avila', 'ávila', 'segovia', 'soria',
    'huesca', 'teruel', 'pamplona', 'logroño', 'logrono',
    'santander', 'donosti', 'sansebastian',
    'cadiz', 'cádiz', 'huelva', 'almeria', 'almería',
    'jaen', 'jaén', 'lugo', 'ourense', 'pontevedra', 'coruna', 'coruña',
    'tenerife', 'canarias', 'palmas', 'laspalmas',
    'ibiza', 'mallorca', 'menorca', 'baleares', 'formentera',
    'castellon', 'castellón', 'tarragona', 'lleida', 'girona',

    # Spanish regions
    'galicia', 'asturias', 'cantabria', 'pais vasco', 'paisvasco',
    'navarra', 'rioja', 'aragon', 'aragón', 'cataluña', 'cataluna',
    'valenciacomunidad', 'andalucia', 'andalucía',
    'extremadura', 'castilla', 'castillaleon', 'castillamancha',
    'rioja', 'euskadi', 'galiza',

    # Football clubs (very common in passwords!)
    'realmadrid', 'madridista', 'halamadrid', 'merengue',
    'barca', 'barça', 'barcelona', 'fcb', 'culer', 'culé',
    'atletico', 'atlético', 'atleti', 'colchonero',
    'sevillafc', 'nervion', 'nervión',
    'betis', 'beticos',
    'valenciacf', 'valenciamesti', 'valencianista',
    'athletic', 'athleticbilbao', 'rojiblanco',
    'realsociedad', 'sociedad', 'donosti',
    'osasuna', 'celta', 'celtico', 'deportivo', 'deportivocoruna',
    'sporting', 'sportingijon',
    'rayo', 'rayovallecano', 'getafe', 'levante', 'leganes',
    'espanyol', 'mallorcaclub', 'cadizCF', 'almeria', 'elche',
    'granada', 'eibar', 'alaves', 'alavés', 'alaves',
    'tenerifecf', 'oviedo',

    # Sports
    'futbol', 'fútbol', 'baloncesto', 'tenis', 'padel', 'pádel',
    'ciclismo', 'natacion', 'natación', 'gimnasia', 'gimnasio',
    'running', 'crossfit', 'yoga', 'pilates',
    'deporte', 'campeon', 'campeón', 'ganador', 'champion',
    'liga', 'champions', 'mundial', 'eurocopa', 'olimpiadas',

    # Common items
    'casa', 'hogar', 'piso', 'apartamento', 'vivienda', 'chalet',
    'oficina', 'trabajo', 'empleo', 'curro',
    'empresa', 'negocio', 'jefe', 'jefa', 'compa', 'colega',
    'tienda', 'restaurante', 'bar', 'cafeteria', 'cafetería',
    'cafe', 'café', 'hotel', 'aeropuerto', 'estacion', 'estación',
    'cocina', 'salon', 'salón', 'baño', 'bano',
    'dormitorio', 'jardin', 'jardín', 'terraza', 'patio',
    'puerta', 'ventana', 'mesa', 'silla', 'cama',

    # Transport
    'coche', 'auto', 'moto', 'motocicleta', 'bici', 'bicicleta',
    'avion', 'avión', 'tren', 'metro', 'autobus', 'autobús', 'bus',
    'taxi', 'uber', 'cabify',

    # Tech
    'movil', 'móvil', 'telefono', 'teléfono', 'celular',
    'ordenador', 'computadora', 'pc', 'tablet', 'television',
    'televisión', 'tele', 'tv', 'consola', 'play', 'xbox',
    'internet', 'wifi', 'red', 'conexion', 'conexión',
    'router', 'modem', 'fibra', 'movistar', 'telefonica',
    'telefónica', 'orange', 'vodafone', 'jazztel', 'masmovil',

    # Food
    'comida', 'cena', 'desayuno', 'almuerzo', 'merienda', 'tapa',
    'pan', 'queso', 'jamon', 'jamón', 'chorizo', 'morcilla',
    'paella', 'tortilla', 'gazpacho', 'salmorejo', 'fabada',
    'cocido', 'chuleton', 'chuletón',
    'churros', 'porras', 'chocolate', 'helado', 'flan',
    'pizza', 'pasta', 'ensalada', 'gazpacho',
    'cerveza', 'vino', 'sangria', 'sangría', 'kalimotxo', 'tinto',
    'agua', 'zumo', 'leche', 'cafe', 'café', 'cortado',

    # Brands / common Spanish
    'mercadona', 'lidl', 'carrefour', 'corteingles', 'inditex',
    'zara', 'mango', 'desigual', 'seat', 'real',
    'caixa', 'bbva', 'santander', 'bankinter', 'sabadell',
    'iberia', 'renfe', 'correos',

    # Cars (Spanish brand SEAT models)
    'ibiza', 'leon', 'león', 'altea', 'cordoba', 'toledo',
    'arosa', 'panda', 'ronda', 'malaga', 'arona', 'ateca',
    'tarraco', 'mii',

    # Spanish phrases (no spaces)
    'teamo', 'teadoro', 'tequiero', 'mivida', 'mireina',
    'mirey', 'micielo', 'micariño', 'mialma', 'micorazon',
    'paratoda', 'parasiempre', 'pormiamor', 'pormi',
    'siempre', 'jamas', 'jamás',

    # Greetings
    'hola', 'adios', 'adiós', 'buenosdias', 'buenastardes',
    'buenasnoches', 'buenas', 'buenos', 'gracias', 'porfavor',
    'perdon', 'perdón',

    # Common verbs (used as base)
    'amar', 'querer', 'vivir', 'soñar', 'sonar',
    'reir', 'reír', 'jugar', 'cantar', 'bailar', 'saltar',
    'volar', 'correr', 'caminar',

    # Colors
    'rojo', 'azul', 'verde', 'amarillo', 'negro', 'blanco',
    'morado', 'naranja', 'rosa', 'gris', 'marron', 'marrón',
    'violeta', 'celeste', 'turquesa', 'dorado', 'plateado',

    # Numbers in Spanish
    'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete',
    'ocho', 'nueve', 'diez', 'cien', 'mil', 'millon',

    # Slang & casual
    'tio', 'tía', 'guay', 'molon', 'molón', 'cojonudo',
    'super', 'mega', 'ultra', 'genial', 'increible',
    'chulo', 'chula', 'flipante',

    # Abstract
    'libertad', 'felicidad', 'paz', 'alegria', 'alegría',
    'risa', 'sonrisa', 'vida', 'destino', 'futuro',
    'esperanza', 'fuerza', 'poder',
]

# COMMON SPANISH FIRST NAMES (top 100 in Spain)
SPANISH_NAMES = [
    # Top male names
    'antonio', 'jose', 'manuel', 'francisco', 'juan', 'david',
    'javier', 'jesus', 'angel', 'carlos', 'miguel', 'rafael',
    'pedro', 'sergio', 'fernando', 'jorge', 'alberto', 'luis',
    'alvaro', 'oscar', 'adrian', 'raul', 'enrique', 'ramon',
    'pablo', 'andres', 'ruben', 'eduardo', 'roberto', 'mario',
    'diego', 'alejandro', 'iker', 'hugo', 'daniel', 'cristian',
    'martin', 'samuel', 'lucas', 'nicolas', 'mateo', 'leo',
    'gonzalo', 'ivan', 'marcos', 'victor', 'jaime', 'aitor',

    # Top female names
    'maria', 'carmen', 'ana', 'isabel', 'pilar', 'dolores',
    'teresa', 'rosa', 'antonia', 'laura', 'cristina', 'marta',
    'elena', 'mercedes', 'lucia', 'paula', 'sara', 'sofia',
    'andrea', 'patricia', 'silvia', 'beatriz', 'natalia',
    'raquel', 'monica', 'irene', 'rocio', 'noelia', 'carolina',
    'sandra', 'nuria', 'angela', 'celia', 'alicia', 'julia',
    'valeria', 'martina', 'alba', 'marina', 'claudia', 'eva',
    'olivia', 'mar', 'salma', 'carla', 'daniela', 'emma',
    'aitana', 'clara', 'lola', 'noa', 'vega',
]


# ═══════════════════════════════════════════════════════════
# CONFIG — Generation profile
# ═══════════════════════════════════════════════════════════

@dataclass
class GeneratorConfig:
    """Configuration for the generation. Toggle each mutation type."""
    seed_words: list[str]

    # Case mutations
    use_lowercase: bool = True
    use_uppercase: bool = True
    use_capitalize: bool = True
    use_alternating_case: bool = False

    # Letter mutations
    use_leet: bool = True
    leet_intensity: str = "medium"          # low, medium, high
    use_doubling: bool = True               # ander → aander, anderr
    use_stretching: bool = False            # ander → aannddeerr
    use_reverse: bool = True                # ander → redna
    use_palindrome: bool = False            # ander → anderredna

    # NEW: Number infix (digits between letters)
    use_number_infix: bool = True

    # Numeric appendages
    use_numbers: bool = True
    number_max_length: int = 4
    use_years: bool = True
    use_birth_years: bool = True

    # Symbol appendages
    use_symbols: bool = True
    use_double_symbols: bool = True
    use_symbol_pairs: bool = True            # NEW: !@, #!, .1, etc.

    # Word combinations
    combine_words: bool = True               # 2-word combos
    combine_3_words: bool = False            # NEW: 3-word combos (slow!)
    use_separators: bool = True
    use_reverse_combine: bool = True

    # Common base words
    add_common_base: bool = True
    add_spanish_base: bool = True
    add_spanish_names: bool = True           # NEW: 100+ Spanish first names

    # Length filters
    min_length: int = 6
    max_length: int = 32

    # Limits
    max_total: int = 10_000_000
    output_filename: str = "custom_wordlist.txt"


# ═══════════════════════════════════════════════════════════
# GENERATOR
# ═══════════════════════════════════════════════════════════

class WordlistGenerator:
    def __init__(self, config: GeneratorConfig):
        self.cfg = config
        self.seen: Set[str] = set()
        self.count = 0
        self.start_time = 0.0
        self.output_path: Optional[Path] = None
        self._progress_cb = None

    # ─── Helpers ───

    def _accept(self, word: str) -> Optional[str]:
        if not word:
            return None
        n = len(word)
        if n < self.cfg.min_length or n > self.cfg.max_length:
            return None
        if word in self.seen:
            return None
        self.seen.add(word)
        return word

    def _write(self, fh, word: str):
        accepted = self._accept(word)
        if accepted:
            fh.write(accepted + "\n")
            self.count += 1
            if self._progress_cb and self.count % 5000 == 0:
                self._progress_cb(self.count)
            if self.count >= self.cfg.max_total:
                raise StopIteration

    # ─── Mutation generators ───

    def _case_variants(self, word: str) -> Iterator[str]:
        if not word:
            return
        if self.cfg.use_lowercase:
            yield word.lower()
        if self.cfg.use_uppercase:
            yield word.upper()
        if self.cfg.use_capitalize:
            yield word.capitalize()
            if len(word) > 1:
                yield word.lower()[:-1] + word[-1].upper()
        if self.cfg.use_alternating_case and len(word) <= 12:
            yield ''.join(c.upper() if i % 2 else c.lower() for i, c in enumerate(word))
            yield ''.join(c.lower() if i % 2 else c.upper() for i, c in enumerate(word))

    def _leet_variants(self, word: str) -> Iterator[str]:
        if not self.cfg.use_leet or not word:
            return

        intensity = self.cfg.leet_intensity
        word_lower = word.lower()

        if intensity == "low":
            # Single most-common substitution per character (one letter at a time)
            for char, subs in LEET_MAP.items():
                if char in word_lower:
                    yield word_lower.replace(char, subs[0])
            # One combined common substitution
            mutated = word_lower
            for c, s in [('a', '4'), ('e', '3'), ('i', '1')]:
                mutated = mutated.replace(c, s)
            if mutated != word_lower:
                yield mutated

        elif intensity == "medium":
            # All single-char single-sub variants
            for char, subs in LEET_MAP.items():
                for sub in subs:
                    if char in word_lower:
                        yield word_lower.replace(char, sub)

            # Common pair combinations (e.g., a→4 + e→3 → 4nd3r)
            for (c1, s1), (c2, s2) in itertools.combinations(LEET_COMMON_PAIRS, 2):
                if c1 != c2 and c1 in word_lower and c2 in word_lower:
                    mutated = word_lower.replace(c1, s1).replace(c2, s2)
                    if mutated != word_lower:
                        yield mutated

            # Triple common (a→4, e→3, i→1)
            mutated = word_lower
            for c, s in [('a', '4'), ('e', '3'), ('i', '1'), ('o', '0'), ('s', '5')]:
                mutated = mutated.replace(c, s)
            if mutated != word_lower:
                yield mutated

            # Triple common with @ instead of 4
            mutated = word_lower
            for c, s in [('a', '@'), ('e', '3'), ('i', '!'), ('o', '0'), ('s', '$')]:
                mutated = mutated.replace(c, s)
            if mutated != word_lower:
                yield mutated

        elif intensity == "high":
            # All combinations of leet substitutions (exponential!)
            chars_with_options = []
            for ch in word_lower:
                opts = [ch]
                if ch in LEET_MAP:
                    opts.extend(LEET_MAP[ch][:3])  # Limit to top 3 per letter
                chars_with_options.append(opts)
            # Limit to avoid explosion: only if word ≤ 8 chars
            if len(word_lower) <= 8:
                for combo in itertools.product(*chars_with_options):
                    yield ''.join(combo)
            else:
                # For longer words, fall back to medium intensity
                for char, subs in LEET_MAP.items():
                    for sub in subs:
                        if char in word_lower:
                            yield word_lower.replace(char, sub)

    def _doubling_variants(self, word: str) -> Iterator[str]:
        if not self.cfg.use_doubling or not word:
            return
        # Double first char
        yield word[0] + word
        # Double first 2 chars
        if len(word) >= 2:
            yield word[0] + word[0] + word
        # Double last char (1, 2, 3, 4 times)
        for n in range(1, 5):
            yield word + word[-1] * n
        # Double both first and last
        yield word[0] + word + word[-1]

    def _stretching_variants(self, word: str) -> Iterator[str]:
        if not self.cfg.use_stretching or not word:
            return
        yield ''.join(c * 2 for c in word)
        yield ''.join(c * 3 for c in word)

    def _infix_variants(self, word: str) -> Iterator[str]:
        """Insert digits between letters: 'ander' → 'an1der', 'and3r', etc."""
        if not self.cfg.use_number_infix or not word:
            return
        word_lower = word.lower()
        if len(word_lower) < 3:
            return

        # Insert single digit at every position
        for digit in INFIX_DIGITS[:6]:  # Top 6 digits
            for i in range(1, len(word_lower)):
                yield word_lower[:i] + digit + word_lower[i:]

        # Capitalized version
        word_cap = word.capitalize()
        if word_cap != word_lower:
            for digit in INFIX_DIGITS[:4]:  # Top 4 digits for capitalized
                for i in range(1, len(word_cap)):
                    yield word_cap[:i] + digit + word_cap[i:]

        # 2-digit infix at center
        if len(word_lower) >= 4:
            mid = len(word_lower) // 2
            for d1 in ['1', '2', '0']:
                for d2 in ['1', '2', '3']:
                    yield word_lower[:mid] + d1 + d2 + word_lower[mid:]

    def _number_suffixes(self) -> Iterator[str]:
        if not self.cfg.use_numbers:
            return
        yield from NUMBERS_1
        if self.cfg.number_max_length >= 2:
            yield from NUMBERS_2
        if self.cfg.number_max_length >= 3:
            yield from NUMBERS_3
        if self.cfg.number_max_length >= 4:
            yield from NUMBERS_4

    def _year_suffixes(self) -> Iterator[str]:
        if not self.cfg.use_years:
            return
        if self.cfg.use_birth_years:
            yield from YEARS_FULL
            yield from YEARS_SHORT
        else:
            yield from YEARS_COMMON

    # ─── Main pipeline ───

    def _base_variants(self, word: str) -> Iterator[str]:
        """All character-level mutations of a single word."""
        # 1. Original
        yield word
        # 2. Case variants
        yield from self._case_variants(word)
        # 3. Leet
        yield from self._leet_variants(word.lower())
        # 4. Doubling
        yield from self._doubling_variants(word.lower())
        # 5. Stretching
        yield from self._stretching_variants(word.lower())
        # 6. Reverse
        if self.cfg.use_reverse and len(word) > 1:
            yield word.lower()[::-1]
            yield word.upper()[::-1]
            yield word.capitalize()[::-1]
        # 7. Palindrome
        if self.cfg.use_palindrome and len(word) > 1:
            yield word.lower() + word.lower()[::-1]
            yield word.capitalize() + word.lower()[::-1]
        # 8. Number infix
        yield from self._infix_variants(word)

    def _apply_appendages(self, base: str, fh):
        """For a base word, append numbers, symbols, years, and combos."""
        # Bare base
        self._write(fh, base)

        # Single symbols (suffix)
        if self.cfg.use_symbols:
            for sym in SYMBOLS:
                self._write(fh, base + sym)
                if self.cfg.use_double_symbols:
                    self._write(fh, base + sym + sym)
                    self._write(fh, base + sym * 3)

            # Symbol prefix (top 8 to control explosion)
            for sym in SYMBOLS[:8]:
                self._write(fh, sym + base)

            # NEW: Symbol pair appendages
            if self.cfg.use_symbol_pairs:
                for pair in SYMBOL_PAIRS:
                    self._write(fh, base + pair)

        # Numbers
        for num in self._number_suffixes():
            self._write(fh, base + num)

        # Years
        for year in self._year_suffixes():
            self._write(fh, base + year)

        # Compound suffixes (most common in real leaks)
        for suf in COMMON_SUFFIXES:
            self._write(fh, base + suf)

        # Compound prefixes (top digits/symbols)
        for pre in COMMON_PREFIXES[:8]:
            self._write(fh, pre + base)

        # Number + symbol combos
        if self.cfg.use_numbers and self.cfg.use_symbols:
            for num in NUMBERS_2[:30]:
                for sym in SYMBOLS[:6]:
                    self._write(fh, base + num + sym)
                    self._write(fh, base + sym + num)

    def _generate_combinations(self, words: list[str], fh):
        """Combine seed words: pairs and (optionally) triples."""
        if not self.cfg.combine_words or len(words) < 2:
            return

        # PAIRS — full appendages
        for w1, w2 in itertools.permutations(words, 2):
            for v1, v2 in [
                (w1.lower(), w2.lower()),
                (w1.capitalize(), w2.capitalize()),
                (w1.upper(), w2.upper()),
                (w1.lower(), w2.capitalize()),  # Mixed
                (w1.capitalize(), w2.lower()),
            ]:
                combined = v1 + v2
                if combined:
                    self._apply_appendages(combined, fh)

                if self.cfg.use_separators:
                    for sep in ['_', '.', '-', '+', '@', '#']:
                        self._write(fh, v1 + sep + v2)

        # TRIPLES — limited appendages to control explosion
        if self.cfg.combine_3_words and len(words) >= 3:
            # All permutations of 3 distinct words
            for combo in itertools.permutations(words, 3):
                for case_func in [str.lower, str.capitalize, str.upper]:
                    try:
                        concat = ''.join(case_func(c) for c in combo)
                    except Exception:
                        continue
                    if not concat or len(concat) > self.cfg.max_length:
                        continue

                    # Bare concat
                    self._write(fh, concat)

                    # Suffix appendages: numbers (top 200), years, common suffixes
                    if self.cfg.use_numbers:
                        for num in NUMBERS_2[:50]:
                            self._write(fh, concat + num)
                        if self.cfg.number_max_length >= 4:
                            for num in NUMBERS_4[:200]:
                                self._write(fh, concat + num)
                    if self.cfg.use_years:
                        for year in YEARS_COMMON:
                            self._write(fh, concat + year)
                    for suf in COMMON_SUFFIXES[:30]:
                        self._write(fh, concat + suf)
                    if self.cfg.use_symbols:
                        for sym in SYMBOLS[:8]:
                            self._write(fh, concat + sym)

                # With separators
                if self.cfg.use_separators:
                    for sep in ['_', '.', '-']:
                        try:
                            joined_lower = sep.join(c.lower() for c in combo)
                            joined_cap = sep.join(c.capitalize() for c in combo)
                            self._write(fh, joined_lower)
                            self._write(fh, joined_cap)
                        except Exception:
                            continue

    # ─── Public API ───

    async def generate(self, progress_cb=None) -> dict:
        self._progress_cb = progress_cb
        self.start_time = time.time()
        self.count = 0
        self.seen.clear()

        out_path = settings.WORDLISTS_DIR / self.cfg.output_filename
        out_path.parent.mkdir(parents=True, exist_ok=True)
        self.output_path = out_path

        seeds = [w.strip() for w in self.cfg.seed_words if w.strip()]
        if not seeds:
            return {"error": "No seed words provided"}

        logger.info(f"Wordlist generation: {len(seeds)} seeds → {out_path}")

        try:
            with open(out_path, "w", encoding="utf-8") as fh:
                try:
                    # Phase 1: Per-seed mutations + appendages
                    for seed in seeds:
                        if len(seed) < 1 or len(seed) > 30:
                            continue
                        for base in self._base_variants(seed):
                            self._apply_appendages(base, fh)
                            if self.count % 50000 == 0:
                                await asyncio.sleep(0)

                    # Phase 2: Word combinations (2-word and optionally 3-word)
                    self._generate_combinations(seeds, fh)
                    await asyncio.sleep(0)

                    # Phase 3: Common base words ⨉ seeds
                    if self.cfg.add_common_base:
                        for base_word in COMMON_BASE_WORDS:
                            for seed in seeds:
                                self._write(fh, base_word + seed.lower())
                                self._write(fh, seed.lower() + base_word)
                                self._write(fh, base_word.capitalize() + seed.capitalize())
                                self._write(fh, seed.capitalize() + base_word.capitalize())
                            self._apply_appendages(base_word, fh)
                        await asyncio.sleep(0)

                    # Phase 4: Spanish base words
                    if self.cfg.add_spanish_base:
                        for base_word in SPANISH_BASE:
                            # Skip non-ASCII words for safety
                            if any(ord(c) > 127 for c in base_word):
                                # Add original with accents AND ASCII version
                                for seed in seeds:
                                    self._write(fh, base_word + seed.lower())
                                    self._write(fh, seed.lower() + base_word)
                            else:
                                for seed in seeds:
                                    self._write(fh, base_word + seed.lower())
                                    self._write(fh, seed.lower() + base_word)
                                    self._write(fh, base_word.capitalize() + seed.capitalize())
                            # Spanish word standalone with appendages (light)
                            self._apply_appendages(base_word, fh)
                        await asyncio.sleep(0)

                    # Phase 5: Spanish first names
                    if self.cfg.add_spanish_names:
                        for name in SPANISH_NAMES:
                            for seed in seeds:
                                self._write(fh, name + seed.lower())
                                self._write(fh, seed.lower() + name)
                                self._write(fh, name.capitalize() + seed.capitalize())
                            # Names with year suffixes (very common)
                            if self.cfg.use_years:
                                for year in YEARS_COMMON[:20]:
                                    self._write(fh, name + year)
                                    self._write(fh, name.capitalize() + year)
                        await asyncio.sleep(0)

                except StopIteration:
                    logger.info(f"Hit max_total limit ({self.cfg.max_total})")

            elapsed = time.time() - self.start_time
            file_size = out_path.stat().st_size

            return {
                "success": True,
                "filename": self.cfg.output_filename,
                "path": str(out_path),
                "total_passwords": self.count,
                "file_size_bytes": file_size,
                "file_size_human": self._human_size(file_size),
                "elapsed_seconds": round(elapsed, 2),
                "rate_per_second": int(self.count / elapsed) if elapsed > 0 else 0,
                "seed_words": seeds,
            }

        except Exception as e:
            logger.error(f"Generation failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    @staticmethod
    def _human_size(b: int) -> str:
        for unit in ["B", "KB", "MB", "GB"]:
            if b < 1024:
                return f"{b:.1f} {unit}"
            b /= 1024
        return f"{b:.1f} TB"


# ═══════════════════════════════════════════════════════════
# PREVIEW GENERATOR — Small in-memory generation for UI feedback
# ═══════════════════════════════════════════════════════════

class PreviewGenerator(WordlistGenerator):
    """Fast in-memory variant that produces a small sample for live UI preview."""

    def __init__(self, config: GeneratorConfig, sample_size: int = 60):
        super().__init__(config)
        self.sample_size = sample_size
        self.samples: list[str] = []

    def _write(self, fh, word: str):
        accepted = self._accept(word)
        if accepted:
            self.samples.append(accepted)
            self.count += 1
            if len(self.samples) >= self.sample_size:
                raise StopIteration

    async def preview(self) -> dict:
        seeds = [w.strip() for w in self.cfg.seed_words if w.strip()]
        if not seeds:
            return {"samples": []}

        # Generate diverse samples by sampling each phase
        samples_by_category: dict = {
            "case": [],
            "leet": [],
            "doubling": [],
            "infix": [],
            "appendage_numbers": [],
            "appendage_symbols": [],
            "appendage_years": [],
            "combinations": [],
            "spanish": [],
            "names": [],
        }

        try:
            # Use a fake "fh" that just collects samples
            class FakeFH:
                def write(_, x): pass
            fh = FakeFH()

            # Sample each category
            seed = seeds[0]

            # Case
            for v in list(self._case_variants(seed))[:5]:
                samples_by_category["case"].append(v)

            # Leet
            for v in list(self._leet_variants(seed.lower()))[:8]:
                samples_by_category["leet"].append(v)

            # Doubling
            for v in list(self._doubling_variants(seed.lower()))[:5]:
                samples_by_category["doubling"].append(v)

            # Infix
            for v in list(self._infix_variants(seed))[:8]:
                samples_by_category["infix"].append(v)

            # Number appendages
            for num in NUMBERS_2[:5]:
                samples_by_category["appendage_numbers"].append(seed.lower() + num)
            samples_by_category["appendage_numbers"].append(seed.lower() + "1234")

            # Symbol appendages
            if self.cfg.use_symbols:
                for sym in SYMBOLS[:5]:
                    samples_by_category["appendage_symbols"].append(seed.lower() + sym)
                if self.cfg.use_symbol_pairs:
                    for pair in SYMBOL_PAIRS[:3]:
                        samples_by_category["appendage_symbols"].append(seed.lower() + pair)

            # Year appendages
            if self.cfg.use_years:
                for year in ['2024', '2025', '2008', '1995', '99']:
                    samples_by_category["appendage_years"].append(seed.lower() + year)

            # Combinations
            if self.cfg.combine_words and len(seeds) >= 2:
                samples_by_category["combinations"].append(seeds[0].lower() + seeds[1].lower())
                samples_by_category["combinations"].append(seeds[0].capitalize() + seeds[1].capitalize())
                samples_by_category["combinations"].append(seeds[0].lower() + "_" + seeds[1].lower())
                samples_by_category["combinations"].append(seeds[1].lower() + seeds[0].lower() + "123")
            if self.cfg.combine_3_words and len(seeds) >= 3:
                samples_by_category["combinations"].append(seeds[0].lower() + seeds[1].lower() + seeds[2].lower())
                samples_by_category["combinations"].append(seeds[0].capitalize() + seeds[1].capitalize() + seeds[2].capitalize())

            # Spanish base
            if self.cfg.add_spanish_base:
                for sb in ['casa', 'amor', 'familia']:
                    samples_by_category["spanish"].append(sb + seed.lower())
                    samples_by_category["spanish"].append(seed.lower() + sb)

            # Spanish names
            if self.cfg.add_spanish_names:
                for name in ['maria', 'juan', 'sofia']:
                    samples_by_category["names"].append(name + seed.lower())
                    samples_by_category["names"].append(seed.lower() + name + '2024')

            # Filter empties and dedupe within category
            for k in samples_by_category:
                samples_by_category[k] = [
                    s for s in dict.fromkeys(samples_by_category[k]).keys()
                    if self.cfg.min_length <= len(s) <= self.cfg.max_length
                ][:8]

            # Compose flat samples list
            flat = []
            for cat, items in samples_by_category.items():
                for item in items:
                    flat.append({"category": cat, "value": item})

            return {"samples": flat, "categories": samples_by_category}

        except Exception as e:
            logger.error(f"Preview failed: {e}", exc_info=True)
            return {"samples": [], "error": str(e)}


# ═══════════════════════════════════════════════════════════
# WORDLIST MANAGER
# ═══════════════════════════════════════════════════════════

class WordlistService:
    _running_jobs: dict = {}

    async def generate(self, params: dict) -> dict:
        config = GeneratorConfig(**{k: v for k, v in params.items() if k in GeneratorConfig.__dataclass_fields__})
        generator = WordlistGenerator(config)

        job_id = hashlib.sha1(f"{config.output_filename}{time.time()}".encode()).hexdigest()[:8]
        self._running_jobs[job_id] = {"count": 0, "status": "running"}

        def progress(count):
            self._running_jobs[job_id]["count"] = count

        result = await generator.generate(progress_cb=progress)
        result["job_id"] = job_id
        self._running_jobs[job_id] = {"count": result.get("total_passwords", 0), "status": "done"}
        return result

    async def preview(self, params: dict) -> dict:
        """Generate a small sample preview for UI feedback."""
        config = GeneratorConfig(**{k: v for k, v in params.items() if k in GeneratorConfig.__dataclass_fields__})
        previewer = PreviewGenerator(config)
        return await previewer.preview()

    def list_wordlists(self) -> dict:
        wlist_dir = settings.WORDLISTS_DIR
        if not wlist_dir.exists():
            return {"wordlists": [], "total": 0, "directory": str(wlist_dir)}

        files = []
        for p in sorted(wlist_dir.iterdir()):
            if p.is_file() and p.suffix in {".txt", ".lst", ".dict", ""}:
                try:
                    stat = p.stat()
                    info = {
                        "filename": p.name,
                        "path": str(p),
                        "size_bytes": stat.st_size,
                        "size_human": WordlistGenerator._human_size(stat.st_size),
                        "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    }
                    if stat.st_size < 500 * 1024 * 1024:
                        with open(p, "rb") as fh:
                            info["lines"] = sum(1 for _ in fh)
                    else:
                        info["lines"] = None

                    if stat.st_size < 100 * 1024 * 1024:
                        try:
                            with open(p, "r", encoding="utf-8", errors="ignore") as fh:
                                first_lines = []
                                for _ in range(5):
                                    line = fh.readline().strip()
                                    if line:
                                        first_lines.append(line)
                                info["sample_first"] = first_lines
                        except:
                            info["sample_first"] = []

                    files.append(info)
                except Exception as e:
                    logger.warning(f"Could not read {p}: {e}")

        return {
            "wordlists": files,
            "total": len(files),
            "directory": str(wlist_dir),
            "total_size_bytes": sum(f["size_bytes"] for f in files),
            "total_size_human": WordlistGenerator._human_size(sum(f["size_bytes"] for f in files)),
        }

    def delete_wordlist(self, filename: str) -> dict:
        filename = os.path.basename(filename)
        path = settings.WORDLISTS_DIR / filename
        if not path.exists():
            return {"success": False, "error": "File not found"}
        try:
            path.unlink()
            return {"success": True, "filename": filename}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def estimate(self, params: dict) -> dict:
        config = GeneratorConfig(**{k: v for k, v in params.items() if k in GeneratorConfig.__dataclass_fields__})
        seeds = [w.strip() for w in config.seed_words if w.strip()]
        n = len(seeds)
        if n == 0:
            return {"estimated_count": 0, "estimated_size_bytes": 0}

        # Per-seed mutations
        per_seed = 1
        if config.use_lowercase: per_seed += 1
        if config.use_uppercase: per_seed += 1
        if config.use_capitalize: per_seed += 2
        if config.use_alternating_case: per_seed += 2
        if config.use_leet:
            if config.leet_intensity == "low": per_seed += 8
            elif config.leet_intensity == "medium": per_seed += 30
            else: per_seed += 80
        if config.use_doubling: per_seed += 8
        if config.use_stretching: per_seed += 2
        if config.use_reverse: per_seed += 3
        if config.use_palindrome: per_seed += 2
        if config.use_number_infix: per_seed += 35  # ~6 digits * ~6 positions

        # Appendages per base
        appendages = 1
        if config.use_symbols:
            appendages += len(SYMBOLS)
            if config.use_double_symbols: appendages += len(SYMBOLS) * 2
            if config.use_symbol_pairs: appendages += len(SYMBOL_PAIRS)
            appendages += 8  # prefix symbols
        if config.use_numbers:
            if config.number_max_length == 1: appendages += 10
            elif config.number_max_length == 2: appendages += 110
            elif config.number_max_length == 3: appendages += 1110
            elif config.number_max_length == 4: appendages += 11110
        if config.use_years:
            if config.use_birth_years: appendages += 162
            else: appendages += len(YEARS_COMMON)
        appendages += len(COMMON_SUFFIXES)
        appendages += 8  # common prefixes
        if config.use_numbers and config.use_symbols: appendages += 180

        # Per-seed total
        per_seed_total = per_seed * appendages

        # Combinations (n*(n-1)) for pairs * mutations
        combos = 0
        if config.combine_words and n >= 2:
            combos = n * (n - 1) * 5 * appendages  # 5 case variants
            if config.use_separators: combos += n * (n - 1) * 6  # separators
            if config.combine_3_words and n >= 3:
                triples = n * (n - 1) * (n - 2) * 3
                triples *= (50 + (200 if config.number_max_length >= 4 else 0) + len(YEARS_COMMON) + 30 + 8)
                combos += triples

        # Common base words
        base_count = 0
        if config.add_common_base:
            base_count += len(COMMON_BASE_WORDS) * (n * 4 + appendages)
        if config.add_spanish_base:
            base_count += len(SPANISH_BASE) * (n * 3 + appendages // 2)
        if config.add_spanish_names:
            base_count += len(SPANISH_NAMES) * (n * 3 + (20 if config.use_years else 0))

        total_est = per_seed_total * n + combos + base_count
        # Account for dedup (assume 30-40% are dupes)
        total_est = int(total_est * 0.65)
        # Cap at max_total
        total_est = min(total_est, config.max_total)

        size_est = total_est * 13  # avg 12 chars + newline

        return {
            "estimated_count": total_est,
            "estimated_count_human": f"{total_est:,}",
            "estimated_size_bytes": size_est,
            "estimated_size_human": WordlistGenerator._human_size(size_est),
            "estimated_time_seconds": max(2, total_est // 200_000),
        }


wordlist_service = WordlistService()
