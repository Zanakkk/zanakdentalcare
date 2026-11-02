"""Generate an upbeat background track + sound effects for the reel.

Everything is synthesized here (no samples, no external services), so the
audio is royalty-free. Usage: python3 music.py out.wav '{"duration":26,...}'
"""
import json
import sys
import wave

import numpy as np

SR = 44100
out_path, cfg = sys.argv[1], json.loads(sys.argv[2])
dur = cfg["duration"]
n = int(SR * dur)
mix = np.zeros(n)
BPM = 112
beat = 60 / BPM


def add(sig, at, gain=1.0):
    i = int(at * SR)
    if i >= n:
        return
    sig = sig[: n - i]
    mix[i : i + len(sig)] += sig * gain


def env(length, attack=0.005, release=None):
    t = np.arange(int(length * SR)) / SR
    e = np.minimum(1, t / attack)
    if release:
        e *= np.exp(-t / release)
    return t, e


def kick():
    t, e = env(0.35, 0.001, 0.12)
    freq = 45 + 110 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(freq) / SR) * e


def hat():
    t, e = env(0.06, 0.001, 0.015)
    noise = np.random.default_rng(1).standard_normal(len(t))
    return np.diff(noise, prepend=0) * e * 0.5


def clap():
    t, e = env(0.18, 0.001, 0.05)
    return np.random.default_rng(2).standard_normal(len(t)) * e * 0.6


def note(freq, length, wave_type="saw", release=0.25):
    t, e = env(length, 0.01, release)
    if wave_type == "saw":
        s = sum(np.sin(2 * np.pi * freq * k * t) / k for k in range(1, 7))
    else:
        s = np.sin(2 * np.pi * freq * t)
    return s * e


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


# I - V - vi - IV in C major
chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]
bars = int(dur / (beat * 4)) + 1
for b in range(bars):
    t0 = b * beat * 4
    ch = chords[b % 4]
    for k in range(4):
        add(kick(), t0 + k * beat, 0.9)
        add(hat(), t0 + k * beat + beat / 2, 0.35)
    add(clap(), t0 + beat, 0.25)
    add(clap(), t0 + 3 * beat, 0.25)
    # bass on offbeat eighths
    for k in range(8):
        add(note(midi(ch[0] - 24), beat / 2, "saw", 0.08), t0 + k * beat / 2, 0.16)
    # plucky chord stabs
    for k in (0, 1.5, 2.5, 3.5):
        for m in ch:
            add(note(midi(m), 0.3, "saw", 0.09), t0 + k * beat, 0.05)
    # simple lead arpeggio from bar 2
    if b >= 2:
        for k, m in enumerate([ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12]):
            add(note(midi(m), 0.2, "sine", 0.12), t0 + k * beat + beat * 0.25, 0.08)


# sound effects
def whoosh():
    t, _ = env(0.6)
    noise = np.random.default_rng(3).standard_normal(len(t))
    e = np.sin(np.pi * t / 0.6) ** 2
    lp = np.convolve(noise, np.ones(12) / 12, mode="same")
    return lp * e * 1.4


def pop():
    t, e = env(0.12, 0.001, 0.04)
    return np.sin(2 * np.pi * (600 + 900 * np.exp(-t * 40)) * t) * e


def ding():
    return note(midi(84), 0.8, "sine", 0.3) + 0.5 * note(midi(91), 0.8, "sine", 0.25)


for b in cfg["scenes"][1:-1]:
    add(whoosh(), b - 0.3, 0.45)
for c in cfg["cards"]:
    add(pop(), c + 0.05, 0.35)
add(pop(), cfg["click"], 0.6)  # button click
add(ding(), cfg["scenes"][1] + 0.3, 0.25)  # logo reveal

# fade in/out + normalize
fade = np.ones(n)
fi, fo = int(0.3 * SR), int(1.8 * SR)
fade[:fi] = np.linspace(0, 1, fi)
fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.4) * 0.85
pcm = (mix * 32767).astype(np.int16)
stereo = np.column_stack([pcm, pcm]).ravel()
with wave.open(out_path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(stereo.tobytes())
