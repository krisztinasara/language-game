"""
Sentence-to-JSON translator for the language-game app.
Reads a CSV of coded sentences, outputs one JSON file per sentence.
See TRANSLATOR-SPEC.txt and OUTPUT-FORMAT.txt in this folder.
"""

import argparse
import csv
import json
import os
import random
import re
from pathlib import Path

# Grid dimensions (must match app)
GRID_COLS = 13   # 0-12
GRID_ROWS = 6   # 0-5
AGENT_SIZE = 150

# Inner range: avoid edge columns/rows so agents stay fully on screen
INNER_COL_MIN, INNER_COL_MAX = 1, GRID_COLS - 2   # 1..11 for 13 cols
INNER_ROW_MIN, INNER_ROW_MAX = 1, GRID_ROWS - 2   # 1..4 for 6 rows

# Central range: SUBJ and LOC use relatively central positions (cols 2–10, rows 2–3)
CENTRAL_COL_MIN, CENTRAL_COL_MAX = 2, 10
CENTRAL_ROW_MIN, CENTRAL_ROW_MAX = 2, 3

# Screen center: SUBJ exactly in column 6 (center of screen for 0-based cols 0..12)
SCREEN_CENTER_COL = 6
SCREEN_CENTER_ROW_MIN, SCREEN_CENTER_ROW_MAX = 2, 3

# Distractor range for GO+LOC and for HIDE/REVEAL: less central (cols 1–10, rows 1–4), min distance from SUBJ
DISTRACTOR_COL_MIN, DISTRACTOR_COL_MAX = 1, 10
DISTRACTOR_ROW_MIN, DISTRACTOR_ROW_MAX = 1, 4

# GO: fixed amplitude and frequency (same regardless of movement distance)
AMPLITUDE_GO, FREQUENCY_GO = 45, 3

# PUSH-TR: fixed duration (faster and standardized)
DURATION_PUSH_TR = 1.0

# Random ranges (non-GO)
DURATION_MIN, DURATION_MAX = 1.5, 3.0
AMPLITUDE_MIN, AMPLITUDE_MAX = 30, 60
FREQUENCY_MIN, FREQUENCY_MAX = 2, 4
JUMP_HEIGHT_MIN, JUMP_HEIGHT_MAX = 150, 350


def load_mappings(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def parse_sentence(sentence, mappings):
    """Parse a coded sentence into verb, subject, object, location, and modifiers."""
    tokens = sentence.strip().split()
    agent_bases = mappings.get("agentBases", {})
    modifiers = mappings.get("modifiers", {})
    actions = mappings.get("actions", {})

    # Find verb (token that maps to an action)
    verb_key = None
    for t in tokens:
        if t in actions:
            verb_key = t
            break
    if not verb_key:
        return None

    # Role pattern: SBJ-N1, OBJ-N2, LOC-N1
    role_re = re.compile(r"^(SBJ|OBJ|LOC)-(N\d+)$", re.IGNORECASE)

    # Associate modifier with following agent token.
    # Each entry: (base_key, variant, had_explicit_modifier) for distractor and naming.
    resolved = {}  # role -> (base_key, variant, had_explicit_modifier)
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t in modifiers and i + 1 < len(tokens):
            next_t = tokens[i + 1]
            m = role_re.match(next_t)
            if m:
                role, n_key = m.group(1).upper(), m.group(2)
                base = agent_bases.get(n_key)
                if base:
                    variant = modifiers[t]
                    resolved[role] = (n_key, variant, True)
                else:
                    print(f"Error: unknown agent code '{n_key}' in sentence (after modifier): {sentence}")
                i += 2
                continue
        m = role_re.match(t)
        if m:
            role, n_key = m.group(1).upper(), m.group(2)
            if role not in resolved:
                if n_key in agent_bases:
                    resolved[role] = (n_key, random_variant(), False)
                else:
                    print(f"Error: unknown agent code '{n_key}' in sentence: {sentence}")
        i += 1

    subj = resolved.get("SBJ")   # (n_key, variant, had_explicit_modifier)
    obj = resolved.get("OBJ")
    loc = resolved.get("LOC")
    animation_type = actions[verb_key]

    return {
        "verb_key": verb_key,
        "animation_type": animation_type,
        "subj": subj,
        "obj": obj,
        "loc": loc,
        "mappings": mappings,
    }


def agent_id(base_key, variant, mappings):
    agent_bases = mappings.get("agentBases", {})
    base = agent_bases.get(base_key, "")
    if not base:
        print(f"Error: unknown agent base_key '{base_key}' - not in agentBases")
    return f"{base}-{variant}" if base else ""


def random_variant():
    variants = ["a", "b"]
    random.shuffle(variants)
    return variants[0]


def random_cell():
    """Return a random cell in the inner range (no edge rows/cols) so agents stay fully on screen."""
    return (
        random.randint(INNER_COL_MIN, INNER_COL_MAX),
        random.randint(INNER_ROW_MIN, INNER_ROW_MAX),
    )


def random_central_cell():
    """Return a random cell in the central range (cols 2–10, rows 2–3) for SUBJ and LOC."""
    return (
        random.randint(CENTRAL_COL_MIN, CENTRAL_COL_MAX),
        random.randint(CENTRAL_ROW_MIN, CENTRAL_ROW_MAX),
    )


def random_distractor_cell():
    """Return a random cell in the distractor range (cols 1–10, rows 1–4) for GO+LOC distractors."""
    return (
        random.randint(DISTRACTOR_COL_MIN, DISTRACTOR_COL_MAX),
        random.randint(DISTRACTOR_ROW_MIN, DISTRACTOR_ROW_MAX),
    )


def grid_distance_horizontal(ax, ay, bx, by):
    """Horizontal distance (absolute difference in X)."""
    return abs(ax - bx)


def is_central(x, y):
    return CENTRAL_COL_MIN <= x <= CENTRAL_COL_MAX and CENTRAL_ROW_MIN <= y <= CENTRAL_ROW_MAX


def random_screen_center_cell():
    """Return a random cell in the screen center (column 6, rows 2–3) for HIDE/REVEAL-INTR."""
    return (
        SCREEN_CENTER_COL,
        random.randint(SCREEN_CENTER_ROW_MIN, SCREEN_CENTER_ROW_MAX),
    )


def use_screen_center_cell(used_positions):
    """Pick a random unused cell in the screen center; mark used."""
    x, y = random_screen_center_cell()
    for _ in range(30):
        x, y = random_screen_center_cell()
        if (x, y) not in used_positions:
            break
    used_positions.add((x, y))
    return x, y


def random_duration():
    return round(random.uniform(DURATION_MIN, DURATION_MAX), 1)


def movement_distance(sx, sy, ex, ey):
    """Chebyshev distance (max of horizontal and vertical)."""
    return max(abs(ex - sx), abs(ey - sy))


def neighbors(x, y):
    out = []
    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        nx, ny = x + dx, y + dy
        if 0 <= nx < GRID_COLS and 0 <= ny < GRID_ROWS:
            out.append((nx, ny))
    return out if out else [(x, y)]


def cells_near(lx, ly):
    """LOC cell and its neighbors (for 'at/near' locative semantics)."""
    return [(lx, ly)] + neighbors(lx, ly)


# PUSH-TR: directions (dx, dy) for same-angle movement (8 directions)
PUSH_DIRECTIONS = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
PUSH_DISTANCE_MIN, PUSH_DISTANCE_MAX = 2, 3
# Contact point B in a narrow center band so the whole movement is centered; A and C must stay in inner range (no edges)
PUSH_CENTER_COL_MIN = (GRID_COLS - 1) // 2 - 2
PUSH_CENTER_COL_MAX = (GRID_COLS - 1) // 2 + 2
PUSH_CENTER_ROW_MIN, PUSH_CENTER_ROW_MAX = 2, 3


def _in_inner_range(x, y):
    """True if (x, y) is inside inner range (no edge columns/rows)."""
    return INNER_COL_MIN <= x <= INNER_COL_MAX and INNER_ROW_MIN <= y <= INNER_ROW_MAX


def place_push_tr_positions(used_positions):
    """Place pusher start, contact (pushed start), and pushed end so both movements share the same direction and distance.
    Contact B is in a narrow center band; A and C are constrained to inner range so no agent is on an edge. Returns
    (pusher_sx, pusher_sy, pushed_x, pushed_y, end_x, end_y)."""
    for _ in range(80):
        bx = random.randint(PUSH_CENTER_COL_MIN, PUSH_CENTER_COL_MAX)
        by = random.randint(PUSH_CENTER_ROW_MIN, PUSH_CENTER_ROW_MAX)
        dx, dy = random.choice(PUSH_DIRECTIONS)
        d = random.randint(PUSH_DISTANCE_MIN, PUSH_DISTANCE_MAX)
        ax, ay = bx - dx * d, by - dy * d
        cx, cy = bx + dx * d, by + dy * d
        if not _in_inner_range(ax, ay) or not _in_inner_range(cx, cy):
            continue
        if not _in_inner_range(bx, by):
            continue
        cells = [(ax, ay), (bx, by), (cx, cy)]
        if any(c in used_positions for c in cells):
            continue
        if len(set(cells)) != 3:
            continue
        for c in cells:
            used_positions.add(c)
        return ax, ay, bx, by, cx, cy
    # fallback: horizontal push along center row, all in inner range
    by = random.choice([2, 3])
    bx = random.randint(max(INNER_COL_MIN + 2, PUSH_CENTER_COL_MIN), min(INNER_COL_MAX - 2, PUSH_CENTER_COL_MAX))
    d = 2
    ax, ay = bx - d, by
    cx, cy = bx + d, by
    for c in [(ax, ay), (bx, by), (cx, cy)]:
        used_positions.add(c)
    return ax, ay, bx, by, cx, cy


def place_push_tr_positions_with_loc(lx, ly, used_positions):
    """Place push-tr when LOC is present: OBJ (pushed) ends near LOC; same direction and distance for both movements.
    In end state, SUBJ (at contact B) must be at least one grid farther from LOC than OBJ (at C).
    Returns (pusher_sx, pusher_sy, pushed_x, pushed_y, end_x, end_y) with end_x/end_y near (lx, ly)."""
    # C = pushed end = near LOC (like GO-INTR end state near LOC)
    cx, cy = use_cell_near(lx, ly, used_positions, central=True)
    dist_c = movement_distance(cx, cy, lx, ly)
    for _ in range(80):
        dx, dy = random.choice(PUSH_DIRECTIONS)
        d = random.randint(PUSH_DISTANCE_MIN, PUSH_DISTANCE_MAX)
        bx, by = cx - dx * d, cy - dy * d
        ax, ay = cx - 2 * dx * d, cy - 2 * dy * d
        if not _in_inner_range(ax, ay) or not _in_inner_range(bx, by):
            continue
        if (ax, ay) in used_positions or (bx, by) in used_positions:
            continue
        if (ax, ay) == (bx, by) or (ax, ay) == (cx, cy) or (bx, by) == (cx, cy):
            continue
        # SUBJ ends at B; require SUBJ at least one grid farther from LOC than OBJ (at C)
        if movement_distance(bx, by, lx, ly) < dist_c + 1:
            continue
        used_positions.add((ax, ay))
        used_positions.add((bx, by))
        return ax, ay, bx, by, cx, cy
    # fallback: try all 8 directions (horizontal, vertical, diagonal) with C fixed
    for d in [2, 3]:
        for (ddx, ddy) in PUSH_DIRECTIONS:
            bx, by = cx - ddx * d, cy - ddy * d
            ax, ay = cx - ddx * 2 * d, cy - ddy * 2 * d
            if not _in_inner_range(ax, ay) or not _in_inner_range(bx, by):
                continue
            if (ax, ay) in used_positions or (bx, by) in used_positions:
                continue
            if movement_distance(bx, by, lx, ly) < dist_c + 1:
                continue
            used_positions.add((ax, ay))
            used_positions.add((bx, by))
            return ax, ay, bx, by, cx, cy
    # cannot satisfy LOC constraint; remove C and place without LOC
    used_positions.discard((cx, cy))
    return place_push_tr_positions(used_positions)


def use_cell_from_neighbors_of(ox, oy, used_positions, restrict_to_center_rows=False):
    """Pick a random unused cell from the neighbors of (ox, oy); mark used. For HIDE-TR/REVEAL-TR SUBJ movement.
    If restrict_to_center_rows=True, only consider neighbors in rows 2–3 so vertical pairs stay centered (OBJ row 3 when SUBJ above, row 2 when SUBJ below)."""
    cands = neighbors(ox, oy)
    if restrict_to_center_rows:
        cands = [c for c in cands if SCREEN_CENTER_ROW_MIN <= c[1] <= SCREEN_CENTER_ROW_MAX]
    candidates = [c for c in cands if c not in used_positions]
    if not candidates:
        candidates = cands
    x, y = random.choice(candidates)
    used_positions.add((x, y))
    return x, y


def use_central_cell(used_positions):
    """Pick a random unused cell in the central range; mark used."""
    x, y = random_central_cell()
    for _ in range(50):
        x, y = random_central_cell()
        if (x, y) not in used_positions:
            break
    used_positions.add((x, y))
    return x, y


def use_cell(used_positions, central=False):
    """Pick a random unused cell. If central=True use central range (for SUBJ/LOC), else inner range."""
    if central:
        return use_central_cell(used_positions)
    x, y = random_cell()
    for _ in range(30):
        x, y = random_cell()
        if (x, y) not in used_positions:
            break
    used_positions.add((x, y))
    return x, y


def use_cell_near(lx, ly, used_positions, central=False):
    """Pick a random unused cell from LOC cell + neighbors. If central=True restrict to central range (for SUBJ)."""
    in_range = (
        (lambda c: is_central(c[0], c[1])) if central
        else (lambda c: INNER_COL_MIN <= c[0] <= INNER_COL_MAX and INNER_ROW_MIN <= c[1] <= INNER_ROW_MAX)
    )
    candidates = [
        c for c in cells_near(lx, ly)
        if c not in used_positions and in_range(c)
    ]
    if not candidates:
        fallback = use_central_cell if central else (lambda u: use_cell(u, central=False))
        return fallback(used_positions)
    x, y = random.choice(candidates)
    used_positions.add((x, y))
    return x, y


def valid_go_min_distance(sx, sy, ex, ey):
    """True if (sx,sy)->(ex,ey) meets GO-INTR min movement: 3 in one dimension when only one changes, else 2 in at least one dimension."""
    dx, dy = abs(sx - ex), abs(sy - ey)
    if dy == 0:
        return dx >= 3  # horizontal only
    if dx == 0:
        return dy >= 3  # vertical only
    return dx >= 2 or dy >= 2  # both dimensions change: at least 2 in one


def valid_jump_min_distance(sx, sy, ex, ey):
    """True if (sx,sy)->(ex,ey) meets JUMP-INTR min movement: always at least 3 grids horizontally."""
    return abs(sx - ex) >= 3


def use_central_cell_go_min_distance_from(ex, ey, used_positions, also_min_from=None):
    """Pick a central cell (sx,sy) not in used_positions such that valid_go_min_distance(sx, sy, ex, ey).
    If also_min_from=(lx, ly) is given (LOC position), also require valid_go_min_distance(sx, sy, lx, ly)."""
    for _ in range(120):
        x, y = random_central_cell()
        if (x, y) in used_positions:
            continue
        if not valid_go_min_distance(x, y, ex, ey):
            continue
        if also_min_from is not None:
            lx, ly = also_min_from
            if not valid_go_min_distance(x, y, lx, ly):
                continue
        used_positions.add((x, y))
        return x, y
    return use_central_cell(used_positions)


def use_central_cell_jump_min_distance_from(ex, ey, used_positions, also_min_from=None):
    """Pick a central cell (sx,sy) for JUMP-INTR start: valid_jump_min_distance(sx, sy, ex, ey) (min 3 horizontal).
    If also_min_from=(lx, ly) (LOC), also require valid_go_min_distance(sx, sy, lx, ly)."""
    for _ in range(120):
        x, y = random_central_cell()
        if (x, y) in used_positions:
            continue
        if not valid_jump_min_distance(x, y, ex, ey):
            continue
        if also_min_from is not None:
            lx, ly = also_min_from
            if not valid_go_min_distance(x, y, lx, ly):
                continue
        used_positions.add((x, y))
        return x, y
    return use_central_cell(used_positions)


def build_filename(parsed):
    """Filename order: OBJ — SBJ — VERB — LOC. Include Aa-/Ab- prefix when the sentence
    explicitly used that modifier for the agent (transparency); no prefix when unspecified."""
    parts = []
    verb_key = parsed["verb_key"].replace(".", "-")

    if parsed.get("obj"):
        n_key, var, had_mod = parsed["obj"][0], parsed["obj"][1], parsed["obj"][2]
        mod_str = ("Aa-" if var == "a" else "Ab-") if had_mod else ""
        parts.append((mod_str + "OBJ-" + n_key) if mod_str else ("OBJ-" + n_key))
    if parsed.get("subj"):
        n_key, var, had_mod = parsed["subj"][0], parsed["subj"][1], parsed["subj"][2]
        mod_str = ("Aa-" if var == "a" else "Ab-") if had_mod else ""
        parts.append((mod_str + "SBJ-" + n_key) if mod_str else ("SBJ-" + n_key))
    parts.append(verb_key)
    if parsed.get("loc"):
        n_key, var, had_mod = parsed["loc"][0], parsed["loc"][1], parsed["loc"][2]
        mod_str = ("Aa-" if var == "a" else "Ab-") if had_mod else ""
        parts.append((mod_str + "LOC-" + n_key) if mod_str else ("LOC-" + n_key))

    return "-".join(parts) + ".json"


# ---------------------------------------------------------------------------
# Modifier and distractor rules (pragmatic language)
# ---------------------------------------------------------------------------
# 1. Modifiers (Aa/Ab) are used when the sentence must disambiguate which
#    variant of an agent is meant, because both could be on screen.
# 2. When the sentence does NOT specify a modifier (e.g. "SBJ-N1"), the
#    translator picks a random variant (a or b). No distractor is added.
# 3. When the sentence DOES specify a modifier (e.g. "Ab SBJ-N5"), we normally
#    add the other variant as a static distractor so the listener sees both
#    and can identify the intended one.
# 4. Exception: when the same agent appears in two roles with different
#    modifiers (e.g. "Aa SBJ-N1 GO.INTR Ab LOC-N1"), do NOT add extra
#    distractors—both variants are already on screen (they are each other's
#    distractors).
# ---------------------------------------------------------------------------


def other_role_has_same_agent_different_variant(role_key, role_tuple, parsed):
    """True if another role (SBJ/OBJ/LOC) has the same agent base (e.g. N1) with a different variant (a vs b).
    In that case both variants are already on screen—no extra distractor needed."""
    if not role_tuple:
        return False
    n_key, variant = role_tuple[0], role_tuple[1]
    others = []
    if role_key != "subj":
        others.append(parsed.get("subj"))
    if role_key != "obj":
        others.append(parsed.get("obj"))
    if role_key != "loc":
        others.append(parsed.get("loc"))
    for o in others:
        if o and o[0] == n_key and o[1] != variant:
            return True
    return False


def add_distractor_if_needed(
    agents_list,
    agent_id,
    used_positions,
    had_explicit_modifier_in_sentence,
    other_variant_already_in_scene=False,
    avoid_pos=None,
    min_dist=None,
    use_distractor_range=False,
):
    """Add the other variant (a<->b) as static distractor only when all of:
    - The sentence explicitly used a modifier (Aa/Ab) for this agent.
    - The other variant is not already present in another role (same agent, different modifier).
    No distractor when the translator chose a random variant, or when e.g. 'Aa SBJ-N1' and 'Ab LOC-N1' (they are each other's distractors).
    For GO+LOC: avoid_pos=(ex,ey), min_dist=2, use_distractor_range=True place distractor in cols 1–10, rows 1–4, at least 2 grids from (ex,ey)."""
    if not had_explicit_modifier_in_sentence or other_variant_already_in_scene:
        return
    if agent_id.endswith("-b"):
        other = agent_id[:-2] + "-a"
    elif agent_id.endswith("-a"):
        other = agent_id[:-2] + "-b"
    else:
        return
    if use_distractor_range and avoid_pos is not None and min_dist is not None:
        ax, ay = avoid_pos
        x, y = None, None
        for _ in range(50):
            cx, cy = random_distractor_cell()
            if (cx, cy) not in used_positions and max(abs(cx - ax), abs(cy - ay)) >= min_dist:
                x, y = cx, cy
                break
        if x is None:
            x, y = random_distractor_cell()
            for _ in range(20):
                x, y = random_distractor_cell()
                if (x, y) not in used_positions:
                    break
        used_positions.add((x, y))
    else:
        x, y = random_cell()
        for _ in range(20):
            x, y = random_cell()
            if (x, y) not in used_positions:
                break
        used_positions.add((x, y))
    agents_list.append({
        "agent": other,
        "type": "static",
        "position": {"X": x, "Y": y},
    })


def build_agents(parsed):
    """Build the agents array for the app JSON."""
    m = parsed["mappings"]
    atype = parsed["animation_type"]
    subj = parsed.get("subj")
    obj = parsed.get("obj")
    loc = parsed.get("loc")

    if not subj:
        return []

    subj_id = agent_id(subj[0], subj[1], m) if subj else ""
    obj_id = agent_id(obj[0], obj[1], m) if obj else ""
    loc_id = agent_id(loc[0], loc[1], m) if loc else ""
    # Tuple is (base_key, variant, had_explicit_modifier). Distractor rules: see add_distractor_if_needed docstring.
    had_explicit_modifier_subj = subj[2] if subj else False
    had_explicit_modifier_obj = obj[2] if obj else False
    had_explicit_modifier_loc = loc[2] if loc else False
    other_variant_already_subj = other_role_has_same_agent_different_variant("subj", subj, parsed)
    other_variant_already_obj = other_role_has_same_agent_different_variant("obj", obj, parsed)
    other_variant_already_loc = other_role_has_same_agent_different_variant("loc", loc, parsed)
    used_positions = set()
    agents = []

    # When LOC is present: place locative agent first (central) for go-intr, jump-intr, push-tr.
    # For hide-intr, reveal-intr, hide-tr, reveal-tr, LOC is placed in the verb block (neighbor of SBJ or OBJ).
    lx, ly = None, None
    if loc_id and atype not in ("hide-intr", "reveal-intr", "hide-tr", "reveal-tr"):
        lx, ly = use_central_cell(used_positions)
        agents.append({
            "agent": loc_id,
            "type": "static",
            "position": {"X": lx, "Y": ly},
        })
        if atype not in ("go-intr", "jump-intr", "push-tr"):
            add_distractor_if_needed(agents, loc_id, used_positions, had_explicit_modifier_loc, other_variant_already_loc)

    def pick_cell_subj():
        """Central range: for SUBJ positions (and LOC-near positions)."""
        if lx is not None and ly is not None:
            return use_cell_near(lx, ly, used_positions, central=True)
        return use_central_cell(used_positions)

    def pick_cell_obj():
        """Inner range: for OBJ positions in transitive verbs."""
        return use_cell(used_positions, central=False)

    duration = random_duration()

    if atype == "go-intr":
        # SUBJ must move min 3 horizontally or vertically when only one dimension changes; min 2 in one dimension when both change. Apply with or without LOC.
        if loc_id:
            ex, ey = use_cell_near(lx, ly, used_positions, central=True)
            sx, sy = use_central_cell_go_min_distance_from(ex, ey, used_positions, also_min_from=(lx, ly))
        else:
            ex, ey = pick_cell_subj()
            sx, sy = use_central_cell_go_min_distance_from(ex, ey, used_positions)
        agents.append({
            "agent": subj_id,
            "animationType": "go-intr",
            "animation": {
                "startX": sx, "startY": sy, "endX": ex, "endY": ey,
            },
        })
        add_distractor_if_needed(
            agents, subj_id, used_positions, had_explicit_modifier_subj, other_variant_already_subj,
            avoid_pos=(ex, ey) if loc_id else None, min_dist=2 if loc_id else None, use_distractor_range=bool(loc_id),
        )
        if loc_id:
            add_distractor_if_needed(
                agents, loc_id, used_positions, had_explicit_modifier_loc, other_variant_already_loc,
                avoid_pos=(ex, ey), min_dist=2, use_distractor_range=True,
            )

    elif atype == "jump-intr":
        # Same LOC/SUBJ/distractor rules as GO-INTR; SUBJ movement: min 3 grids horizontally in all cases
        if loc_id:
            ex, ey = use_cell_near(lx, ly, used_positions, central=True)
            sx, sy = use_central_cell_jump_min_distance_from(ex, ey, used_positions, also_min_from=(lx, ly))
        else:
            ex, ey = pick_cell_subj()
            sx, sy = use_central_cell_jump_min_distance_from(ex, ey, used_positions)
        agents.append({
            "agent": subj_id,
            "animationType": "jump-intr",
            "animation": {
                "startX": sx, "startY": sy, "endX": ex, "endY": ey,
            },
        })
        add_distractor_if_needed(
            agents, subj_id, used_positions, had_explicit_modifier_subj, other_variant_already_subj,
            avoid_pos=(ex, ey) if loc_id else None, min_dist=2 if loc_id else None, use_distractor_range=bool(loc_id),
        )
        if loc_id:
            add_distractor_if_needed(
                agents, loc_id, used_positions, had_explicit_modifier_loc, other_variant_already_loc,
                avoid_pos=(ex, ey), min_dist=2, use_distractor_range=True,
            )

    elif atype == "hide-intr":
        x, y = use_screen_center_cell(used_positions)  # SUBJ in center of screen
        agents.append({
            "agent": subj_id,
            "animationType": "hide-intr",
            "animation": {"X": x, "Y": y, "duration": duration},
        })
        add_distractor_if_needed(
            agents, subj_id, used_positions, had_explicit_modifier_subj, other_variant_already_subj,
            avoid_pos=(x, y), min_dist=2, use_distractor_range=True,
        )
        if loc_id:
            lx, ly = use_cell_from_neighbors_of(x, y, used_positions)
            agents.append({
                "agent": loc_id,
                "type": "static",
                "position": {"X": lx, "Y": ly},
            })
            add_distractor_if_needed(
                agents, loc_id, used_positions, had_explicit_modifier_loc, other_variant_already_loc,
                avoid_pos=(x, y), min_dist=2, use_distractor_range=True,
            )

    elif atype == "reveal-intr":
        x, y = use_screen_center_cell(used_positions)  # SUBJ in center of screen
        agents.append({
            "agent": subj_id,
            "animationType": "reveal-intr",
            "animation": {"X": x, "Y": y, "duration": duration},
        })
        add_distractor_if_needed(
            agents, subj_id, used_positions, had_explicit_modifier_subj, other_variant_already_subj,
            avoid_pos=(x, y), min_dist=2, use_distractor_range=True,
        )
        if loc_id:
            lx, ly = use_cell_from_neighbors_of(x, y, used_positions)
            agents.append({
                "agent": loc_id,
                "type": "static",
                "position": {"X": lx, "Y": ly},
            })
            add_distractor_if_needed(
                agents, loc_id, used_positions, had_explicit_modifier_loc, other_variant_already_loc,
                avoid_pos=(x, y), min_dist=2, use_distractor_range=True,
            )

    elif atype == "push-tr":
        if not obj_id:
            return []
        if loc_id:
            pusher_sx, pusher_sy, pushed_x, pushed_y, end_x, end_y = place_push_tr_positions_with_loc(lx, ly, used_positions)
        else:
            pusher_sx, pusher_sy, pushed_x, pushed_y, end_x, end_y = place_push_tr_positions(used_positions)
        agents.append({
            "agent": subj_id,
            "animationType": "push-tr",
            "animation": {
                "role": "pusher",
                "startX": pusher_sx, "startY": pusher_sy,
                "endX": pushed_x, "endY": pushed_y,
                "duration": DURATION_PUSH_TR,
            },
        })
        agents.append({
            "agent": obj_id,
            "animationType": "push-tr",
            "animation": {
                "role": "pushed",
                "startX": pushed_x, "startY": pushed_y,
                "endX": end_x, "endY": end_y,
                "duration": DURATION_PUSH_TR,
            },
        })
        add_distractor_if_needed(
            agents, subj_id, used_positions, had_explicit_modifier_subj, other_variant_already_subj,
            avoid_pos=(end_x, end_y) if loc_id else None, min_dist=2 if loc_id else None, use_distractor_range=bool(loc_id),
        )
        add_distractor_if_needed(agents, obj_id, used_positions, had_explicit_modifier_obj, other_variant_already_obj)
        if loc_id:
            add_distractor_if_needed(
                agents, loc_id, used_positions, had_explicit_modifier_loc, other_variant_already_loc,
                avoid_pos=(end_x, end_y), min_dist=2, use_distractor_range=True,
            )

    elif atype == "hide-tr":
        if not obj_id:
            return []
        ox, oy = use_screen_center_cell(used_positions)  # OBJ in center (col 6, rows 2–3)
        if loc_id:
            lx, ly = use_cell_from_neighbors_of(ox, oy, used_positions)
            agents.append({
                "agent": loc_id,
                "type": "static",
                "position": {"X": lx, "Y": ly},
            })
            add_distractor_if_needed(
                agents, loc_id, used_positions, had_explicit_modifier_loc, other_variant_already_loc,
                avoid_pos=(ox, oy), min_dist=2, use_distractor_range=True,
            )
        sx, sy = use_cell_from_neighbors_of(ox, oy, used_positions, restrict_to_center_rows=True)  # SUBJ in neighbor; vertical => OBJ row 3 if SUBJ above, row 2 if SUBJ below
        agents.append({
            "agent": obj_id,
            "type": "static",
            "position": {"X": ox, "Y": oy},
        })
        agents.append({
            "agent": subj_id,
            "animationType": "hide-tr",
            "animation": {
                "startX": sx, "startY": sy, "endX": ox, "endY": oy,
                "duration": duration,
            },
        })
        add_distractor_if_needed(
            agents, subj_id, used_positions, had_explicit_modifier_subj, other_variant_already_subj,
            avoid_pos=(ox, oy), min_dist=2, use_distractor_range=True,
        )
        add_distractor_if_needed(
            agents, obj_id, used_positions, had_explicit_modifier_obj, other_variant_already_obj,
            avoid_pos=(ox, oy), min_dist=2, use_distractor_range=True,
        )

    elif atype == "reveal-tr":
        if not obj_id:
            return []
        ox, oy = use_screen_center_cell(used_positions)  # OBJ in center (col 6, rows 2–3)
        if loc_id:
            lx, ly = use_cell_from_neighbors_of(ox, oy, used_positions)
            agents.append({
                "agent": loc_id,
                "type": "static",
                "position": {"X": lx, "Y": ly},
            })
            add_distractor_if_needed(
                agents, loc_id, used_positions, had_explicit_modifier_loc, other_variant_already_loc,
                avoid_pos=(ox, oy), min_dist=2, use_distractor_range=True,
            )
        ex, ey = use_cell_from_neighbors_of(ox, oy, used_positions, restrict_to_center_rows=True)  # SUBJ end in neighbor; vertical => OBJ row 3 if SUBJ above, row 2 if SUBJ below
        agents.append({
            "agent": obj_id,
            "type": "static",
            "position": {"X": ox, "Y": oy},
        })
        agents.append({
            "agent": subj_id,
            "animationType": "reveal-tr",
            "animation": {
                "startX": ox, "startY": oy, "endX": ex, "endY": ey,
                "duration": duration,
            },
        })
        add_distractor_if_needed(
            agents, subj_id, used_positions, had_explicit_modifier_subj, other_variant_already_subj,
            avoid_pos=(ox, oy), min_dist=2, use_distractor_range=True,
        )
        add_distractor_if_needed(
            agents, obj_id, used_positions, had_explicit_modifier_obj, other_variant_already_obj,
            avoid_pos=(ox, oy), min_dist=2, use_distractor_range=True,
        )

    return agents


def main():
    parser = argparse.ArgumentParser(
        description="Translate coded sentences (CSV) to app JSON files (one per row)."
    )
    parser.add_argument(
        "input",
        nargs="?",
        default="sentences.csv",
        help="Input CSV file (default: sentences.csv in current dir)",
    )
    parser.add_argument(
        "-o", "--output-dir",
        default="output",
        help="Output directory for JSON files (default: output)",
    )
    parser.add_argument(
        "-m", "--mappings",
        default="code-mappings.json",
        help="Path to code-mappings.json (default: code-mappings.json in current dir)",
    )
    parser.add_argument(
        "-c", "--column",
        type=int,
        default=0,
        help="CSV column index for the sentence (default: 0)",
    )
    parser.add_argument(
        "--no-header",
        action="store_true",
        help="CSV has no header row",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Random seed for reproducible output",
    )
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    script_dir = Path(__file__).resolve().parent
    mappings_path = Path(args.mappings) if os.path.isabs(args.mappings) else script_dir / args.mappings
    input_path = Path(args.input) if os.path.isabs(args.input) else script_dir / args.input
    output_dir = Path(args.output_dir) if os.path.isabs(args.output_dir) else script_dir / args.output_dir

    mappings = load_mappings(mappings_path)
    if not mappings.get("agentBases"):
        print("Error: code-mappings.json missing or empty 'agentBases'")
    if not mappings.get("modifiers"):
        print("Error: code-mappings.json missing or empty 'modifiers'")
    if not mappings.get("actions"):
        print("Error: code-mappings.json missing or empty 'actions'")

    output_dir.mkdir(parents=True, exist_ok=True)

    written_names = []

    with open(input_path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        if not args.no_header:
            next(reader, None)
        for row in reader:
            if len(row) <= args.column:
                print(f"Error: row has insufficient columns (column index {args.column}, row length {len(row)}): {row}")
                continue
            sentence = row[args.column].strip()
            if not sentence:
                print(f"Error: empty sentence in row: {row}")
                continue
            parsed = parse_sentence(sentence, mappings)
            if not parsed:
                print(f"Error: no verb found in sentence: {sentence}")
                continue
            agents = build_agents(parsed)
            if not agents:
                print(f"Error: no agents built (missing subject or object for transitive verb): {sentence}")
                continue
            name = build_filename(parsed)
            out_path = output_dir / name
            payload = {"agentSize": AGENT_SIZE, "agents": agents}
            with open(out_path, "w", encoding="utf-8") as out:
                json.dump(payload, out, indent=2)
            written_names.append(name)
            print(f"Wrote {out_path.name}")

    # Write sequence list for the app (one JSON filename per line, same order)
    list_path = output_dir / "sequence-list.txt"
    with open(list_path, "w", encoding="utf-8") as f:
        f.write("\n".join(written_names))
    print(f"Wrote {list_path.name}")


if __name__ == "__main__":
    main()
