// Tiny static server for the spineai.co.uk coming soon page.
// Supports Range requests so the trailer can stream and seek (Safari requires it).
const http = require("http");
const fs = require("fs");
const path = require("path");

const files = {
  "/": { file: "index.html", type: "text/html; charset=utf-8", cache: "public, max-age=300" },
  "/trailer.mp4": { file: "trailer.mp4", type: "video/mp4", cache: "public, max-age=86400" },
  "/poster.jpg": { file: "poster.jpg", type: "image/jpeg", cache: "public, max-age=86400" },
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const entry = files[url.pathname];
    if (!entry) {
      res.writeHead(302, { Location: "/" });
      return res.end();
    }

    const filePath = path.join(__dirname, entry.file);
    const size = fs.statSync(filePath).size;
    const headers = { "Content-Type": entry.type, "Cache-Control": entry.cache, "Accept-Ranges": "bytes" };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");

    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : size - Number(range[2]);
      let end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      start = Math.max(0, start);
      if (start > end || start >= size) {
        res.writeHead(416, { "Content-Range": `bytes */${size}` });
        return res.end();
      }
      res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(filePath, { start, end }).pipe(res);
    }

    res.writeHead(200, { ...headers, "Content-Length": size });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(filePath).pipe(res);
  })
  .listen(Number(process.env.PORT || 3000));
