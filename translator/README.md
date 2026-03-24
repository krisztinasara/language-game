# Sentence-to-JSON translator

Translates coded natural-language sentences (CSV) into JSON files for the language-game app. **One JSON file per sentence.**

## Usage

```bash
# From this folder (translator/)
python translate.py sentences.csv -o output

# Custom paths
python translate.py /path/to/sentences.csv -o /path/to/output -m code-mappings.json

# CSV has no header row
python translate.py data.csv --no-header

# Use a specific column (default: 0)
python translate.py data.csv -c 1

# Reproducible output
python translate.py sentences.csv -o output --seed 42
```

## Input

- **CSV**: one sentence per row. By default the first column is the sentence; use `-c N` for column index `N`. Use `--no-header` if the first row is data.
- **code-mappings.json**: maps agent codes (N1–N5), modifiers (Aa, Ab), and action codes (e.g. HIDE.INTR) to app identifiers. Edit this file to match your codes.

## Output

- **Directory**: `output/` by default (use `-o` to override).
- **JSON files**: one per sentence. Filenames follow `OBJ-...-SBJ-...-VERB-LOC-....json` (OBJ/LOC omitted when not present). See TRANSLATOR-SPEC.txt §6.
- **sequence-list.txt**: list of JSON filenames, one per line, in the same order as the input CSV. The app (`sequence.jsx`) fetches this file to build the play order.

## Dependencies

Python 3.6+. No third-party packages; uses only the standard library (`csv`, `json`, `random`, `re`, `argparse`, `pathlib`).

## Specs

- **TRANSLATOR-SPEC.txt** — Grammar, modifier rule, filename convention.
- **OUTPUT-FORMAT.txt** — JSON shape and animation types for the app.
