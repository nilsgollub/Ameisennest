#!/usr/bin/env python3
"""
FORMICA-OS Kiosk — Reboot-Service
Lauscht auf http://127.0.0.1:8765/reboot und startet den Pi neu.
Wird via XDG Autostart gestartet.
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/reboot':
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'rebooting')
            subprocess.Popen(['sudo', 'reboot'])
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *args):
        pass  # kein Logging nötig


if __name__ == '__main__':
    HTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
