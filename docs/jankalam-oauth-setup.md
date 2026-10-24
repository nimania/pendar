# Jan Kalam YouTube OAuth bootstrap (local only)

This is an **isolated diagnostic**, not a live ingestion or Drive-sync pipeline.

## Prerequisites
- Python 3.10+ and the new Google Cloud OAuth **Desktop application** credentials downloaded by the channel owner.
- The Google account granting consent must own/manage the selected video's channel.
- The Google Cloud project's OAuth Test users must include this account.
- OAuth project in Testing may issue refresh tokens that expire after 7 days for this YouTube scope; production automation requires handling that lifecycle.

## One-time local test
1. Download this branch to your machine (or use GitHub Desktop to switch to `feature/jankalam-transcript-pilot`).
2. In the repo root, place the downloaded OAuth client JSON as `credentials.json`; **never commit or upload it**.
3. Run:
   ```bash
   python -m pip install google-api-python-client google-auth-oauthlib
   python tools/jankalam_oauth_bootstrap.py
   ```
4. Sign in to the owning Google account in the Google browser consent window. No tokens or secrets should be pasted into messages.
5. The program reports whether caption tracks of video `dpYz8bT_w0Y` can be listed. It writes `youtube-oauth-token.json` locally.
6. Keep that token private. Before building remote automation, validate download capability and decide on secure token provisioning. GitHub Secrets, if later used, should be populated through GitHub UI or GitHub CLI on the owner's own device, **never** through an issue, PR, or chat.

## Security boundaries
The repository is public. Do not commit `credentials.json`, `youtube-oauth-token.json`, or any Google credentials. These patterns have been added to .gitignore on this branch. Never pass auth tokens through Actions logs or artifacts. The OAuth scope `youtube.force-ssl` is broad, so avoid running unreviewed third-party scripts with it.
