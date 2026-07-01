const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

function parseArgs(argv) {
  const args = { dir: path.join(process.cwd(), 'webui'), port: 11475 };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--dir' && value) {
      args.dir = value;
      i += 1;
    } else if (key === '--port' && value) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) args.port = parsed;
      i += 1;
    }
  }
  return args;
}

const { dir, port } = parseArgs(process.argv.slice(2));
const root = path.resolve(dir);

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

function safePathFromUrl(rawUrl) {
  const parsed = new URL(rawUrl, 'http://127.0.0.1');
  const pathname = decodeURIComponent(parsed.pathname || '/');
  const normalized = pathname === '/' ? '/index.html' : pathname;
  const candidate = path.resolve(root, `.${normalized}`);
  if (!candidate.startsWith(root)) return null;
  return candidate;
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType(filePath));
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const candidate = safePathFromUrl(req.url || '/');
  if (!candidate) {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }

  fs.stat(candidate, (err, stat) => {
    if (!err && stat.isFile()) {
      sendFile(res, candidate);
      return;
    }
    sendFile(res, path.join(root, 'index.html'));
  });
});

server.listen(port, '127.0.0.1');
