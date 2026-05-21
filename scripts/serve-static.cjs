const fs = require("fs");
const http = require("http");
const path = require("path");

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(process.cwd(), args.root || ".");
const host = args.host || "127.0.0.1";
const port = Number(args.port || 3000);
const spaFallback = Boolean(args.spa);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid port: ${args.port}`);
}

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  throw new Error(`Static root does not exist: ${root}`);
}

const server = http.createServer((req, res) => {
  const method = String(req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end("Method Not Allowed");
  }

  const filePath = resolveRequestPath(req.url || "/");
  if (!filePath) {
    res.writeHead(400);
    return res.end("Bad Request");
  }

  serveFile(filePath, method, res);
});

server.on("error", (error) => {
  console.error(`Static server failed on ${host}:${port}: ${error.message}`);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`Serving ${root} at http://${host}:${port}`);
});

function parseArgs(values) {
  const parsed = {};
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function resolveRequestPath(rawUrl) {
  let pathname;
  try {
    pathname = new URL(rawUrl, "http://local").pathname;
  } catch {
    return null;
  }

  const decodedPath = decodeURIComponent(pathname);
  const requested = path.resolve(root, `.${decodedPath}`);
  if (!requested.startsWith(root)) return null;

  if (fs.existsSync(requested) && fs.statSync(requested).isDirectory()) {
    return path.join(requested, "index.html");
  }

  if (fs.existsSync(requested)) return requested;

  return spaFallback ? path.join(root, "index.html") : requested;
}

function serveFile(filePath, method, res) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500);
      return res.end(error.code === "ENOENT" ? "Not Found" : "Internal Server Error");
    }

    res.writeHead(200, {
      "Content-Type": contentTypeFor(filePath),
      "Cache-Control": cacheControlFor(filePath),
    });
    return method === "HEAD" ? res.end() : res.end(data);
  });
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
  }[ext] || "application/octet-stream";
}

function cacheControlFor(filePath) {
  return filePath.includes(`${path.sep}assets${path.sep}`)
    ? "public, max-age=31536000, immutable"
    : "no-cache";
}
