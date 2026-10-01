# Formelopslag

- This is an independent application. Code, catalogs, documents and runtime must stay inside this project; never import or resolve files from a neighboring project.
- Use Python 3.11+ and this project's `.venv`; pinned packages are in `requirements-lock.txt`.
- Validate with `.venv/bin/formelopslag validate` and test with `.venv/bin/python -m pytest -q`.
- Build with `.venv/bin/formelopslag build`; verify the resulting HTML with `node test_browser.cjs`.
- Preserve original sources and their SHA256 checksums. Never invent formulas to fill documented source gaps.
- Keep temporary exports outside the project. Do not dump file bodies or diffs over 60 lines per file into chat.
