# Recipe Lab deployment

Proposed private route: `/recipes/`.

The route is guarded by HTTP Basic authentication, served over HTTPS, and reads data server-side from the separate private Recipe Lab repository. The existing public Pendar site remains unchanged.

Before deployment, configure three environment variables on the Pendar backend host: `RECIPE_LAB_USER`, `RECIPE_LAB_PASSWORD`, and `RECIPE_LAB_GITHUB_TOKEN`. The GitHub token must have read-only access restricted to `nimania/recipe-lab`.

Do not commit credentials or source PDFs. Confirm 503 when configuration is missing, 401 for invalid sign-in, and normal page/data responses for an authorized sign-in. Review and test on a staging instance before merging or deploying.
