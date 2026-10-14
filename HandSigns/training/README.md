# Optional model preparation

The shipped app already includes a fitted model and references. **Do not run this just to start the app.** Recreating source data downloads approximately 2.2 GB and requires additional disk space and CPU time. Source usage restrictions in the project README and MODEL-CARD still apply.

From the project root, create a Python virtual environment and install `training/requirements.txt` there. Then:

```powershell
node --use-system-ca training/download.mjs
python training/transcode.py
python training/extract.py
node training/build-model.mjs
python training/prepare-references.py
```

`--use-system-ca` is supported by the installed Node 24 runtime and trusts the Windows certificate store. On older Node versions, use their documented certificate configuration; never disable TLS verification.

The download step verifies hashes in `source-manifest.json`. The transcode step writes browser-sized H.264 clips to `training/data/videos-small`. Extraction uses the same downloaded float16/version-1 hand and body models as the browser and writes raw landmarks to `training/data/landmarks-python`. The model builder uses User001–010 for fitting, User011–012 for threshold selection, and User013–015 for reporting only. NAME has two fitted dictionary examples and no held-out signer test. The builder overwrites the local fitted model and evaluation report; retain a copy first when changing the dataset or algorithm.

For reproducibility, source hashes, original paths and split labels are fixed in the manifest. Exact floating-point results may vary with hardware and runtime versions. If data changes, regenerate the model card and rerun browser integration and human signing checks; do not retain old evaluation claims.
