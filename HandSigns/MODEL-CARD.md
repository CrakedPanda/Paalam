# Paalam ISL introductions — model card

Version 2.0, prepared 9 October 2026. Intended for a local research/educational demonstration of **isolated ISL word recognition with a constrained English sentence builder**.

## What is actually fitted

A nonparametric temporal classifier stores **89 derived landmark sequences**. There are no newly trained neural-network weights. Google's pretrained Hand Landmarker and Pose Landmarker Lite estimate anatomy; dynamic time warping compares a completed captured movement with the fitted sequences.

Features include each hand's presence, wrist location relative to face/shoulders, palm size and 21 wrist-relative 3D landmarks. Body-relative coordinates reduce sensitivity to camera position and distance. Sequences are trimmed to the signing interval, resampled to 24 frames, and compared in original and mirrored orientation. A match needs both a class-specific distance threshold and a 0.10 relative margin over the second-best class. Distances are not probabilities.

Runtime body anchors refresh every four processed frames, allowing the hand tracker to run faster on modest CPUs. This assumes reasonably stable framing; moving the torso/camera rapidly can reduce accuracy. Captures with insufficient landmarks or multiple long frame gaps are rejected.

## Data and splits

**ISL500 / ISL-DATA:** 135 original videos: nine labels × 15 dataset signer IDs. The original labels are Hello, Goodmorning, I, You, What, Fine, Student, Teacher and Thankyou. Source: https://huggingface.co/datasets/ISL500/ISL-DATA. Original files totaled approximately 2.16 GB; browser-sized re-encodes were used for landmark processing.

- Fitting: User001–User010, initially 90 clips. Three clips were excluded by landmark quality/length checks: `i-User010.mp4`, `student-User007.mp4`, `what-User007.mp4`. Therefore 87 fitted sequences remain from this source.
- Validation: User011–User012, 18 clips. Used for per-class thresholds; also reported below. Validation results are not an independent test result.
- Test: User013–User015, 27 clips. Never added to fitted examples or used to choose thresholds. This is a signer-ID-disjoint split within this dataset, not a diverse real-world benchmark.

**NAME:** two ISLRTC dictionary variants (Name, Name Sign 2) contribute two fitted sequences. Source: Indian Sign Language Research and Training Centre, DEPwD, Ministry of Social Justice and Empowerment, Government of India; obtained via https://huggingface.co/datasets/Vignesh3816/Indian_Sign_Language_Data.gov_Rencoded. These are dictionary variants, not two established independent signers. **No held-out accuracy measurement exists for NAME.**

Total: 137 source clips, 3 excluded, 89 fitted, 18 validation, 27 test. The bundled guide shows one fitted-source example per class. It is a reference guide, not a test set.

## Measured results

| Evaluation | Correctly accepted | Incorrectly accepted | Rejected | Total |
|---|---:|---:|---:|---:|
| Validation (threshold selection) | 16 | 0 | 2 | 18 |
| Held-out signer clips | **20** | **1** | **6** | **27** |

The unfiltered nearest-class result was correct for 22 of 27 test clips. After applying rejection, 20 of 27 clips were correctly accepted (74.1% coverage of the full test set); 20 of 21 accepted predictions were correct. **These numbers must not be described as 95% general recognition accuracy.** The sole false acceptance was Goodmorning → You. Rejections affected Fine, Goodmorning, Teacher, Thankyou and What. Per-clip labels, distances and margins are in `public/model/evaluation.json`.

This small test consists only of known vocabulary. It does **not** establish false-positive rates for arbitrary unknown signs, accuracy for NAME, live signer performance, or sentence translation accuracy. No expert evaluation of signing grammar, nonmanual markers or semantic appropriateness of all generated English sentences was performed. The English sentence patterns are hand-written conveniences.

## Extraction and reproducibility

Videos were re-encoded to 640-pixel width at 10 fps, preserving their aspect ratio. Python MediaPipe 0.10.32 extracted landmarks using Google's Hand Landmarker float16/version 1 and Pose Landmarker Lite float16/version 1 model files. Browser runtime uses Tasks Vision 0.10.21 with those same models. Cross-runtime and live-camera differences can affect results; browser pixel replay checks are recorded separately in ISL-TEST-REPORT.md.

Original source paths, hashes and assignments are recorded in `training/source-manifest.json`. Derived sequences contain no source video pixels. Optional preparation scripts document the fitting pipeline; they are not needed to run the app. Personal examples remain separate in local browser storage, do not alter the shipped evaluation, and have no verified sign labels or measured accuracy.

## Known limits

- One captured word at a time. No automatic segmentation of continuous signing.
- No arbitrary vocabulary, fingerspelled names, facial grammar or natural sentence translation.
- Hand occlusion, partial framing, fast movements and low frame rates cause rejection or errors. Capture 4 or 5.5 seconds and sign more slowly if needed.
- Dataset identities and linguistic labels are supplied by upstream authors; they were not independently re-certified here. Regional/personal ISL variants may differ.
- Only ten source signer IDs are represented in fitting for nine words, and only three IDs in the held-out evaluation. This is too small for demographic or accessibility claims.
- NAME has just two dictionary variants. Personal calibration may be particularly useful, but it does not replace representative data and independent evaluation.

## Rights and acknowledgement

ISL500/ISL-DATA specifies **research and academic use only**, with commercial inquiries directed to its authors. ISLRTC permits research, teaching and technology development with proper acknowledgement and no resale/profiteering (https://islrtc.nic.in/faq/). Those source restrictions are retained even where a mirror lists a broader license. Local reference clips are resized/re-encoded derivatives; landmark templates are derived features. MediaPipe's Apache 2.0 license accompanies its runtime assets.
