"""Start the whole suite at one origin. Do not start a separate server per module."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import argparse,webbrowser,sys
ROOT=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def end_headers(self):
  if self.path.split('?')[0].endswith(('/','service-worker.js','index.html','manifest.webmanifest')):self.send_header('Cache-Control','no-cache')
  super().end_headers()

class LocalServer(ThreadingHTTPServer):
 # On Windows SO_REUSEADDR can bind a second server to an occupied port.
 allow_reuse_address=False
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8000);parser.add_argument('--no-browser',action='store_true');args=parser.parse_args()
 try:server=LocalServer(('127.0.0.1',args.port),Handler)
 except OSError:
  print(f'Port {args.port} is already in use. Close the old local server and run again.\nUse the same port to keep access to your existing local library.');return 1
 url=f'http://localhost:{args.port}/';print('SpaceSuite / LexicalSpace43.3.0\n'+url+'\nKeep this window open. Ctrl+C stops the server.')
 if not args.no_browser:webbrowser.open(url)
 try:server.serve_forever()
 except KeyboardInterrupt:pass
 finally:server.server_close()
 return 0
if __name__=='__main__':sys.exit(main())
