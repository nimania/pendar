# Google Drive newspaper intake (initial safe rollout)

Folder: `1rP8lEWxcWUWK1mG3fKEhWySv85VgCnbX` (`Newspapers`).

This is an **intake-only** pipeline, not an automatic newspaper republisher.
Every three hours it looks for new or updated PDFs, reads at most two issues
per run, records per-page short *candidate* headings and extraction diagnostics,
and commits a review index to `backend/data/newspaper-intake.json`. It does
**not** publish article bodies or translations, and does not attach this job to
the homepage build/deployment. A candidate heading is NOT a validated article:
multicolumn layouts, continued articles, scans and captions need separate
segmentation and editorial verification.

## One-time configuration

1. In Google Cloud, create a service account with the **Google Drive API**
   enabled. Create a JSON key and keep it private.
2. In Google Drive, share the `Newspapers` folder with that service
   account's `client_email` as Viewer (including any inherited access needed
   for its PDF files). The current user's ChatGPT Drive authorization is **not**
   automatically usable inside GitHub Actions.
3. In the GitHub repository settings add an Actions secret named
   `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`, containing the complete JSON key.
   Never commit the key, token or personal Google account credentials.
4. Add an Actions **repository variable** `NEWSPAPER_DRIVE_ENABLED=true`.
5. Merge this PR and manually trigger
   `Actions -> Intake Google Drive Newspapers -> Run workflow` for first test.
   Inspect the logs and the generated review JSON before relying on the
   schedule. Scheduled Actions on the default branch can be delayed.

GitHub Actions needs `contents: write` to commit its index. Configure branch
protection to allow the workflow bot to push, or change the last step to create
a pull request if branch protection disallows direct pushes. Avoid placing
article full text, personal credentials or large PDF blobs in git.

## Editorial and rights gate

A PDF can be catalogued even if translation/republication rights are absent.
`rights_status=unverified` and `full_translation_allowed=false` are
intentional default safeguards. Verified segmentation, article-level tracking,
translation quality review, licensing and the Pendar publication adapter must
be implemented before any automated full-text publication is enabled.
