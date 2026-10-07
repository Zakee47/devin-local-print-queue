import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { chromium } from "playwright-core";
import { build } from "esbuild";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(repoRoot, "public", "hero");
const modelsDir = join(repoRoot, "public", "models");
const variants = ["mascot", "cognition-light", "cognition-dark"];
const fps = Number(process.env.HERO_FPS ?? 10);
const durationSeconds = Number(process.env.HERO_DURATION ?? 12);
const frameSize = Number(process.env.HERO_SIZE ?? 384);
const quality = Number(process.env.HERO_Q ?? 45);
const stillQuality = Number(process.env.HERO_STILL_Q ?? 80);
const frameCount = Math.round(fps * durationSeconds);
const chromePath = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";

const modelFiles = new Set(["cognition-keychain.stl", "devin-mascot-keychain.stl"]);

if (
  !Number.isInteger(fps) ||
  fps <= 0 ||
  durationSeconds <= 0 ||
  !Number.isInteger(frameSize) ||
  frameSize <= 0 ||
  frameSize % 2 !== 0 ||
  quality < 0 ||
  quality > 100 ||
  stillQuality < 0 ||
  stillQuality > 100
) {
  throw new Error("Invalid render settings; check HERO_FPS, HERO_DURATION, HERO_SIZE, HERO_Q, and HERO_STILL_Q");
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with ${code ?? signal}`));
    });
  });
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function buildSceneBundle() {
  const result = await build({
    entryPoints: [join(repoRoot, "scripts", "hero-loop", "scene.ts")],
    bundle: true,
    format: "iife",
    globalName: "HeroLoop",
    platform: "browser",
    target: "es2020",
    alias: { "@": repoRoot },
    write: false,
  });
  return result.outputFiles[0].contents;
}

async function startServer(bundle, frameDir) {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "GET" && requestUrl.pathname === "/") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(
          `<!doctype html><html><body style="margin:0;background:transparent"><canvas width="${frameSize}" height="${frameSize}"></canvas><script src="/scene.js"></script></body></html>`
        );
        return;
      }
      if (request.method === "GET" && requestUrl.pathname === "/scene.js") {
        response.writeHead(200, {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "no-store",
        });
        response.end(bundle);
        return;
      }
      if (request.method === "GET" && requestUrl.pathname.startsWith("/models/")) {
        const fileName = requestUrl.pathname.slice("/models/".length);
        if (!modelFiles.has(fileName) || extname(fileName) !== ".stl") {
          response.writeHead(404);
          response.end();
          return;
        }
        response.writeHead(200, { "content-type": "model/stl" });
        response.end(await readFile(join(modelsDir, fileName)));
        return;
      }
      const frameMatch = requestUrl.pathname.match(/^\/frames\/([^/]+)\/(f\d{4})\.png$/);
      if (request.method === "POST" && frameMatch && variants.includes(frameMatch[1])) {
        const filePath = join(frameDir, frameMatch[1], `${frameMatch[2]}.png`);
        await writeFile(filePath, await readRequestBody(request));
        response.writeHead(204);
        response.end();
        return;
      }
      response.writeHead(404);
      response.end();
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  return server;
}

async function renderVariant(page, baseUrl, variant, frameDir) {
  await page.goto(`${baseUrl}/?variant=${variant}`, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.HeroLoop));
  await page.evaluate(
    async ({ baseUrl: origin, frameCount: count, variant: currentVariant }) => {
      const canvas = document.querySelector("canvas");
      if (!canvas) throw new Error("Hero render canvas was not found");
      const renderer = await window.HeroLoop.createHeroScene(canvas, currentVariant);
      for (let frame = 0; frame < count; frame += 1) {
        renderer.draw(frame, count);
        const dataUrl = canvas.toDataURL("image/png");
        const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
        const binary = atob(encoded);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const response = await fetch(
          `${origin}/frames/${currentVariant}/f${String(frame).padStart(4, "0")}.png`,
          { method: "POST", body: bytes }
        );
        if (!response.ok) throw new Error(`Couldn't save frame ${frame}: HTTP ${response.status}`);
      }
      renderer.dispose();
    },
    { baseUrl, frameCount, variant }
  );
  console.log(`Rendered ${variant}: ${frameCount} frames`);

  const inputPattern = join(frameDir, variant, "f%04d.png");
  const loopPath = join(assetsDir, `${variant}.webp`);
  const stillPath = join(assetsDir, `${variant}-still.webp`);
  await run("ffmpeg", [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    inputPattern,
    "-c:v",
    "libwebp_anim",
    "-lossless",
    "0",
    "-preset",
    "picture",
    "-q:v",
    String(quality),
    "-compression_level",
    "6",
    "-pix_fmt",
    "yuva420p",
    "-loop",
    "0",
    loopPath,
  ]);
  await run("ffmpeg", [
    "-y",
    "-i",
    join(frameDir, variant, "f0000.png"),
    "-frames:v",
    "1",
    "-c:v",
    "libwebp",
    "-lossless",
    "0",
    "-q:v",
    String(stillQuality),
    "-compression_level",
    "6",
    "-pix_fmt",
    "yuva420p",
    stillPath,
  ]);
}

async function main() {
  await mkdir(assetsDir, { recursive: true });
  const bundle = await buildSceneBundle();
  const frameDir = await mkdtemp(join(tmpdir(), "hero-loop-frames-"));
  const userDataDir = await mkdtemp(join(tmpdir(), "hero-loop-chrome-"));
  let server;
  let browser;

  try {
    server = await startServer(bundle, frameDir);
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Could not determine render server port");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launchPersistentContext(userDataDir, {
      executablePath: chromePath,
      headless: true,
      viewport: { width: frameSize, height: frameSize },
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
    });
    const page = await browser.newPage();

    for (const variant of variants) {
      await mkdir(join(frameDir, variant), { recursive: true });
      await renderVariant(page, baseUrl, variant, frameDir);
    }
  } finally {
    await browser?.close();
    if (server) await new Promise((resolvePromise) => server.close(resolvePromise));
    await rm(frameDir, { recursive: true, force: true });
    await rm(userDataDir, { recursive: true, force: true });
  }

  console.log(
    `Hero loops: ${frameSize}x${frameSize}, ${fps} fps, ${durationSeconds}s, ${frameCount} frames, q=${quality}; still q=${stillQuality}, Chrome=${chromePath}`
  );
  const sizes = {};
  for (const variant of variants) {
    const loopSize = (await stat(join(assetsDir, `${variant}.webp`))).size;
    const stillSize = (await stat(join(assetsDir, `${variant}-still.webp`))).size;
    sizes[variant] = loopSize;
    console.log(`${variant}: ${loopSize} bytes loop, ${stillSize} bytes still`);
  }

  const themePairs = [
    ["light", sizes.mascot + sizes["cognition-light"]],
    ["dark", sizes.mascot + sizes["cognition-dark"]],
  ];
  for (const [theme, total] of themePairs) {
    console.log(`${theme} loop pair: ${total} bytes`);
    if (total > 650_000) {
      throw new Error(`${theme} loop pair exceeds the 650 KB budget`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
