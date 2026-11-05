import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import media_delivery


class FakeDownload:
    def __init__(self, mime="image/jpeg", data=b"jpeg"):
        self.url = "https://cdn1.telesco.pe/file/photo.jpg"
        self.headers = {"Content-Type": mime, "Content-Length": str(len(data))}
        self.data = data

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def raise_for_status(self):
        return None

    def iter_content(self, chunk_size=None):
        yield self.data


class FakeSent:
    status_code = 200

    def json(self):
        return {"ok": True, "result": {"message_id": 201}}


class MediaDeliveryTests(unittest.TestCase):
    def test_upload_photo_preserves_caption(self):
        with patch.object(media_delivery.requests, "get", return_value=FakeDownload()) as get, \
             patch.object(media_delivery.requests, "post", return_value=FakeSent()) as post:
            message_id = media_delivery.upload_public_media(
                "secret", "-1003958286892",
                {"kind": "photo", "url": "https://cdn1.telesco.pe/file/photo.jpg"},
                "🔶 <b>تیتر کرمان</b>\n\n🔹 به گزارش کرمان نو")
        self.assertEqual(message_id, 201)
        self.assertEqual(post.call_args.kwargs["data"]["parse_mode"], "HTML")
        self.assertIn("photo", post.call_args.kwargs["files"])
        self.assertEqual(get.call_count, 1)

    def test_untrusted_host_is_rejected_before_download(self):
        with patch.object(media_delivery.requests, "get") as get:
            with self.assertRaises(media_delivery.MediaNotAvailable):
                media_delivery.upload_public_media(
                    "secret", "-1003958286892",
                    {"kind": "photo", "url": "https://local.example.com/image.jpg"},
                    "caption")
            get.assert_not_called()

    def test_download_too_large_never_delivered(self):
        download = FakeDownload(data=b"x" * 9_000_001)
        with patch.object(media_delivery.requests, "get", return_value=download), \
             patch.object(media_delivery.requests, "post") as post:
            with self.assertRaises(media_delivery.MediaNotAvailable):
                media_delivery.upload_public_media(
                    "secret", "-1003958286892",
                    {"kind": "photo", "url": "https://cdn1.telesco.pe/file/photo.jpg"},
                    "caption")
            post.assert_not_called()


if __name__ == "__main__":
    unittest.main()
