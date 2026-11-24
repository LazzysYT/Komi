"""Static QA server with ordinary HTTP gzip for text assets; no mocked traffic."""
import argparse
import gzip
import os
from functools import lru_cache
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

@lru_cache(maxsize=128)
def compressed(path, mtime_ns):
    return gzip.compress(Path(path).read_bytes(), compresslevel=6, mtime=0)

class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        target = Path(self.translate_path(self.path))
        if target.is_dir():
            target = target / "index.html"
        mime = self.guess_type(str(target))
        accepts = self.headers.get("Accept-Encoding", "").lower()
        gzip_allowed = any(part.strip().split(";")[0] == "gzip" and "q=0" not in part.replace("q=0.", "q=.") for part in accepts.split(","))
        if target.is_file() and gzip_allowed and (mime.startswith("text/") or mime in ("application/javascript", "application/json", "image/svg+xml")):
            try:
                from io import BytesIO
                stat = target.stat()
                payload = compressed(str(target), stat.st_mtime_ns)
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Content-Length", str(len(payload)))
                self.send_header("Vary", "Accept-Encoding")
                self.send_header("Last-Modified", self.date_time_string(stat.st_mtime))
                self.end_headers()
                return BytesIO(payload)
            except OSError:
                pass
        return super().send_head()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("port", type=int)
    parser.add_argument("--directory", required=True)
    args = parser.parse_args()
    os.chdir(args.directory)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
