// Unit tests for the SSRF guard (src/security.ts). Pure / IP-literal paths only,
// so no DNS or network is required — safe to run in CI.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isPrivateAddress, assertSafePublicUrl, guardedLookup } = require("../build/security.js");

const lookup = (host, opts) => new Promise((resolve, reject) => guardedLookup(host, opts, (e, a) => (e ? reject(e) : resolve(a))));

test("guardedLookup rejects a host that resolves to a private address (DNS-rebinding guard)", async () => {
  // localhost resolves to a loopback address — must be refused at connect time
  await assert.rejects(() => lookup("localhost", { family: 4 }));
});

test("guardedLookup allows a public IP literal", async () => {
  assert.equal(await lookup("8.8.8.8", {}), "8.8.8.8");
});

test("isPrivateAddress blocks private/loopback/link-local/CGNAT/metadata/multicast IPv4", () => {
  for (const ip of [
    "0.0.0.0", "10.0.0.1", "127.0.0.1", "169.254.0.1", "169.254.169.254",
    "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "100.127.0.0",
    "224.0.0.1", "239.0.0.1", "255.255.255.255",
  ]) {
    assert.equal(isPrivateAddress(ip), true, `${ip} should be private`);
  }
});

test("isPrivateAddress allows genuinely public IPv4 (incl. range boundaries)", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.0.1", "172.32.0.1", "100.63.0.1", "100.128.0.1"]) {
    assert.equal(isPrivateAddress(ip), false, `${ip} should be public`);
  }
});

test("isPrivateAddress handles IPv6 loopback/ULA/link-local + IPv4-mapped", () => {
  for (const ip of ["::1", "::", "fc00::1", "fd12::34", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), true, `${ip} should be private`);
  }
  for (const ip of ["2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8"]) {
    assert.equal(isPrivateAddress(ip), false, `${ip} should be public`);
  }
});

test("assertSafePublicUrl rejects non-http(s) schemes", async () => {
  await assert.rejects(() => assertSafePublicUrl("ftp://example.com/x"));
  await assert.rejects(() => assertSafePublicUrl("file:///etc/passwd"));
});

test("assertSafePublicUrl rejects internal hostnames", async () => {
  for (const u of ["http://localhost/", "http://api.localhost/", "http://svc.internal/"]) {
    await assert.rejects(() => assertSafePublicUrl(u), undefined, u);
  }
});

test("assertSafePublicUrl rejects private/loopback/metadata IP literals (no DNS)", async () => {
  for (const u of [
    "http://127.0.0.1/", "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/", "http://192.168.0.1/", "http://10.1.2.3/", "http://[fd00::1]/",
  ]) {
    await assert.rejects(() => assertSafePublicUrl(u), undefined, u);
  }
});

test("assertSafePublicUrl rejects a malformed URL", async () => {
  await assert.rejects(() => assertSafePublicUrl("not a url"));
});

test("assertSafePublicUrl allows public IP literals", async () => {
  await assert.doesNotReject(() => assertSafePublicUrl("http://8.8.8.8/"));
  await assert.doesNotReject(() => assertSafePublicUrl("https://1.1.1.1/path"));
});
