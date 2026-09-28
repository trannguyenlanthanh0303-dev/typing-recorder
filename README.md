# Typing Recorder

A single static `index.html` with no dependencies and no backend. Participants write short text messages (up to 200 characters each) for 2 texting prompts, on an on-screen keyboard that copies their phone's own keyboard. All labels are visible and the text shows as it's typed: the aim is to record natural typing behaviour, not to test memory. Every tap is recorded so the session can be replayed and analyzed.

Sister project of [memory-typing-game](https://github.com/trannguyenlanthanh0303-dev/memory-typing-game).

## Flow: 2 prompts × 2 grips
Every participant goes through the same 2 prompts, in order (`PROMPTS` in the script):
1. "Imagine you're texting your friend to tell them about your day."
2. "Imagine you're texting a friend to ask them for a small favour."

The test has two parts (grips as in the Finger Reach Test). Each part covers both prompts:
- **Part 1, most comfortable grip:** one hand or two, any fingers or thumbs.
- **Part 2, non-dominant hand, thumb only:** the keyboard accepts one touch at a time. Extra fingers are ignored and don't type, but they're recorded as `blocked`.

That makes 4 texts. Each part opens with a one-line grip instruction, and there's a short "Next prompt" screen with a grip reminder between prompts. The results show per-grip averages per text, then both texts for each prompt. Replay goes in the order the texts were written.

## Keyboard
Skins: `ios`, `gboard`, `samsung`. Each has three layers: letters, numbers + symbols, and more symbols. It works like a real phone keyboard:
- shift for one capital, double-tap shift for caps lock, auto-capitals at the start and after `. ! ?` or a new line;
- ⌫ deletes on touch-down and repeats while held (after 500 ms, every 100 ms);
- a double space after a word types `. `;
- on iPhone, typing a space or `'` on a number layer returns to letters;
- return/enter types a new line. The message is sent with the **Send** button above the keyboard, as in a messaging app.

There's no autocorrect, word suggestions, emoji, cursor movement or text selection. The emoji, globe and mic keys don't type anything, but taps on them are recorded. Samsung's letters page and first symbols page (`!#1`) are measured from screenshots of a real One UI keyboard with **Number keys** turned on, as on the reference phone: 5 rows, with a shorter number row on top. Samsung's `2/2` page, the Samsung layout without the number row (`?nr=0`), and the iOS and Gboard skins are estimated. The empty suggestion/toolbar strip above the keys is kept at its real height, but its icons aren't drawn.

## Run / host
- Local: `python3 -m http.server 8000`, then open `http://<your-LAN-ip>:8000/` on a phone.
- Real use: put `index.html` on any static HTTPS host. The native share sheet needs HTTPS.
- iPhone Safari can't hide its own browser bars. For true full screen, participants add the test to their Home Screen: the intro shows the steps for their browser (Safari, Chrome, iPad), or a link to the hosted copy when the page is embedded.

## URL parameters
| Param | Meaning |
|---|---|
| `?seed=abc` | Session id used in the file name (random by default). |
| `?nr=0` | Samsung only: letters page without the number row (for people who turned **Number keys** off). |
| `?kb=ios\|gboard\|samsung` | Force a keyboard skin. By default it's detected: iOS → `ios`, Samsung (model `SM-…`) → `samsung`, other Android → `gboard`. |

## Collecting data
Recordings are only files; there's no replay link, because a whole message's taps are too big for a URL. **Share recording** sends `typing-recorder-<seed>.txt` through the phone's share sheet. The file is plain text holding JSON: Chrome on Android won't share `.json` files and downloads them instead. If the share sheet can't send files, the `.txt` is downloaded. To look at a file again, use **Load a recording** on the intro screen. It opens `.txt` recordings and older `.json` ones.

## Recording format (v2)
The `.txt` file's content is this JSON:
```json
{
  "app": "typing-recorder", "v": 2, "kb": "ios", "seed": "k3j9", "limit": 200,
  "rounds": [
    { "prompt": "Imagine you're texting your friend to tell them about your day.",
      "passes": [
        { "grip": "comfortable", "text": "Hi! Long day…", "send": 41250,
          "ev": [[1830, 92, "H", 612, 380, "A"], [2010, 85, "i", 776, 90, "a"], [2400, 640, "bksp", 955, 630, "a"], [2900, 0, "rep", 955, 630, "a"]] },
        { "grip": "nondominant-thumb", "text": "…", "send": 52010, "ev": [], "blocked": [[1210, "n", 702, 640, "a"]] }
      ] },
    { "prompt": "Imagine you're texting a friend to ask them for a small favour.", "passes": [] }
  ]
}
```
- `rounds`: one per prompt, in prompt order. `passes`: that prompt's two texts (comfortable, then non-dominant thumb). The writing order was: both comfortable texts, then both thumb texts.
- `text`: the message as sent. It can be rebuilt from `ev`; it's included for convenience.
- `send`: ms after the prompt appeared when Send was tapped. Every text has its own clock.
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
- Older v1 files (a single `prompt` with top-level `passes`) still load, as one round.
- No participant or device information is stored, apart from the keyboard skin. The message text is stored, so participants are told not to write anything private.

The metrics in the app are computed from `ev`: characters, WPM (5 chars = 1 word, from the first to the last typed character), time to first key, total time, taps, deletions, and the median gap between taps.

## Tests
```sh
python3 -m http.server 8765          # repo root
cd tests && npm install && npm run e2e   # needs Node 20+ and Google Chrome
```
The test goes through both prompts × 2 grips on each skin through the real keyboard: capitals, symbol layers, double-space period, ⌫, held ⌫, caps lock and a blocked touch. It then checks that the text rebuilds exactly from the events, that **Share recording** sends one `.txt` file (and downloads a `.txt` when sharing fails or isn't available), the file round trip for both `.txt` and older `.json` files, the replay, and the edit rules (200-character limit, iOS layer return, auto-capitals). Screenshots go to `tests/out/`.
