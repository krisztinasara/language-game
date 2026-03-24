#!/usr/bin/env python3
"""
Split a screen recording of the sequence player by black-screen boundaries.

The sequence player shows a full-screen black divider (DIVIDER_DURATION_MS = 1500)
between each animation. This script:
  1. Scans the video for black frames (low mean luminance).
  2. Finds contiguous black intervals (divider screens).
  3. Cuts the video into segments (one per animation).
  4. Saves each segment with the same base name as its source JSON from
     sequence-list.txt (e.g. SBJ-N3-GO-INTR.json -> SBJ-N3-GO-INTR.mp4).

  The video itself has no labels; segment order (1st content block, 2nd, ...)
  is matched 1:1 to the line order in sequence-list.txt.

Usage:
  python scripts/split_video_by_black.py video.mp4
  python scripts/split_video_by_black.py video.mp4 --list sequences/sequence-list.txt --out ./clips
"""

import argparse
import os
import sys
from pathlib import Path

try:
    import cv2
except ImportError:
    print("Error: opencv-python is required. Install with: pip install opencv-python", file=sys.stderr)
    sys.exit(1)


# Match sequence player: black divider is 1500 ms
DEFAULT_MIN_BLACK_DURATION_SEC = 1.0
# Frame is "black" if mean pixel value is below this (0–255)
BLACK_THRESHOLD = 25
# Sample every N frames to speed up detection (then refine boundaries)
SAMPLE_STEP = 5


def get_video_fps(cap):
    return cap.get(cv2.CAP_PROP_FPS) or 30.0


def frame_to_sec(frame_index: int, fps: float) -> float:
    return frame_index / fps


def sec_to_frame(sec: float, fps: float) -> int:
    return int(round(sec * fps))


def is_black_frame(frame, threshold: int = BLACK_THRESHOLD) -> bool:
    if frame is None or frame.size == 0:
        return True
    # Grayscale mean; allow slight noise
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return float(gray.mean()) < threshold


def find_black_intervals(
    video_path: str,
    black_threshold: int = BLACK_THRESHOLD,
    min_black_duration_sec: float = DEFAULT_MIN_BLACK_DURATION_SEC,
    sample_step: int = SAMPLE_STEP,
):
    """
    Scan video and return list of (start_frame, end_frame) for each black interval.
    Frames are 0-based inclusive [start, end].
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = get_video_fps(cap)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    min_black_frames = max(1, sec_to_frame(min_black_duration_sec, fps))

    # Coarse pass: read sequentially and sample every SAMPLE_STEP frames (no seeking = fast)
    black_runs = []  # list of (start, end) in sampled indices
    in_black = False
    run_start = None
    frame_idx = 0
    last_progress_sec = -1.0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        # Progress every 10 seconds of video
        if total_frames > 0 and fps > 0:
            t_sec = frame_to_sec(frame_idx, fps)
            sec_int = int(t_sec)
            if sec_int != last_progress_sec and sec_int > 0 and sec_int % 10 == 0:
                print(f"  ... scan at {sec_int}s")
                last_progress_sec = sec_int
        if frame_idx % sample_step == 0:
            black = is_black_frame(frame, black_threshold)
            if black:
                if not in_black:
                    in_black = True
                    run_start = frame_idx
            else:
                if in_black:
                    run_end = frame_idx - 1
                    if run_end - run_start + 1 >= min_black_frames:
                        black_runs.append((run_start, run_end))
                    in_black = False
        frame_idx += 1

    if in_black and frame_idx - run_start >= min_black_frames:
        black_runs.append((run_start, frame_idx - 1))

    cap.release()

    # Refine boundaries: from first black to last black within each run
    intervals = []
    cap = cv2.VideoCapture(video_path)
    for (coarse_start, coarse_end) in black_runs:
        # Refine start: step backward from coarse_start
        start = coarse_start
        for i in range(coarse_start, max(-1, coarse_start - sample_step * 2), -1):
            if i < 0:
                break
            cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            ret, frame = cap.read()
            if ret and is_black_frame(frame, black_threshold):
                start = i
            else:
                break
        # Refine end: step forward from coarse_end
        end = min(coarse_end, total_frames - 1)
        for i in range(coarse_end + 1, min(total_frames, coarse_end + sample_step * 2 + 1)):
            cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            ret, frame = cap.read()
            if ret and is_black_frame(frame, black_threshold):
                end = i
            else:
                break
        intervals.append((start, end))
    cap.release()

    return intervals, fps, total_frames


def build_segments(black_intervals, total_frames: int):
    """
    Convert black intervals to content segments [start_frame, end_frame] (inclusive).
    Segment i is the content between black interval i-1 and black interval i.
    """
    if not black_intervals:
        return [(0, total_frames - 1)] if total_frames else []

    segments = []
    # First segment: from start of video to frame before first black
    first_black_start = black_intervals[0][0]
    if first_black_start > 0:
        segments.append((0, first_black_start - 1))

    for i in range(len(black_intervals) - 1):
        end_after_black = black_intervals[i][1] + 1
        start_before_next_black = black_intervals[i + 1][0] - 1
        if end_after_black <= start_before_next_black:
            segments.append((end_after_black, start_before_next_black))

    # Last segment: from frame after last black to end of video
    last_black_end = black_intervals[-1][1]
    if last_black_end + 1 < total_frames:
        segments.append((last_black_end + 1, total_frames - 1))

    return segments


def load_sequence_list(path: str) -> list[str]:
    """Load sequence list: one JSON filename per line (trimmed, non-empty)."""
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(f"Sequence list not found: {path}")
    names = []
    for line in p.read_text(encoding="utf-8").splitlines():
        name = line.strip()
        if name:
            names.append(name)
    return names


def extract_segment(
    video_path: str,
    out_path: str,
    start_frame: int,
    end_frame: int,
    fps: float,
):
    """Write a segment to out_path using OpenCV (same codec as input where possible)."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))
    if fourcc == 0:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    out = cv2.VideoWriter(out_path, fourcc, fps, (w, h))
    if not out.isOpened():
        cap.release()
        raise RuntimeError(f"Cannot create output: {out_path}")

    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    for _ in range(start_frame, end_frame + 1):
        ret, frame = cap.read()
        if not ret:
            break
        out.write(frame)
    out.release()
    cap.release()


def main():
    parser = argparse.ArgumentParser(
        description="Split a sequence player recording by black-screen boundaries and save clips with JSON base names."
    )
    parser.add_argument(
        "video",
        help="Path to the recorded video file",
    )
    parser.add_argument(
        "--list",
        "-l",
        default="sequences/sequence-list.txt",
        help="Path to sequence-list.txt (default: sequences/sequence-list.txt)",
    )
    parser.add_argument(
        "--out",
        "-o",
        default=None,
        help="Output directory for clips (default: same as video directory)",
    )
    parser.add_argument(
        "--min-black-duration",
        type=float,
        default=DEFAULT_MIN_BLACK_DURATION_SEC,
        help=f"Minimum black duration in seconds to count as divider (default: {DEFAULT_MIN_BLACK_DURATION_SEC})",
    )
    parser.add_argument(
        "--black-threshold",
        type=int,
        default=BLACK_THRESHOLD,
        help=f"Frame mean luminance below this is black (0–255, default: {BLACK_THRESHOLD})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only print segment boundaries and output names, do not write files",
    )
    args = parser.parse_args()

    video_path = Path(args.video).resolve()
    if not video_path.is_file():
        print(f"Error: Video file not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    # Resolve paths relative to project root (script lives in scripts/)
    project_root = Path(__file__).resolve().parent.parent
    list_path = (project_root / args.list).resolve()
    if args.out is not None:
        out_dir = Path(args.out).resolve()
    else:
        out_dir = video_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        names = load_sequence_list(list_path)
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        sys.exit(1)

    print("Scanning for black intervals...")
    try:
        black_intervals, fps, total_frames = find_black_intervals(
            str(video_path),
            black_threshold=args.black_threshold,
            min_black_duration_sec=args.min_black_duration,
        )
    except Exception as e:
        print(f"Error analyzing video: {e}", file=sys.stderr)
        sys.exit(1)

    segments = build_segments(black_intervals, total_frames)
    print(f"Found {len(black_intervals)} black interval(s), {len(segments)} content segment(s).")
    print(f"Sequence list has {len(names)} name(s).")

    if len(segments) != len(names):
        print(
            f"Warning: Segment count ({len(segments)}) does not match sequence list length ({len(names)}). "
            "Output names will be truncated or extended by index.",
            file=sys.stderr,
        )

    suffix = video_path.suffix.lower()
    if suffix not in (".mp4", ".avi", ".mov", ".webm", ".mkv"):
        suffix = ".mp4"

    for i, (start_f, end_f) in enumerate(segments):
        base = names[i] if i < len(names) else f"segment_{i:02d}"
        if base.endswith(".json"):
            base = base[:-5]
        out_name = base + suffix
        out_path = out_dir / out_name

        start_sec = frame_to_sec(start_f, fps)
        end_sec = frame_to_sec(end_f, fps)
        print(f"  Segment {i}: frames {start_f}-{end_f} ({start_sec:.2f}s - {end_sec:.2f}s) -> {out_name}")

        if not args.dry_run:
            try:
                extract_segment(str(video_path), str(out_path), start_f, end_f, fps)
            except Exception as e:
                print(f"Error writing {out_path}: {e}", file=sys.stderr)
                sys.exit(1)

    print("Done.")


if __name__ == "__main__":
    main()
