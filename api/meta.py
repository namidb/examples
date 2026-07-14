"""GET /api/meta — metadata for the 14 use cases (no seeding, fast)."""
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _lib import send_json  # noqa: E402
import cases  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        payload = {"casos": cases.all_meta(), "version": cases.VERSION}
        send_json(self, 200, payload)

    def do_OPTIONS(self):
        send_json(self, 204, {})
