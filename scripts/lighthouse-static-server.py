"""Local Lighthouse server with normal HTTP gzip negotiation, no external access."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import gzip, io, os
from functools import lru_cache

@lru_cache(maxsize=32)
def compressed(path, mtime):
    return gzip.compress(Path(path).read_bytes(), compresslevel=6, mtime=0)

class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            path = os.path.join(path, 'index.html')
        if (os.path.isfile(path) and Path(path).suffix in {'.css','.js','.html','.svg','.json','.txt'}
            and 'gzip' in self.headers.get('Accept-Encoding','').lower()):
            stat = os.stat(path)
            data = compressed(path,stat.st_mtime_ns)
            self.send_response(200)
            self.send_header('Content-Type', self.guess_type(path))
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Content-Encoding','gzip')
            self.send_header('Vary','Accept-Encoding')
            self.end_headers()
            return io.BytesIO(data)
        return super().send_head()

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
