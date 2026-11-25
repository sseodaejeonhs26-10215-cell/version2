// 선택 사항: 파일을 직접 여는 대신 localhost에서 실행할 때 사용합니다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/style.css': ['style.css', 'text/css'], '/logic.js': ['logic.js', 'text/javascript'], '/app.js': ['app.js', 'text/javascript'] };
const server = http.createServer((req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(__dirname, file[0]), (error, data) => {
    if (error) { res.writeHead(500); return res.end('Unable to load file'); }
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
server.on('error', error => { console.error(`서버 시작 실패: ${error.message}`); process.exitCode = 1; });
server.listen(3000, '127.0.0.1', () => console.log('하루핏: http://localhost:3000 (종료: Ctrl+C)'));
