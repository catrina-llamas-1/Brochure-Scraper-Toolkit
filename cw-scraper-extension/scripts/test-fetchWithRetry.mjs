// Throwaway test runner, not part of the extension or CI.
import assert from "node:assert/strict";
import { fetchWithRetry } from "../src/net/fetchWithRetry.js";

// Test 1: success on first attempt
{
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return { ok: true, text: async () => "hello" };
  };
  const result = await fetchWithRetry("https://example.test/a", { delayMs: 1 });
  assert.deepEqual(result, { ok: true, data: "hello" });
  assert.equal(calls, 1);
  console.log("Test 1 (success first try) PASSED");
}

// Test 2: fails twice (HTTP 500), succeeds on 3rd (final) attempt
{
  let calls = 0;
  global.fetch = async () => {
    calls++;
    if (calls < 3) return { ok: false, status: 500 };
    return { ok: true, text: async () => "recovered" };
  };
  const result = await fetchWithRetry("https://example.test/b", { delayMs: 1, maxRetries: 2 });
  assert.deepEqual(result, { ok: true, data: "recovered" });
  assert.equal(calls, 3);
  console.log("Test 2 (retry then succeed) PASSED");
}

// Test 3: fails all attempts -> typed failure, never throws
{
  let calls = 0;
  global.fetch = async () => {
    calls++;
    throw new Error("network down");
  };
  const result = await fetchWithRetry("https://example.test/c", { delayMs: 1, maxRetries: 2 });
  assert.equal(result.ok, false);
  assert.equal(result.error, "network down");
  assert.equal(result.attempts, 3);
  assert.equal(calls, 3);
  console.log("Test 3 (all attempts fail -> typed failure, no throw) PASSED");
}

// Test 4: arraybuffer response type (for PDF fetches later)
{
  const fakeBuffer = new ArrayBuffer(8);
  global.fetch = async () => ({ ok: true, arrayBuffer: async () => fakeBuffer });
  const result = await fetchWithRetry("https://example.test/d.pdf", { delayMs: 1, responseType: "arraybuffer" });
  assert.equal(result.ok, true);
  assert.equal(result.data, fakeBuffer);
  console.log("Test 4 (arraybuffer response type) PASSED");
}

// Test 5: delay happens before every attempt, including the first
{
  const timestamps = [];
  global.fetch = async () => {
    timestamps.push(Date.now());
    return { ok: false, status: 503 };
  };
  const start = Date.now();
  await fetchWithRetry("https://example.test/e", { delayMs: 20, maxRetries: 1 });
  assert.equal(timestamps.length, 2);
  assert.ok(timestamps[0] - start >= 18, `first attempt should wait ~delayMs (20ms), got ${timestamps[0] - start}ms`);
  assert.ok(timestamps[1] - timestamps[0] >= 18, `retry should also wait, got ${timestamps[1] - timestamps[0]}ms`);
  console.log("Test 5 (delay before every attempt, including first) PASSED");
}

console.log("\nALL fetchWithRetry.js TESTS PASSED");
