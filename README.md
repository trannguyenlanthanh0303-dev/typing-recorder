# Typing Recorder

A single static `index.html` with no dependencies and no backend. Participants write one short text message (up to 200 characters) for a texting prompt, on an on-screen keyboard that copies their phone's own keyboard. All labels are visible and the text shows as it's typed: the aim is to record natural typing behaviour, not to test memory. Every tap is recorded so the session can be replayed and analyzed.

Sister project of [memory-typing-game](https://github.com/truongkimson/memory-typing-game).

## Flow: two passes (as in the Finger Reach Test)
1. **Pass 1, most comfortable grip:** one hand or two, any fingers or thumbs.
2. **Pass 2, non-dominant hand, thumb only:** the keyboard accepts one touch at a time. Extra fingers are ignored and don't type, but they're recorded as `blocked`.

Both passes use the same prompt, e.g. *"Imagine you're texting your friend to tell them about your day. Write a short text of no more than 200 characters."* The participant writes a fresh message each time. A short summary appears after pass 1, and the final results compare the two passes.

## Keyboard
Skins: `ios`, `gboard`, `samsung`. Each has three layers: letters, numbers + symbols, and more symbols. It works like a real phone keyboard:
- shift for one capital, double-tap shift for caps lock, auto-capitals at the start and after `. ! ?` or a new line;
- ⌫ deletes on touch-down and repeats while held (after 500 ms, every 100 ms);
- a double space after a word types `. `;
- on iPhone, typing a space or `'` on a number layer returns to letters;
- return/enter types a new line. The message is sent with the **Send** button above the keyboard, as in a messaging app.

There's no autocorrect, word suggestions, emoji, cursor movement or text selection. The emoji, globe and mic keys don't type anything, but taps on them are recorded. Key geometry is estimated, not measured on real devices.

## Run / host
- Local: `python3 -m http.server 8000`, then open `http://<your-LAN-ip>:8000/` on a phone.
- Real use: put `index.html` on any static HTTPS host. The native share sheet needs HTTPS.
- iPhone Safari can't hide its own browser bars. For true full screen, participants use **Share → Add to Home Screen**.

## URL parameters
| Param | Meaning |
|---|---|
| `?p=1` | Fixed prompt (1–5, see `PROMPTS`). Otherwise the prompt is picked from the seed. |
| `?seed=abc` | Fixed seed, so the same prompt for everyone (unless `p` is set). |
| `?kb=ios\|gboard\|samsung` | Force a keyboard skin. By default it's detected: iOS → `ios`, Samsung (model `SM-…`) → `samsung`, other Android → `gboard`. |

## Collecting data
Recordings are only JSON files; there's no replay link, because a whole message's taps are too big for a URL. **Share recording** sends `typing-recorder-<seed>.json` through the phone's share sheet. Chrome on Android can't share `.json`, so there it's sent as `.txt` with the same JSON. If the share sheet can't send files, the file is downloaded. To look at a file again, use **Load a recording** on the intro screen.

## Recording format (v1)
```json
{
  "app": "typing-recorder", "v": 1, "kb": "ios", "seed": "k3j9",
  "prompt": "Imagine you're texting your friend to tell them about your day.", "limit": 200,
  "passes": [
    { "grip": "comfortable", "text": "Hi! Long day…", "send": 41250,
      "ev": [[1830, 92, "H", 612, 380, "A"], [2010, 85, "i", 776, 90, "a"], [2400, 640, "bksp", 955, 630, "a"], [2900, 0, "rep", 955, 630, "a"]] },
    { "grip": "nondominant-thumb", "text": "…", "send": 52010, "ev": [], "blocked": [[1210, "n", 702, 640, "a"]] }
  ]
}
```
- `text`: the message as sent. It can be rebuilt from `ev`; it's included for convenience.
- `send`: ms after the prompt appeared when Send was tapped.
- `ev`: `[t, holdMs, key, x, y, layer]`, in the order the keys took effect.
  - `t` is the touch-down time, in ms after the prompt appeared.
  - `key` is one of:
    - the character typed: a single character, with capitals as typed and `" "` for space;
    - `enter` (a new line);
    - `bksp` (a ⌫ press; it deletes at touch-down);
    - `rep` (each extra delete while ⌫ is held, with `holdMs` 0);
    - a key that types nothing: `shift`, `123`, `sym` (second symbol layer), `abc`, `emoji`, `globe`, `mic`.
  - Every key except `bksp`/`rep` takes effect on release, at `t + holdMs`.
  - `x` is 0–1000 across the keyboard width. `y` is 0 (top of the first key row) to 1000 (bottom of the last row). The iPhone globe/mic strip gives values above 1000.
  - `layer` shows what was on screen when the key took effect: `a` lowercase, `A` shift, `C` caps lock, `1` numbers, `2` more symbols.
- `blocked`: touches ignored during the one-touch pass, as `[t, key, x, y, layer]`. Only present when there's at least one.
- No participant or device information is stored, apart from the keyboard skin. The message text is stored, so participants are told not to write anything private.

The metrics in the app are computed from `ev`: characters, WPM (5 chars = 1 word, from the first to the last typed character), time to first key, total time, taps, deletions, median hold, and the median gap between taps.

## Tests
```sh
python3 -m http.server 8765          # repo root
cd tests && npm install && npm run e2e   # needs Node 20+ and Google Chrome
```
The test types two messages on each skin through the real keyboard: capitals, symbol layers, double-space period, ⌫, held ⌫, caps lock and a blocked touch. It then checks that the text rebuilds exactly from the events, the file round trip, the replay, and the edit rules (200-character limit, iOS layer return, auto-capitals). Screenshots go to `tests/out/`.
