# ISL upgrade verification — 9 October 2026

## Model evaluation

The fitted temporal model uses 89 example sequences. On 27 isolated videos from dataset signer IDs excluded from fitting and threshold selection, it correctly accepted 20, incorrectly accepted 1, and rejected 6. See MODEL-CARD.md and `public/model/evaluation.json`. NAME has no held-out signer test. These results are not live human or general sentence-translation accuracy.

## Passed implementation checks

- Six automated test groups cover all sentence patterns, bounded/explicit typed names, missing-body and blank sequence rejection, resampling, mirroring, exact temporal matching, ambiguous-match rejection and the ten-word vocabulary boundary.
- Recorded-landmark replay through the actual browser capture/classifier/UI created **I am a student**, **My name is Asha**, and **What is your name?**. Finishing calls browser speech with the composed text; missing typed names are blocked. Practice cards do not add fake recognition. Undo, clear, clipboard copying and stream release passed. A fake Edge camera exposed a 2×2 frame; the test harness was corrected to use its actual aspect ratio rather than assuming 4:3.
- The real Hand Landmarker and Pose Landmarker loaded locally and processed video in a worker. Empty captures add no word. The physical **Integrated Camera (13d3:54b6)** supplied an advancing 640×480, 24-fps track; hiding the page released it. No physical-camera imagery was saved. Real human signing was not performed for this test.
- Full **pixel → landmarks → classifier → page** replay accepted each of the ten bundled reference classes. At normal playback speed, this computer often missed short movements. Final tests used 5.5-second captures and 0.65× reference playback; I/me was initially rejected for insufficient frames and passed at 0.45× playback. These are fitted-source examples, not an independent accuracy test. The slower pace is reflected in the guide and default capture duration.
- Denied camera permission, missing camera and busy-camera errors show recovery messages. Missing classifier disables capture. Missing body-model assets release the camera. Video byte ranges work, and attempts to access files outside the public directory are blocked.
- Desktop (1440 px) and mobile (390 px) screenshots were inspected. There are ten playable local reference cards and no horizontal mobile overflow. No uncaught page exceptions occurred during completed smoke and replay tests.
- Personal-example capture saved a landmark example without adding transcript text, persisted after reload, and was deleted through the settings control. These checks used an isolated browser profile.
- The installed app's real browser speech test reached its completion callback. Audible speaker output was not independently listened to.

## What remains for human verification

A person should try all ten signs in front of the webcam, compare them with the reference videos, check speaker output, and correct mistakes using Undo. The short I/me sign needs a deliberate movement and brief final hold. Use personal calibration when the supplied examples do not cover a signing variant. Low frame rates or partial shoulders/face/hands can cause rejection even with a correct sign.

Reference-video replay, injected-landmark tests, physical camera capture and speech API events are different evidence. None independently establishes real-user recognition accuracy, audible sound quality, ISL grammatical correctness or unrestricted translation capability.
