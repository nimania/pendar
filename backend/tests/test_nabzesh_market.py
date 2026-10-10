"""Financial display contracts: units, missing history, and partial upstream failures."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.prices.nabzesh import fetch_snapshot, normalize, number

spec = importlib.util.spec_from_file_location("refresh_market", Path(__file__).resolve().parents[1] / "scripts/refresh_market.py")
refresh_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh_module)


def price(quote="IRT", value="266200", change=None):
    return {"quote": quote, "price": value, "change": change, "isStale": False,
            "hops": [{"sources": [{"provider": "fresh", "used": True},
                                    {"provider": "ignored", "used": False}]}]}


class MarketContracts(unittest.TestCase):
    def test_toman_is_not_divided_by_ten_and_missing_change_is_unknown(self):
        row = normalize("USD", "دلار", "currency", "IRT", "تومان", price())
        self.assertEqual(row["value"], 266200)
        self.assertIsNone(row["dp"])
        self.assertEqual(row["sources"], ["fresh"])
        self.assertEqual(row["price_decimal"], "266200")

    def test_actual_zero_move_and_negative_bubble_are_valid(self):
        row = normalize("BUBBLE_COIN_EMAMI", "حباب", "indicators", "IRT", "تومان",
                        price(value="-1000", change={"percent": "0", "absolute": "0", "direction": "flat"}))
        self.assertEqual(row["dp"], 0)
        self.assertEqual(row["value"], -1000)
        self.assertIsNone(normalize("USD", "دلار", "currency", "IRT", "تومان", price(value="0")))

    def test_invalid_numbers_and_incompatible_quotes_are_not_published(self):
        for value in (None, "NaN", "Infinity", True, "bad"):
            self.assertIsNone(number(value))
        self.assertIsNone(normalize("USD", "دلار", "currency", "IRT", "تومان", price(quote="IRR")))
        row = normalize("COFFEE_US", "قهوه", "food", "USD", "دلار", price(quote="USD", value="2.8517"))
        self.assertAlmostEqual(row["value"], 2.8517)

    def test_partial_quotes_and_detail_failures_do_not_erase_other_markets(self):
        class FakeClient:
            def get(self, path, **params):
                if path != "/v1/rates" or params["quote"] == "USD":
                    raise RuntimeError("offline")
                if params["quote"] == "POINT":
                    return {"data": [{"ticker": "TEDPIX", "price": price(quote="POINT")} ]}
                return {"data": [{"ticker": "USD", "price": price()}]}
        snapshot = fetch_snapshot(FakeClient())
        self.assertEqual({r["ticker"] for r in snapshot["rows"]}, {"USD", "TEDPIX"})
        self.assertTrue(any(e["kind"] == "chart_unavailable" for e in snapshot["errors"]))

    def test_outage_preserves_file_and_partial_failure_marks_old_rates_stale(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "market.json"
            previous = {"rows": [{"ticker": "EUR", "quote": "IRT", "value": 200, "is_stale": False}]}
            output.write_text(json.dumps(previous))
            original = output.read_bytes()
            with patch.object(refresh_module, "fetch_snapshot", return_value={"rows": [], "errors": []}):
                self.assertFalse(refresh_module.refresh(output))
            self.assertEqual(output.read_bytes(), original)
            with patch.object(refresh_module, "fetch_snapshot", return_value={"rows": [{"ticker": "USD", "quote": "IRT", "value": 300}], "errors": []}):
                self.assertTrue(refresh_module.refresh(output))
            old = next(r for r in json.loads(output.read_text())["rows"] if r["ticker"] == "EUR")
            self.assertTrue(old["is_stale"])
            self.assertTrue(old["preserved"])


if __name__ == "__main__":
    unittest.main()
