"""Private Recipe Lab access regression tests. No network or credentials required."""
from fastapi.testclient import TestClient
from fastapi import FastAPI
from app.recipe_lab import router

app = FastAPI()
app.include_router(router)

client = TestClient(app, follow_redirects=False)


def test_missing_configuration_fails_closed(monkeypatch):
    for key in ("RECIPE_LAB_USER", "RECIPE_LAB_PASSWORD", "RECIPE_LAB_GITHUB_TOKEN"):
        monkeypatch.delenv(key, raising=False)
    for path in ("/recipes/", "/recipes/api/data"):
        result = client.get(path)
        assert result.status_code == 503


def test_unauthorized_rejected_for_page_and_json(monkeypatch):
    monkeypatch.setenv("RECIPE_LAB_USER", "recipeowner")
    monkeypatch.setenv("RECIPE_LAB_PASSWORD", "long-test-password")
    monkeypatch.setenv("RECIPE_LAB_GITHUB_TOKEN", "dummy-no-network")
    for path in ("/recipes/", "/recipes/api/data"):
        assert client.get(path).status_code == 401
        assert client.get(path, auth=("recipeowner", "wrong")).status_code == 401


def test_authorized_dashboard_does_not_expose_secrets(monkeypatch):
    monkeypatch.setenv("RECIPE_LAB_USER", "recipeowner")
    monkeypatch.setenv("RECIPE_LAB_PASSWORD", "long-test-password")
    monkeypatch.setenv("RECIPE_LAB_GITHUB_TOKEN", "dummy-no-network")
    result = client.get("/recipes/", auth=("recipeowner", "long-test-password"))
    assert result.status_code == 200
    assert "آزمایشگاه رسپی" in result.text
    assert "dummy-no-network" not in result.text
    assert result.headers["cache-control"] == "private, no-store"
    assert result.headers["x-robots-tag"] == "noindex, nofollow"
