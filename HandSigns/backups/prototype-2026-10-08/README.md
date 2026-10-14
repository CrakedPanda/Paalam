# Paalam — hand to voice

A local webcam webpage that recognizes **10 custom static hand poses**, displays text, and reads it using browser speech synthesis. **This is a prototype gesture interface, not standardized Indian Sign Language vocabulary or an ISL translator.**

## Run on Windows

Double-click **Start HandSigns.cmd** and leave its server window open. Open **http://127.0.0.1:5173** in Chrome or Edge if a tab does not open. Click **Start camera**, allow camera access, and hold one of the poses below for 0.7 seconds. Click **Test voice** to check your selected speaker/voice. Click **Stop** to release the webcam. Stop the server with Ctrl+C in its window.

The project requires Node.js 20 or newer. The launcher first looks on PATH, then at the existing Codex Node runtime on this computer. To run manually:

```powershell
node setup.mjs  # only needed if local vendor/model files are missing
node server.mjs
node --test tests/*.test.mjs
```

Setup downloads pinned MediaPipe Tasks Vision **0.10.21**, its WASM files, and Google's Hand Landmarker **float16 version 1** model. After setup, vision works without an internet connection. No npm install or build step is required. Download origins, file sizes and SHA-256 hashes are in `public/vendor/manifest.json`; the upstream Apache 2.0 license is in `public/vendor/LICENSE`. Setup replaces only its named vendor files. Keep this whole folder together when sharing it.

## The ten custom mappings

These labels were chosen for this demo. They are **not claims about ISL meanings**. Either hand can be used; keep the whole hand visible, palm facing the camera, with fingers separated where possible. Thumb up/down are defined relative to the screen.

| Pose | Exact definition | Text and speech |
|---|---|---|
| Open palm | All four fingers and thumb extended and spread | Hello |
| Closed fist | All four fingers curled, thumb folded across them | Stop |
| Index finger | Only index extended, thumb tucked | One |
| Two fingers | Index and middle extended, ring/pinky/thumb folded | Two |
| Three fingers | Index/middle/ring extended, pinky/thumb folded | Three |
| Four fingers | Four fingers extended, thumb folded across palm | Four |
| Thumb up | Four fingers curled, thumb extended toward screen top | Yes |
| Thumb down | Four fingers curled, thumb extended toward screen bottom | No |
| Pinky finger | Only pinky extended, other fingers/thumb folded | Help |
| Thumb + pinky | Thumb and pinky extended, middle three fingers curled | Call me |

The small icons are memory aids; follow the written pose descriptions. The matching card highlights during recognition. The progress bar measures **hold duration**, not accuracy or confidence.

## Recognition and stability

MediaPipe's pretrained Hand Landmarker estimates 21 landmarks per hand. A lightweight, hand-written geometric classifier uses 3D joint angles, distances relative to palm width and screen-space thumb direction. This classifier was **not trained on a gesture or ISL dataset**. It uses conservative gaps between extended and curled thresholds; ambiguous/unlisted configurations return no match. Clipped or tiny/edge-on palms are rejected. Two detected hands are rejected rather than arbitrarily choosing one.

Inference runs in a Web Worker, capped at approximately 15 frames/second with at most one frame in flight. The main page renders a mirrored camera and landmark overlay. A candidate must agree continuously for 700 ms and at least five samples. Unknown poses reset the hold. A held pose is added only once; an uninterrupted 450 ms neutral interval rearms it. A different stable pose can be added immediately after its own hold. Gaps longer than 300 ms reset the candidate so stalls do not count as stability.

Speech uses `speechSynthesis`. New phrases replace queued speech to avoid a backlog. Replay reads the current transcript. Transcript memory is limited to the last 200 accepted phrases. Camera tracks and the worker are stopped on Stop, page hiding, errors and page exit. Switching camera is available while stopped. No microphone is requested.

## Privacy and limitations

- Camera frames and landmarks remain in this browser. The app has no upload endpoint, analytics, external fonts, or remote scripts at runtime. Only model setup downloads assets.
- Text stays in page memory until cleared or reloaded. Copy places the transcript on the system clipboard.
- Speech voices belong to the browser/OS. A voice labeled **online** may send text to its provider; use a **local** voice for offline speech. Installed voices, autoplay restrictions and output devices affect audible playback.
- There is no held-out human test set, measured recognition accuracy, signer-diversity study or custom model training. Synthetic tests check program logic, not real recognition accuracy. Thresholds need evaluation across users, skin tones, hand sizes, mobility, backgrounds and cameras.
- This is for static, single-hand poses only. It does not interpret signed sentences, motion, facial expressions, two-handed signs or ISL grammar. Front-facing palms and good diffuse lighting work best; severe rotation, foreshortening, occlusion and partial poses can cause misses or false accepts.
- A real ISL version needs vocabulary reviewed by competent ISL users, consented labeled recordings across diverse signers, train/validation/test splits by signer, temporal modeling where necessary and per-class precision/recall including unknown-sign rejection. Do not describe this rule-based prototype as a trained ISL recognizer.

## Troubleshooting

**No permission / no camera:** allow camera access in the browser's site settings, connect a webcam, and close apps using it. Camera needs localhost or HTTPS; do not open the HTML file directly.

**Tracker fails:** use a current Chrome or Edge browser with WebAssembly and workers enabled. Rerun `node setup.mjs` if assets are missing. A slow computer may need extra time on first start. Camera is released if loading/inference fails.

**No match:** consult the written guide; show one complete hand at a comfortable distance. Fully extend or fully curl each specified finger and make the thumb clearly spread or tucked. The app intentionally rejects uncertain poses.

**No voice:** press Test voice, select an installed local English voice, check Windows sound output and browser permissions. Recognition and text remain usable if speech is unsupported.

**Port busy:** if the existing service is Paalam, use its tab. Otherwise close it, or set `$env:PORT=5174` before `node server.mjs` and open that port manually. The server binds only to 127.0.0.1.

## Files and references

- `public/app.mjs`: camera lifecycle, transcript, speech and UI.
- `public/gestures.mjs`: pose definitions, geometric classifier and stable filter.
- `public/vision-worker.mjs`: MediaPipe inference in a worker.
- `tests/gestures.test.mjs`: synthetic landmarks and timing regression checks.
- `TEST-REPORT.md`: executed checks and remaining real-user validation.

Official references: [MediaPipe Hand Landmarker for Web](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js), [MediaPipe Hands paper](https://arxiv.org/abs/2006.10214), [MDN SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis).
