"""Serve LexicalSpace on loopback."""

import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


PORT = 8780
ROOT = Path(__file__).resolve().parent


class LexicalSpaceHandler(SimpleHTTPRequestHandler):
    timeout = 5
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def local_host(self):
        port = self.server.server_port
        hosts = self.headers.get_all('Host', [])
        if len(hosts) == 1 and hosts[0] in {f'127.0.0.1:{port}', f'localhost:{port}'}:
            return hosts[0]
        return None

    def end_headers(self):
        if self.command in ('GET', 'HEAD'):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_GET(self):
        if not self.local_host():
            self.send_error(403)
            return
        super().do_GET()

    def do_HEAD(self):
        if not self.local_host():
            self.send_error(403)
            return
        super().do_HEAD()

    def log_request(self, code='-', size='-'):
        # Keep query strings and request contents out of the launcher console.
        pass


if __name__ == '__main__':
    with ThreadingHTTPServer(('127.0.0.1', PORT), LexicalSpaceHandler) as server:
        webbrowser.open(f'http://127.0.0.1:{PORT}/')
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
