import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

http.createServer((req, res) => {
  const file = path.join(__dirname, req.url === '/' ? '/monthly.html' : req.url);
  try {
    const content = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(7788, () => console.log('Server running on http://localhost:7788'));
