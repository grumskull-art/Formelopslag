# Formelopslag

- This is an independent application. Code, catalogs, documents and runtime must stay inside this project; never import or resolve files from a neighboring project.
- Use Python 3.11+ and this project's `.venv`; pinned packages are in `requirements-lock.txt`.
- Validate with `.venv/bin/formelopslag validate` and test with `.venv/bin/python -m pytest -q`.
- Build with `.venv/bin/formelopslag build`; verify the resulting HTML with `node test_browser.cjs`.
- Preserve original sources and their SHA256 checksums. Never invent formulas to fill documented source gaps.
- Keep temporary exports outside the project. Do not dump file bodies or diffs over 60 lines per file into chat.

## Git collaboration

- All application work and commits belong on `develop`; never commit or push directly to `main`.
- Before editing, fetch `origin`, switch to `develop`, and synchronize with `git pull --ff-only`.
- Enable this clone's guards with `git config core.hooksPath .githooks`.
- Push `develop` without force; keep this shared branch after a merge.
- Review the GitHub Actions HTML preview before requesting a PR from `develop` to `main`.
- Merge only after the required checks pass and another collaborator approves the PR.
- Production publication is allowed only from `main`; branch previews must not replace production.
