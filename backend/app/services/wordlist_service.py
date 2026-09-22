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
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterator, Optional, Set
from app.config import settings
import logging

logger = logging.getLogger(__name__)


def _strip_accents(s: str) -> str:
    """josé → jose, muñoz → munoz. Clave para semillas en español."""
    s = s.replace("ñ", "n").replace("Ñ", "N")
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


# Ficheros de contraseñas más comunes (SecLists / xato). Se lee el top-N si existen.
COMMON_PW_FILES = [
    "/usr/share/SecLists/Passwords/Common-Credentials/xato-net-10-million-passwords-100000.txt",
    "/usr/share/SecLists/Passwords/Common-Credentials/xato-net-10-million-passwords.txt",
    "/usr/share/seclists/Passwords/Common-Credentials/xato-net-10-million-passwords-100000.txt",
    "/usr/share/wordlists/rockyou.txt",
]
COMMON_PW_FALLBACK = [
    "123456", "password", "12345678", "qwerty", "123456789", "12345", "1234",
    "111111", "1234567", "dragon", "123123", "baseball", "abc123", "football",
    "monkey", "letmein", "696969", "shadow", "master", "666666", "qwertyuiop",
    "123321", "mustang", "1234567890", "michael", "654321", "superman", "1qaz2wsx",
    "7777777", "121212", "000000", "qazwsx", "iloveyou", "admin", "welcome",
    "login", "princess", "solo", "passw0rd", "starwars", "hola", "amor",
    "madrid", "barcelona", "españa", "realmadrid", "cristiano", "messi",
]


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
YEARS_WIDE = [str(y) for y in range(1900, 2051)]   # rango amplio 1900–2050
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
_SN_MALE = [
    'antonio', 'jose', 'manuel', 'francisco', 'juan', 'david', 'javier', 'jesus', 'angel',
    'carlos', 'miguel', 'rafael', 'pedro', 'sergio', 'fernando', 'jorge', 'alberto', 'luis',
    'alvaro', 'oscar', 'adrian', 'raul', 'enrique', 'ramon', 'pablo', 'andres', 'ruben',
    'eduardo', 'roberto', 'mario', 'diego', 'alejandro', 'iker', 'hugo', 'daniel', 'cristian',
    'martin', 'samuel', 'lucas', 'nicolas', 'mateo', 'leo', 'gonzalo', 'ivan', 'marcos',
    'victor', 'jaime', 'aitor', 'ignacio', 'agustin', 'arturo', 'felix', 'felipe', 'guillermo',
    'gregorio', 'joaquin', 'julian', 'lorenzo', 'marcelo', 'mauricio', 'maximo', 'octavio',
    'patricio', 'ricardo', 'rodrigo', 'salvador', 'saul', 'teodoro', 'tomas', 'valentin',
    'vicente', 'emilio', 'esteban', 'ezequiel', 'gabriel', 'german', 'gustavo', 'hector',
    'isaac', 'isidro', 'ismael', 'jonathan', 'josep', 'kevin', 'leandro', 'marc', 'matias',
    'moises', 'nestor', 'noe', 'omar', 'pau', 'sebastian', 'simon', 'unai', 'xavier', 'yago',
    'abel', 'aaron', 'alan', 'aldo', 'alfonso', 'alfredo', 'anibal', 'aurelio', 'benito',
    'bernardo', 'bruno', 'camilo', 'cesar', 'claudio', 'damian', 'dario', 'domingo', 'edgar',
    'eloy', 'elias', 'eneko', 'ernesto', 'eugenio', 'fabian', 'ferran', 'franco', 'gael',
    'gerardo', 'gines', 'hilario', 'horacio', 'humberto', 'ibai', 'izan', 'jacobo', 'jairo',
    'jan', 'jonas', 'josue', 'juanjo', 'luciano', 'lucio', 'mariano', 'maximiliano', 'nilo',
    'norberto', 'rene', 'sancho', 'santiago', 'saturnino', 'sixto', 'telmo', 'tobias', 'ulises',
    'yeray', 'zacarias',
]
_SN_FEMALE = [
    'maria', 'carmen', 'ana', 'isabel', 'pilar', 'dolores', 'teresa', 'rosa', 'antonia',
    'laura', 'cristina', 'marta', 'elena', 'mercedes', 'lucia', 'paula', 'sara', 'sofia',
    'andrea', 'patricia', 'silvia', 'beatriz', 'natalia', 'raquel', 'monica', 'irene', 'rocio',
    'noelia', 'carolina', 'sandra', 'nuria', 'angela', 'celia', 'alicia', 'julia', 'valeria',
    'martina', 'alba', 'marina', 'claudia', 'eva', 'olivia', 'mar', 'salma', 'carla', 'daniela',
    'emma', 'aitana', 'clara', 'lola', 'noa', 'vega', 'adriana', 'africa', 'aida', 'ainara',
    'ainhoa', 'alejandra', 'almudena', 'amaia', 'amalia', 'amanda', 'amelia', 'amparo', 'anabel',
    'angeles', 'aroa', 'aurora', 'azucena', 'barbara', 'belen', 'berta', 'blanca', 'brenda',
    'camila', 'candela', 'caridad', 'catalina', 'cayetana', 'cecilia', 'consuelo', 'covadonga',
    'dafne', 'debora', 'diana', 'dorotea', 'edurne', 'elisa', 'elsa', 'elvira', 'emilia',
    'encarna', 'esperanza', 'estefania', 'estela', 'esther', 'estrella', 'fabiola', 'fatima',
    'fernanda', 'flora', 'francisca', 'gabriela', 'gema', 'gloria', 'gracia', 'guadalupe',
    'ines', 'ingrid', 'iria', 'iris', 'itziar', 'jenifer', 'jimena', 'josefa', 'josefina',
    'juana', 'judith', 'leire', 'leonor', 'leticia', 'lidia', 'lorena', 'loreto', 'lourdes',
    'luisa', 'luz', 'macarena', 'magdalena', 'manuela', 'marcela', 'margarita', 'mariana',
    'maribel', 'marisa', 'marisol', 'matilde', 'maya', 'milagros', 'miriam', 'montse', 'nadia',
    'nayara', 'nerea', 'nieves', 'norma', 'ofelia', 'olga', 'paloma', 'paola', 'paz', 'penelope',
    'petra', 'rafaela', 'ramona', 'rebeca', 'remedios', 'reyes', 'ruth', 'sabrina', 'samanta',
    'saray', 'selena', 'socorro', 'soledad', 'susana', 'tamara', 'tania', 'tatiana', 'vanesa',
    'veronica', 'victoria', 'violeta', 'virginia', 'viviana', 'ximena', 'yaiza', 'yolanda',
    'zaira', 'zoe',
]

_SN_DIMIN = [
    'pepe', 'paco', 'manolo', 'curro', 'nacho', 'kike', 'quique', 'chema', 'chus', 'lucho',
    'toni', 'rafa', 'santi', 'edu', 'fran', 'guille', 'javi', 'juanma', 'juancar', 'juanjo',
    'josema', 'chuchi', 'goyo', 'lalo', 'memo', 'moncho', 'nando', 'nano', 'poncho', 'tino',
    'lola', 'lolita', 'charo', 'concha', 'conchi', 'pili', 'mari', 'chelo', 'tere', 'maite',
    'mayte', 'bea', 'cris', 'inma', 'loli', 'mamen', 'marisa', 'merche', 'nati', 'pepa',
    'puri', 'reme', 'rosi', 'sole', 'trini', 'vero', 'juanito', 'luisito', 'pepito', 'manoli',
]

def _build_spanish_names() -> list:
    """Base + diminutivos + nombres COMPUESTOS reales muy comunes en España (josemaria, juanjose…)."""
    names = list(dict.fromkeys(_SN_MALE + _SN_FEMALE + _SN_DIMIN))
    compounds = {
        'jose': ['maria', 'luis', 'antonio', 'manuel', 'miguel', 'ramon', 'angel', 'ignacio',
                 'carlos', 'francisco', 'javier', 'pablo', 'andres'],
        'juan': ['jose', 'carlos', 'manuel', 'antonio', 'francisco', 'pablo', 'luis', 'pedro',
                 'ramon', 'ignacio', 'diego', 'cruz'],
        'maria': ['jose', 'carmen', 'luisa', 'angeles', 'pilar', 'teresa', 'isabel', 'dolores',
                  'jesus', 'victoria', 'mar', 'elena', 'rosa', 'cristina', 'luz', 'paz', 'nieves',
                  'belen', 'jose', 'antonia', 'concepcion'],
        'miguel': ['angel'], 'luis': ['miguel', 'maria', 'antonio', 'alberto'],
        'jesus': ['maria', 'angel'], 'francisco': ['javier', 'jose', 'manuel'],
        'antonio': ['jose', 'manuel', 'jesus'], 'ana': ['maria', 'isabel', 'belen', 'rosa', 'cristina'],
        'jose': ['maria', 'luis', 'antonio', 'manuel', 'miguel', 'ramon', 'angel', 'ignacio'],
        'carlos': ['alberto', 'jose'], 'manuel': ['jesus', 'jose', 'antonio'],
    }
    for first, seconds in compounds.items():
        for sec in seconds:
            names.append(first + sec)
    return list(dict.fromkeys(names))

SPANISH_NAMES = _build_spanish_names()


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
    use_strip_accents: bool = True          # josé → jose (añade la variante sin acentos)

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
    add_spanish_names: bool = True           # NEW: 1000+ Spanish first names
    add_common_passwords: bool = False       # NEW: top-N contraseñas más comunes (xato/SecLists)
    common_passwords_count: int = 10000
    use_wide_years: bool = False             # NEW: años 1900–2050 (además de birth_years)

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
        if self.cfg.use_wide_years:
            yield from YEARS_WIDE
            yield from YEARS_SHORT
        elif self.cfg.use_birth_years:
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

        # Año + símbolo (cuchara2023!) — patrón muy frecuente en fugas reales
        if self.cfg.use_years and self.cfg.use_symbols:
            for year in YEARS_COMMON:
                for sym in SYMBOLS[:5]:
                    self._write(fh, base + year + sym)

    def _expand_seeds(self, seeds: list[str]) -> list[str]:
        """Añade la variante sin acentos de cada semilla (josé → jose), deduplicada."""
        if not self.cfg.use_strip_accents:
            return seeds
        out: list[str] = []
        for s in seeds:
            if s not in out:
                out.append(s)
            st = _strip_accents(s)
            if st and st.lower() != s.lower() and st not in out:
                out.append(st)
        return out

    def _generate_combinations(self, words: list[str], fh):
        """Combine seed words: repetition, pairs and (optionally) triples."""
        if not self.cfg.combine_words:
            return

        # REPETICIÓN de una misma semilla (anderander, AnderAnder) — muy común
        for w in words:
            if 1 < len(w) <= 12:
                self._apply_appendages(w.lower() + w.lower(), fh)
                self._write(fh, w.capitalize() + w.capitalize())

        if len(words) < 2:
            return

        # PAIRS — full appendages
        for w1, w2 in itertools.permutations(words, 2):
            for v1, v2 in [
                (w1.lower(), w2.lower()),
                (w1.capitalize(), w2.capitalize()),
                (w1.upper(), w2.upper()),
                (w1.lower(), w2.capitalize()),  # Mixed (camelCase)
                (w1.capitalize(), w2.lower()),
            ]:
                combined = v1 + v2
                if combined:
                    self._apply_appendages(combined, fh)
                    # leet sobre la combinación (una variante, controla la explosión)
                    if self.cfg.use_leet:
                        for lv in itertools.islice(self._leet_variants(combined.lower()), 2):
                            self._write(fh, lv)
                    # combinación invertida (anderibai → iabirdna)
                    if self.cfg.use_reverse_combine and len(combined) > 2:
                        self._write(fh, combined[::-1])

                if self.cfg.use_separators:
                    for sep in ['_', '.', '-', '+', '@', '#']:
                        self._write(fh, v1 + sep + v2)

            # año/número entre las dos palabras (ander2024ibai) — patrón muy común
            if self.cfg.use_years:
                a, b = w1.lower(), w2.lower()
                for year in YEARS_COMMON[:12]:
                    self._write(fh, a + year + b)
                self._write(fh, w1.capitalize() + "2024" + w2.capitalize())

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

    def _add_common_passwords(self, fh):
        """Añade las top-N contraseñas más comunes (del fichero de SecLists si existe)."""
        n = max(0, int(self.cfg.common_passwords_count or 0))
        if n <= 0:
            return
        src = next((p for p in COMMON_PW_FILES if os.path.isfile(p)), None)
        if src:
            try:
                with open(src, "r", encoding="utf-8", errors="ignore") as f:
                    for i, line in enumerate(f):
                        if i >= n:
                            break
                        pw = line.rstrip("\r\n")
                        if pw:
                            self._write(fh, pw)
                return
            except Exception as e:
                logger.warning(f"common passwords read failed: {e}")
        for pw in COMMON_PW_FALLBACK:
            self._write(fh, pw)

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
        seeds = self._expand_seeds(seeds)

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

                    # Phase 3: palabras base comunes STANDALONE (con appendages).
                    # Antes se cruzaban con cada semilla (base+seed, seed+base) y
                    # generaba candidatas absurdas como "adminander" — eliminado.
                    if self.cfg.add_common_base:
                        for base_word in COMMON_BASE_WORDS:
                            self._apply_appendages(base_word, fh)
                            self._write(fh, base_word.capitalize())
                        await asyncio.sleep(0)

                    # Phase 4: palabras base en español STANDALONE
                    if self.cfg.add_spanish_base:
                        for base_word in SPANISH_BASE:
                            self._apply_appendages(base_word, fh)
                            if not any(ord(c) > 127 for c in base_word):
                                self._write(fh, base_word.capitalize())
                            else:
                                self._apply_appendages(_strip_accents(base_word), fh)
                        await asyncio.sleep(0)

                    # Phase 5: nombres españoles STANDALONE + años/números (muy común)
                    if self.cfg.add_spanish_names:
                        year_pool = YEARS_FULL if self.cfg.use_birth_years else YEARS_COMMON
                        for name in SPANISH_NAMES:
                            self._write(fh, name)
                            self._write(fh, name.capitalize())
                            if self.cfg.use_years:
                                for year in year_pool:
                                    self._write(fh, name + year)
                                    self._write(fh, name.capitalize() + year)
                            if self.cfg.use_numbers:
                                for num in NUMBERS_2[:100]:
                                    self._write(fh, name.capitalize() + num)
                        await asyncio.sleep(0)

                    # Phase 6: top-N contraseñas más comunes (xato/SecLists)
                    if self.cfg.add_common_passwords:
                        self._add_common_passwords(fh)
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
            for v in list(self._leet_variants(seed.lower()))[:16]:
                samples_by_category["leet"].append(v)

            # Doubling
            for v in list(self._doubling_variants(seed.lower()))[:5]:
                samples_by_category["doubling"].append(v)

            # Infix
            for v in list(self._infix_variants(seed))[:16]:
                samples_by_category["infix"].append(v)

            # Number appendages
            for num in NUMBERS_2[:12]:
                samples_by_category["appendage_numbers"].append(seed.lower() + num)
            samples_by_category["appendage_numbers"].append(seed.lower() + "1234")

            # Symbol appendages
            if self.cfg.use_symbols:
                for sym in SYMBOLS[:10]:
                    samples_by_category["appendage_symbols"].append(seed.lower() + sym)
                if self.cfg.use_symbol_pairs:
                    for pair in SYMBOL_PAIRS[:6]:
                        samples_by_category["appendage_symbols"].append(seed.lower() + pair)

            # Year appendages
            if self.cfg.use_years:
                for year in ['2024', '2025', '2008', '1995', '99']:
                    samples_by_category["appendage_years"].append(seed.lower() + year)

            # Accents stripped (revisa cualquier semilla con tildes/ñ)
            if self.cfg.use_strip_accents:
                for sd in seeds:
                    st = _strip_accents(sd)
                    if st.lower() != sd.lower():
                        samples_by_category["accents"] = [st, st.capitalize(), st.lower() + "2024"]
                        break

            # Combinations (repetición, pares, invertida)
            if self.cfg.combine_words:
                samples_by_category["combinations"].append(seed.lower() + seed.lower())
                if len(seeds) >= 2:
                    samples_by_category["combinations"].append(seeds[0].lower() + seeds[1].lower())
                    samples_by_category["combinations"].append(seeds[0].capitalize() + seeds[1].capitalize())
                    samples_by_category["combinations"].append(seeds[0].lower() + "_" + seeds[1].lower())
                    samples_by_category["combinations"].append(seeds[0].lower() + seeds[1].capitalize() + "2024")
                    if self.cfg.use_reverse_combine:
                        samples_by_category["combinations"].append((seeds[0].lower() + seeds[1].lower())[::-1])
            if self.cfg.combine_3_words and len(seeds) >= 3:
                samples_by_category["combinations"].append(seeds[0].lower() + seeds[1].lower() + seeds[2].lower())
                samples_by_category["combinations"].append(seeds[0].capitalize() + seeds[1].capitalize() + seeds[2].capitalize())

            # Spanish base (STANDALONE con appendages, no cruzado con semillas)
            if self.cfg.add_spanish_base:
                for sb in ['casa', 'amor', 'familia', 'madrid', 'barca']:
                    samples_by_category["spanish"].append(sb.capitalize() + '2024')
                    samples_by_category["spanish"].append(sb + '123!')

            # Spanish names (standalone + año/número)
            if self.cfg.add_spanish_names:
                for name in ['maria', 'juan', 'sofia', 'carlos']:
                    samples_by_category["names"].append(name.capitalize() + '2024')
                    samples_by_category["names"].append(name + '1995')

            # Filter empties and dedupe within category
            for k in samples_by_category:
                samples_by_category[k] = [
                    s for s in dict.fromkeys(samples_by_category[k]).keys()
                    if self.cfg.min_length <= len(s) <= self.cfg.max_length
                ][:14]

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

class CountingGenerator(WordlistGenerator):
    """Dry-run: cuenta EXACTAMENTE las candidatas únicas (con dedup y filtros de
    longitud), sin escribir a disco, hasta un tope. Da una estimación precisa."""

    def __init__(self, config: GeneratorConfig, cap: int = 2_000_000):
        super().__init__(config)
        self._cap = cap
        self.capped = False

    def _write(self, fh, word: str):
        if self._accept(word):
            self.count += 1
            if self.count >= self._cap:
                self.capped = True
                raise StopIteration

    async def count_unique(self) -> tuple:
        # Reutiliza generate() (todas las fases) pero _write no escribe, solo cuenta.
        self.cfg.output_filename = "._estimate_tmp.txt"
        prev_max = self.cfg.max_total
        self.cfg.max_total = self._cap
        try:
            await self.generate()
        finally:
            self.cfg.max_total = prev_max
            try:
                (settings.WORDLISTS_DIR / "._estimate_tmp.txt").unlink()
            except Exception:
                pass
        return self.count, self.capped


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

    async def estimate(self, params: dict) -> dict:
        """Estimación PRECISA por dry-run: cuenta candidatas únicas reales
        (dedup + filtros de longitud + todas las mutaciones), hasta un tope."""
        config = GeneratorConfig(**{k: v for k, v in params.items() if k in GeneratorConfig.__dataclass_fields__})
        seeds = [w.strip() for w in config.seed_words if w.strip()]
        if not seeds:
            return {"estimated_count": 0, "estimated_count_human": "0", "estimated_size_bytes": 0,
                    "estimated_size_human": "0 B", "estimated_time_seconds": 0, "exact": True}
        cap = min(config.max_total, 3_000_000)
        counter = CountingGenerator(config, cap=cap)
        try:
            count, capped = await counter.count_unique()
        except Exception as e:
            logger.warning(f"estimate dry-run failed: {e}")
            count, capped = 0, False
        seen = counter.seen
        avg = (sum(len(w) for w in seen) / len(seen)) if seen else 12.0
        est = count
        over = capped and config.max_total > cap
        if over:
            est = config.max_total
        size = int(est * (avg + 1))
        return {
            "estimated_count": est,
            "estimated_count_human": f"{est:,}" + ("+" if over else ""),
            "estimated_size_bytes": size,
            "estimated_size_human": WordlistGenerator._human_size(size),
            "estimated_time_seconds": max(1, est // 300_000),
            "exact": not capped,
        }

wordlist_service = WordlistService()
