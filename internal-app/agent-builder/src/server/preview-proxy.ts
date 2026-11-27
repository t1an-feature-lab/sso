import "server-only";

import http from "node:http";
import net from "node:net";
import { OVERLAY_SCROLLBAR_SCRIPT } from "@/lib/overlay-scrollbar";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const GLOBAL_KEY = Symbol.for("agent-builder.preview-proxies");

type ProxySlot = {
  port: number;
  server: http.Server;
};

type ProxyRegistry = {
  proxies: Map<string, ProxySlot>;
  pending: Map<string, Promise<string>>;
};

function registry(): ProxyRegistry {
  const root = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: ProxyRegistry;
  };
  if (!root[GLOBAL_KEY]) {
    root[GLOBAL_KEY] = { proxies: new Map(), pending: new Map() };
  }
  return root[GLOBAL_KEY];
}

export function frameHostname(_pageHost: string): string {
  return "127.0.0.1";
}

export function parsePreviewUpstream(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:") return null;
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return null;
  const port = Number(url.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return null;
  const blocked = new Set<number>([3003]);
  const envPort = Number(process.env.PORT);
  if (Number.isInteger(envPort) && envPort > 0) blocked.add(envPort);
  if (blocked.has(port)) return null;
  return new URL(`http://127.0.0.1:${port}`);
}

function injectHtml(html: string, upstreamOrigin: string, frameOrigin: string): string {
  const rewritten = html.split(upstreamOrigin).join(frameOrigin);
  if (rewritten.includes("/__ab_overlay.js")) return rewritten;
  const tag = `<script src="/__ab_overlay.js"></script>`;
  if (rewritten.includes("</head>")) {
    return rewritten.replace("</head>", `${tag}</head>`);
  }
  if (rewritten.includes("<head>")) {
    return rewritten.replace("<head>", `<head>${tag}`);
  }
  return `${tag}${rewritten}`;
}

function rewriteLocation(
  headers: http.IncomingHttpHeaders,
  upstreamOrigin: string,
  frameOrigin: string
): http.OutgoingHttpHeaders {
  const next: http.OutgoingHttpHeaders = { ...headers };
  const location = next.location;
  if (typeof location === "string" && location.startsWith(upstreamOrigin)) {
    next.location = `${frameOrigin}${location.slice(upstreamOrigin.length)}`;
  }
  return next;
}

function createProxy(upstream: URL, advertisedHost: string): http.Server {
  const port = Number(upstream.port);
  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    const path = url.split("?")[0] ?? url;
    if (path === "/__ab_overlay.js") {
      res.writeHead(200, {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(OVERLAY_SCROLLBAR_SCRIPT);
      return;
    }

    const headers = { ...req.headers, host: upstream.host };
    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: url,
        method: req.method,
        headers,
      },
      (proxyRes) => {
        const addr = server.address();
        const proxyPort = addr && typeof addr === "object" ? addr.port : 0;
        const frameOrigin = `http://${advertisedHost}:${proxyPort}`;
        const type = String(proxyRes.headers["content-type"] ?? "");
        const encoded = Boolean(proxyRes.headers["content-encoding"]);
        if (!type.includes("text/html") || encoded) {
          res.writeHead(
            proxyRes.statusCode ?? 200,
            rewriteLocation(proxyRes.headers, upstream.origin, frameOrigin)
          );
          proxyRes.pipe(res);
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        let overflow = false;
        proxyRes.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_HTML_BYTES) {
            overflow = true;
            return;
          }
          chunks.push(chunk);
        });
        proxyRes.on("end", () => {
          const responseHeaders = rewriteLocation(
            proxyRes.headers,
            upstream.origin,
            frameOrigin
          );
          if (overflow) {
            res.writeHead(proxyRes.statusCode ?? 200, responseHeaders);
            for (const chunk of chunks) res.write(chunk);
            res.end();
            return;
          }
          const html = injectHtml(
            Buffer.concat(chunks).toString("utf8"),
            upstream.origin,
            frameOrigin
          );
          delete responseHeaders["content-length"];
          delete responseHeaders["transfer-encoding"];
          delete responseHeaders["content-security-policy"];
          delete responseHeaders["content-security-policy-report-only"];
          res.writeHead(proxyRes.statusCode ?? 200, responseHeaders);
          res.end(html);
        });
      }
    );
    proxyReq.on("error", () => {
      if (res.headersSent) {
        res.end();
        return;
      }
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end("开发服务不可用");
    });
    req.pipe(proxyReq);
  });

  server.on("upgrade", (req, socket, head) => {
    const upstreamSocket = net.connect(port, "127.0.0.1", () => {
      const lines = [`${req.method ?? "GET"} ${req.url ?? "/"} HTTP/1.1`];
      for (const [key, value] of Object.entries(req.headers)) {
        if (value == null) continue;
        if (key.toLowerCase() === "host") {
          lines.push(`host: ${upstream.host}`);
          continue;
        }
        const values = Array.isArray(value) ? value : [value];
        for (const item of values) lines.push(`${key}: ${item}`);
      }
      upstreamSocket.write(`${lines.join("\r\n")}\r\n\r\n`);
      if (head.length) upstreamSocket.write(head);
      upstreamSocket.pipe(socket);
      socket.pipe(upstreamSocket);
    });
    const closeBoth = () => {
      upstreamSocket.destroy();
      socket.destroy();
    };
    upstreamSocket.on("error", closeBoth);
    socket.on("error", closeBoth);
  });

  return server;
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") resolve(addr.port);
      else reject(new Error("预览转发启动失败"));
    });
  });
}

export function ensurePreviewProxy(
  upstream: URL,
  pageHost: string
): Promise<string> {
  const advertisedHost = frameHostname(pageHost);
  const key = `${advertisedHost}|${upstream.origin}`;
  const { proxies, pending } = registry();
  const existing = proxies.get(key);
  if (existing) return Promise.resolve(`http://${advertisedHost}:${existing.port}`);
  const inflight = pending.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const server = createProxy(upstream, advertisedHost);
    const port = await listen(server);
    proxies.set(key, { port, server });
    return `http://${advertisedHost}:${port}`;
  })().finally(() => {
    pending.delete(key);
  });
  pending.set(key, promise);
  return promise;
}
