"""Servidor de desarrollo local: sirve api/ igual que Vercel.

Vercel monta cada api/*.py como función; en local levantamos un único
proceso que rutea a los mismos handlers, para que `npm run dev` funcione
idéntico a producción sin depender de `vercel dev`.

    .venv/bin/python scripts/dev_server.py   # escucha en :5199
"""
import importlib.util
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = ROOT / "api"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(API))


def load(module_file: str):
    spec = importlib.util.spec_from_file_location(module_file, API / f"{module_file}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.handler


HANDLERS = {
    "/api/meta": load("meta"),
    "/api/graph": load("graph"),
    "/api/cypher": load("cypher"),
}


def route(path: str):
    base = path.split("?")[0].rstrip("/") or "/"
    return HANDLERS.get(base)


class Router(BaseHTTPRequestHandler):
    def _dispatch(self, method: str):
        handler_cls = route(self.path)
        if handler_cls is None:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"error":"no such endpoint"}')
            return
        # Reusar el handler de Vercel: instanciar sin el ctor de socketserver
        h = handler_cls.__new__(handler_cls)
        h.path = self.path
        h.headers = self.headers
        h.rfile = self.rfile
        h.wfile = self.wfile
        h.request_version = self.request_version
        h.send_response = self.send_response
        h.send_header = self.send_header
        h.end_headers = self.end_headers
        fn = getattr(h, f"do_{method}", None)
        if fn is None:
            self.send_response(405)
            self.end_headers()
            return
        fn()

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def do_OPTIONS(self):
        self._dispatch("OPTIONS")

    def log_message(self, *_args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5199
    print(f"api dev server → http://127.0.0.1:{port}  (endpoints: {', '.join(HANDLERS)})")
    ThreadingHTTPServer(("127.0.0.1", port), Router).serve_forever()
