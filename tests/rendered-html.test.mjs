import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Flowcraft AI workflow builder", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Flowcraft — AI Workflow Builder<\/title>/i);
  assert.match(html, /Flowcraft/);
  assert.match(html, /Add step/);
  assert.match(html, /Test workflow/);
  assert.match(html, /Demo · Inbox triage &amp; draft reply/);
  assert.match(html, /Templates/);
  assert.match(html, /Local AI · Demo mailbox/);
  assert.match(html, /Primary navigation/);
  assert.match(html, />Demos</);
  assert.match(html, />Runs</);
  assert.match(html, /Connect from New email/);
  assert.match(html, /Draft reply/);
  assert.match(html, /Save draft/);
  assert.match(html, /Turn a new inbox message into a grounded, reviewable draft/);
  assert.match(html, /Agent trace/);
  assert.doesNotMatch(html, /Research Agent/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
