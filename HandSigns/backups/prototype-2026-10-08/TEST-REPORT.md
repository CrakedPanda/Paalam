# Verification report

Tested on 8 October 2026 on this Windows computer using installed Microsoft Edge and Node.js 24.19.0.

## Passed

- **15 automated logic tests:** ten pose classes, mirrored hands and 0.8/1.0/1.2 synthetic hand scales; invalid, clipped and unsupported poses; sideways thumb rejection; stable holds; repeat suppression; neutral release; flicker rejection; interrupted frame streams and backwards timestamps.
- **Real MediaPipe runtime:** locally served version 0.10.21 initializes in a classic worker, loads local WASM and model assets, and processes simulated webcam frames. Empty frames return no hand without adding text. No uncaught page errors. A module-worker compatibility failure found in the first run was corrected before passing this check.
- **11 browser acceptance checks:** all ten synthetic landmark poses produce the expected transcript and speech API arguments; a held pose does not repeat; neutral release rearms it; two hands/unknown poses produce no text; mute preserves transcription; replay/copy/clear work; restart works; denied permission, missing device and busy camera display recovery messages; missing model releases the camera; WASM is served with the correct MIME type and files outside the public folder are blocked. (Mute/replay/copy/clear are grouped into one check, and each of the three device errors is a separate check.)
- **Integrated physical webcam:** explicitly selected `Integrated Camera (13d3:54b6)`, obtained a live 640×480, 24 fps track and advancing video frames; real MediaPipe inference reported no hand in the observed frames. No camera images were saved. Hiding the page released the stream.
- **Real browser speech API:** the Test voice utterance reached its completion callback and the interface returned to “Ready to speak.” The available local Microsoft English voice was selected. This confirms the browser event path, not an independently heard sound.
- **Desktop and mobile layout:** inspected full-page screenshots at 1440 px and 390 px widths; no horizontal mobile overflow. All ten cards, controls and the prototype vocabulary notice are present.
- **Local serving:** localhost health response and app assets respond successfully. Vision downloads are stored locally with source URLs and hashes in the vendor manifest.

## What these checks do not prove

**No person performed all ten physical poses for this session.** End-to-end pose tests injected synthetic landmarks at the worker boundary; they exercised the production classifier, hold filter, text and speech wiring, but bypassed the image-to-landmark model. The real camera run verifies capture and inference, not per-pose accuracy. No measured human accuracy, diverse-signer evaluation, ISL validation, or custom gesture training is claimed. Audible output was not independently listened to.

## Finish the human check

1. Open the app in Chrome or Edge and select Integrated Camera if the default virtual camera is not useful.
2. Click Test voice and confirm it is audible on the intended speaker.
3. Start camera. Perform each written pose with one whole hand visible, in good lighting. Hold until the progress bar fills. Confirm each expected phrase appears and is spoken once.
4. Hold a pose for several seconds: it must not repeat. Relax for half a second, then repeat it: one additional phrase should appear.
5. Try both hands, differing distances, realistic backgrounds and unsupported poses; record misses and false accepts before making accuracy claims.
6. Stop camera and verify the camera indicator turns off. Reload to clear the in-memory transcript.

The app and README clearly distinguish the custom demo vocabulary from standardized Indian Sign Language.
