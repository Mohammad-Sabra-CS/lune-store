// CF-0 HTTP checks against the actual local Workers runtime, not `next start`.
// No login, checkout, database mutation, remote binding or deployment is used.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

assert.equal(
  readdirSync(".").some((name) => /^(\.env($|\.)|\.dev\.vars($|\.))/.test(name)),
  false,
  "Run CF-0 in a clean checkout without local env files",
);
mkdirSync(".cf0-results", { recursive: true });
const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  WRANGLER_SEND_METRICS: "false",
  CLOUDFLARE_CF_FETCH_ENABLED: "false",
};
for (const key of [
  "DATABASE_URL", "ADMIN_PASSWORD", "RESEND_API_KEY", "EMAIL_FROM",
  "BLOB_READ_WRITE_TOKEN", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_EMAIL", "WRANGLER_API_TOKEN",
]) delete env[key];

const port = 3102;
const origin = `http://127.0.0.1:${port}`;
// These are the two local operations performed by OpenNext's preview command.
// Start Wrangler directly so its stderr is retained when the server stops.
const population = spawnSync(process.execPath, [
  "node_modules/@opennextjs/cloudflare/dist/cli/index.js", "populateCache", "local",
], { env, encoding: "utf8", timeout: 60000 });
if (population.error) throw population.error;
assert.equal(population.status, 0, "Local R2 cache population failed");
let output = (population.stdout ?? "") + (population.stderr ?? "");
const child = spawn(process.execPath, [
  "node_modules/wrangler/bin/wrangler.js", "dev",
  "--local", "--ip", "127.0.0.1", "--port", String(port),
  "--inspector-port", "9235",
], { env, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
let finishStartup;
const ready = new Promise((resolve, reject) => {
  finishStartup = resolve;
  child.once("error", reject);
  child.once("exit", (code) => reject(new Error(`Workers exited before readiness (${code})`)));
});
for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (chunk) => {
    output += chunk.toString();
    if (output.includes(`Ready on ${origin}`)) finishStartup();
  });
}
let startupTimer;
const results = [];
const fetchLocal = (path, options = {}) => fetch(`${origin}${path}`, {
  ...options, redirect: "manual", signal: AbortSignal.timeout(15000),
});
async function check(name, run) {
  try {
    await run();
    results.push({ name, status: "PASS" });
    console.log(`PASS ${name}`);
  } catch (error) {
    const detail = error.message.slice(0, 400);
    results.push({ name, status: "FAIL", detail });
    console.error(`FAIL ${name}: ${detail}`);
  }
}
async function htmlPage(path, locale) {
  const response = await fetchLocal(path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.match(html, new RegExp(`<html[^>]*lang="${locale}"`));
  assert.match(html, new RegExp(`<html[^>]*dir="${locale === "ar" ? "rtl" : "ltr"}"`));
  assert.ok(!response.headers.get("location"), "Unexpected locale redirect");
  return html;
}

try {
  await Promise.race([ready, new Promise((_, reject) => {
    startupTimer = setTimeout(() => reject(new Error("Workers startup exceeded 90 seconds")), 90000);
  })]);
  clearTimeout(startupTimer);
  console.log("Local Workers runtime ready");

  for (const [name, path, headers, expected] of [
    ["default locale", "/", {}, "/en"],
    ["Arabic language detection", "/", { "accept-language": "ar-JO,ar;q=0.9,en;q=0.8" }, "/ar"],
    ["locale cookie and query preserved", "/?audience=women", { cookie: "NEXT_LOCALE=ar" }, "/ar?audience=women"],
    ["unprefixed shop", "/shop?audience=men", {}, "/en/shop?audience=men"],
  ]) {
    await check(`G1 ${name}`, async () => {
      const response = await fetchLocal(path, { headers });
      assert.ok([307, 308].includes(response.status));
      const destination = new URL(response.headers.get("location"), origin);
      assert.equal(destination.pathname + destination.search, expected);
      assert.equal(destination.origin, origin);
    });
  }

  let homepage;
  for (const locale of ["en", "ar"]) {
    for (const route of ["", "/shop?audience=women", "/checkout", ...["apollo", "orion", "elysia", "aurora"].map((slug) => `/product/${slug}`)]) {
      await check(`G1 /${locale}${route}`, async () => {
        const html = await htmlPage(`/${locale}${route}`, locale);
        if (locale === "en" && route === "") homepage = html;
      });
    }
    await check(`G1 /${locale}/shop RSC`, async () => {
      // Next 16 canonicalizes an RSC request without its cache-key query to
      // ?_rsc first. Include that request shape for a direct check.
      const response = await fetchLocal(`/${locale}/shop?_rsc`, { headers: { rsc: "1" } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /text\/x-component/);
      assert.match(await response.text(), /Apollo/);
    });
    await check(`G3 /${locale}/missing-page`, async () => {
      const response = await fetchLocal(`/${locale}/cf0-missing-page`);
      assert.equal(response.status, 404);
      assert.ok((await response.text()).includes(locale === "ar" ? "الصفحة غير موجودة" : "Page not found"), "Missing localized 404 copy");
    });
  }

  await check("G1 admin excluded from locale redirects", async () => {
    const response = await fetchLocal("/admin", { headers: { "accept-language": "ar" } });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /noindex/);
    assert.match(response.headers.get("cache-control") ?? "", /private|no-store/);
  });
  for (const path of ["/api/cf0-missing", "/admin/cf0-missing-page"]) {
    await check(`G3 excluded route status ${path}`, async () => {
      const response = await fetchLocal(path);
      assert.equal(response.status, 404);
      const html = await response.text();
      assert.ok(html.includes("noindex"), "Error response should be noindex");
    });
  }
  await check("G3 global-not-found artifact compiled", async () => {
    const html = readFileSync(".next/server/app/_not-found.html", "utf8");
    assert.ok(html.includes("Page not found") && html.includes("الصفحة غير موجودة"));
  });
  await check("G4 hashed asset served immutably", async () => {
    const asset = homepage?.match(/(?:src|href)="([^\"]*\/_next\/static\/[^\"]+\.(?:js|css))"/)?.[1];
    assert.ok(asset, "No hashed JS/CSS asset in homepage");
    const response = await fetchLocal(asset);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /immutable/);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  });
  await check("G4 local image binding", async () => {
    const response = await fetchLocal("/_next/image?url=%2Fproducts%2Fapollo-box.jpg&w=640&q=75");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /image\//);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  });
} catch (error) {
  results.push({ name: "Workers startup", status: "FAIL", detail: error.message });
  console.error(error.message);
} finally {
  clearTimeout(startupTimer);
  if (child.pid) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    else {
      try { process.kill(-child.pid, "SIGTERM"); } catch { /* already stopped */ }
    }
  }
  writeFileSync(".cf0-results/worker.log", output);
  writeFileSync(".cf0-results/smoke.json", JSON.stringify({
    runtime: "local workerd; OpenNext populateCache local + wrangler dev --local",
    node: process.version,
    buildId: readFileSync(".next/BUILD_ID", "utf8").trim(),
    database: "not configured; fixture pages only",
    results,
  }, null, 2) + "\n");
}
process.exitCode = results.some((result) => result.status === "FAIL") ? 1 : 0;
