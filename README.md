# Language game

A browser player for short agent animations. Each scene is a JSON file: agents on a 13×6 grid, with a motion type and a start and end cell. The page can play a playlist of those scenes, or loop a single scene for another page to embed.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://127.0.0.1:5173/`).

```bash
npm run build
npm run preview
```

`npm run build` writes `dist/`. Vite’s base is `./`, so that folder can be hosted from a subfolder. Scene files are not bundled. They are fetched when the page loads, so a hosted build needs `sequences/` (or whatever path `?scene=` points at) available next to the page.

## Playlist

With no query string, the player reads `sequences/sequence_list.txt` (one JSON filename per line) and plays `sequences/<filename>` in order.

Between scenes it holds the start pose, plays the motion, holds the end pose, pauses, then shows a solid black frame. The black frame is there so a recording can be split on a dark frame. Timings:

| Gap | Duration |
| --- | --- |
| Hold before the motion | 1.5 s |
| Hold after the motion | 1.5 s |
| Pause | 1 s |
| Black divider | 1.5 s |

## One scene

Add `?scene=` to loop a single JSON file. The value is the address of that file, relative to the player page. This mode does not read `sequences/sequence_list.txt`.

```text
index.html?scene=sequences/SBJ-N1-JUMP-INTR-LOC-N4.json
```

The scene loops as soon as one play finishes. There is no pre-hold, post-hold, pause, or black divider. The page background is white and the animation is centered. The player does not play audio; the parent page plays the sentence.

Each time a play finishes and the loop starts again, the player posts this to the parent window:

```json
{ "source": "brocanto-scene", "type": "loop" }
```

The first play does not send that message. A parent can listen like this:

```html
<iframe id="scene" src="index.html?scene=sequences/SBJ-N1-JUMP-INTR-LOC-N4.json"></iframe>
<script>
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== "brocanto-scene" || data.type !== "loop") return;
    // one play finished and the animation started again
  });
</script>
```

## Scene files

Positions are grid cells. Columns run `0`–`12`, rows `0`–`5`. The grid is stretched to the viewport. `agentSize` is the agent’s width and height in pixels (default 100). An agent is either `"type": "static"` with a `position`, or an `animationType` with an `animation` object.

Motion types: `go-intr`, `jump-intr`, `hide-intr`, `reveal-intr`, `push-tr`, `hide-tr`, `reveal-tr`.

Agent names: `agent-1-a`, `agent-1-b`, `agent-2-a`, `agent-2-b`, `agent-3-a`, `agent-3-b`, `agent-4-a`, `agent-4-b`, `agent-5-a`, `agent-5-b`.

Field-by-field notes are in `config-documentation.txt`. `config.json` is a sample scene in that format. The playlist itself is the files named in `sequences/sequence_list.txt`.

## Layout

| Path | Role |
| --- | --- |
| `sequence.jsx` | Page entry. Chooses playlist or `?scene=`. |
| `main.jsx` | Draws one scene from a JSON config. |
| `components/sequence/player.jsx` | Playlist timing, the black divider, and the single-scene loop. |
| `components/motions/` | Motion implementations. |
| `components/items/` | Agent SVG components. |
| `components/board/grid.js` | Grid size and cell-to-pixel conversion. |
| `sequences/` | Scene JSON files and `sequence_list.txt`. |
| `assets/` | Agent SVGs. |
