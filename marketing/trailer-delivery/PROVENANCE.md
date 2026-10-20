# Asset and audio provenance

- Governing brief: user-uploaded Spine_Trailer_Final_Brief.docx, copied unchanged. Full extracted text in brief.txt.
- Source recordings: all15 files under https://raw.githubusercontent.com/louiebond1/spine/spine-2/marketing/clips/ were accessed previously and are included locally. Source descriptions and screenshot inventory are in assets.json. No old public website capture was used.
- Reference brief: https://raw.githubusercontent.com/louiebond1/spine/spine-2/marketing/ASTRA-BRIEF.md. Final DOCX takes precedence.
- Genuine logo geometry and typography: src/components/shell/Logo.tsx and tailwind.config.ts on the repository's spine-2 branch; preserved component in brand-source.tsx. Inter600 wordmark converted into paths. Colors use the app's actual logo gradient.
- Font: official Google Fonts Inter repository, ofl/inter/Inter[opsz,wght].ttf; OFL.txt bundled. Static regular instance generated for subtitle rendering.
- Character art: original reusable SVG drawing code in src/components/Character.tsx and Desk.tsx; stylised demo roles, not portraits of actual people.
- Music/effects: original deterministic110BPM synthesis in scripts/audio.py (seed540), no third-party song or sample. Separate original instrumental included.
- Speech: local Kokoro bf_emma/en-gb; generic British voice, no celebrity imitation. Models fetched from thewh1teagle/kokoro-onnx GitHub release model-files-v1.0. Tool MIT licence saved. Kokoro Apache2.0 licence recovered from https://raw.githubusercontent.com/hexgrad/kokoro/main/LICENSE after the Hugging Face LICENSE URL returned HTTP403.
- No product asset failed to download. The licence-host403 did not affect footage access and was resolved via the project's official GitHub repository.
