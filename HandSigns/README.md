# Paalam — ISL greetings and introductions

This version replaces the old custom finger-pose mappings with a **small temporal recognizer fitted from recorded Indian Sign Language examples**. It recognizes ten isolated words and composes selected English sentences. It is an experimental local project, not a general continuous ISL translator or an independently validated accessibility product.

## Start

Double-click **Start HandSigns.cmd**, then open **http://127.0.0.1:5173** in current Chrome or Edge. Alternatively run `node server.mjs` using Node.js 20 or newer.

1. Watch a word's reference video in the guide. Follow its full movement, hand shape and position, rather than the old prototype poses.
2. Click **Start camera**. Allow camera permission. Keep your face, shoulders and both hands visible. If the default virtual camera is not useful, stop and choose **Integrated Camera**.
3. Click **Capture sign** or press **Space**. Wait for the countdown, then sign one complete word. The recommended default capture lasts 5.5 seconds; select 4 or 2.8 seconds only if tracking is fast enough. Sign slowly and briefly hold the final position. Reference playback is slowed to 0.65x (I/me: 0.45x) for practice.
4. A sufficiently clear match adds one word. Uncertain matches add nothing. Capture the next word separately.
5. Review the English sentence preview, use **Undo word** if needed, and click **Finish & speak**. Completed sentences have a replay button and can be copied.

Camera controls stop capture on page hiding, navigation, disconnection and errors. The transcript remains in page memory until cleared or reloaded. There is no microphone request.

## Vocabulary and sentences

The supported words are **hello, good morning, I/me, you, name, what, fine, student, teacher, thank you**. Nine classes use ISL500/ISL-DATA recordings; name uses two ISLRTC dictionary variants. Only one example per class is shown in the guide; the classifier uses multiple fitted examples where available.

| Captured words | English output |
|---|---|
| HELLO | Hello. |
| GOOD MORNING | Good morning. |
| I + NAME, with a typed name | My name is Asha. |
| YOU + NAME + WHAT | What is your name? |
| I + STUDENT | I am a student. |
| I + TEACHER | I am a teacher. |
| I + FINE | I am fine. |
| THANK YOU | Thank you. |

The phrase cards highlight reference signs for practice; clicking them **does not simulate recognition or add words**. English articles, copulas and punctuation are added by fixed output patterns. These patterns are not a linguistic model of ISL grammar. Unmatched combinations stay literal, rather than inventing an intended sentence. YOU + STUDENT/TEACHER/FINE produce statements, not inferred questions. Names are explicitly typed text; fingerspelling and arbitrary personal name recognition are not implemented.

## Personal calibration

Open **Improve recognition for your signing**, choose a word, and record two or three correct examples after watching its reference. These examples participate in the same temporal matcher. Up to five examples per word are retained; the oldest for that word is replaced when necessary.

Only landmark feature sequences are saved in browser local storage. Camera video is not saved. **Delete my examples** removes them. Personal examples are not independently checked for correct ISL labels; recording an incorrect sign teaches that mistake. Storage failure is surfaced in the UI and leaves samples usable only in the current page session.

## Recognition

- MediaPipe Tasks Vision 0.10.21 runs Hand Landmarker (two hands) and Pose Landmarker Lite in a classic Web Worker, using locally stored float16/version-1 models.
- The matcher uses hand-relative 3D shape, wrist position relative to the face/shoulders, palm scale, and hand presence over time. It resamples a completed movement to 24 frames and compares it with fitted examples using dynamic time warping. Mirrored variants are considered.
- Classification requires both a distance threshold and separation from the second-best class. The UI shows no fabricated confidence percentage. Similar or out-of-range captures are rejected.
- This is a fitted nearest-example classifier, not a newly trained deep neural network. MediaPipe's landmark detectors are pretrained. Python 0.10.32 using the same model assets prepared the training landmarks; browser extraction was also used during development and is checked separately. Runtime differences and real-camera domain shift remain limitations.

See **MODEL-CARD.md** for exact splits, measured results, exclusions and source restrictions. The model and reference videos are bundled; end users do not need Python or a dataset download. `node setup.mjs` restores only MediaPipe vendor/model assets if missing; it does not train the sign classifier.

## Limits and privacy

This release supports **one isolated sign per capture**, not free continuous signing. Facial expressions, nonmanual grammar, discourse context, coarticulation, arbitrary vocabulary and full sentence translation are not modeled. Regional variants, mobility differences, lighting, distance, occlusion and slow/fast movements can reduce performance. `NAME` has much less source data than other classes and needs particular caution or personal calibration.

Camera frames and landmarks are processed locally. No video uploads, analytics or remote inference are used. Reference clips are local. The conversation and typed name are not persisted. Personal calibration is browser-local and user-deletable. Browser/OS voices marked **online** may transmit spoken text; choose a **local** voice for offline speech. Audible playback depends on the browser, installed voices and Windows output device.

## Data attribution and permitted use

- **ISL500 / ISL-DATA**: https://huggingface.co/datasets/ISL500/ISL-DATA — original recorded word videos across 15 dataset user IDs. The source specifies **research and academic use only**; commercial use requires contacting its authors. The bundled references are resized/re-encoded copies; the model contains derived numeric landmark sequences.
- **Indian Sign Language Research and Training Centre (ISLRTC), Department of Empowerment of Persons with Disabilities, Ministry of Social Justice and Empowerment, Government of India**: NAME and NAME (Sign 2), via https://huggingface.co/datasets/Vignesh3816/Indian_Sign_Language_Data.gov_Rencoded. Follow the original ISLRTC FAQ conditions, including acknowledgement and no resale/profiteering: https://islrtc.nic.in/faq/. A mirror's MIT metadata does not replace those source conditions.
- Google MediaPipe: Apache 2.0 license in `public/vendor/LICENSE`; downloaded asset URLs and checksums are recorded in `public/vendor/manifest.json`.

The source manifest records original clip paths, signer IDs, split assignments, sizes, and hashes. Dataset word labels are preserved; no ASL signs are relabeled as ISL. Independent expert validation of every source rendition was not performed in this session.

## Tests and maintenance

Run `node --test tests/isl.test.mjs`. These tests cover composition, typed-name boundaries, blank/invalid captures, normalization, mirroring, exact matches, ambiguous matches and the vocabulary boundary. They do not prove human recognition accuracy.

`public/model/evaluation.json` records held-out clip results. `ISL-TEST-REPORT.md` separates browser wiring, source-video evaluation and physical camera checks. Optional preparation scripts and the source manifest are in `training/`; dataset videos are kept out of the distributable app. The previous prototype is backed up before installation.

If a video cannot seek, use the supplied server, which supports HTTP byte ranges. If the model cannot load, restore the `public/model` folder. If camera access fails, allow permission, select a working camera and close apps using it. If matches fail, check the reference and camera framing before recording personal examples.
