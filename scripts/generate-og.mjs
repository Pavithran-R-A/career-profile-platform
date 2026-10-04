import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const output = resolve('public/og-cover.png');
await mkdir(dirname(output), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    background: #091426;
    color: #f8fafc;
  }
  .card {
    position: relative;
    width: 1200px;
    height: 630px;
    background: #0f2039;
    overflow: hidden;
    display: flex;
    align-items: center;
    padding: 54px 70px;
  }
  .orb1, .orb2 {
    position: absolute;
    border-radius: 999px;
    opacity: .95;
  }
  .orb1 { width: 370px; height: 370px; right: -65px; top: -118px; background: #173f70; }
  .orb2 { width: 360px; height: 360px; right: -126px; bottom: -125px; background: #0d607f; }
  .mark {
    position: relative;
    z-index: 2;
    width: 305px;
    height: 305px;
    border-radius: 74px;
    background: #091426;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 58px;
    flex: 0 0 auto;
  }
  .doc { position: relative; width: 132px; height: 170px; background: #f8fafc; }
  .fold {
    position: absolute; right: 0; top: 0; width: 0; height: 0;
    border-left: 43px solid transparent; border-bottom: 43px solid #286bff;
  }
  .head { position: absolute; left: 30px; top: 43px; width: 34px; height: 34px; border-radius: 50%; background: #091426; }
  .body {
    position: absolute; left: 22px; top: 82px; width: 50px; height: 23px;
    border-radius: 30px 30px 0 0; background: #091426;
  }
  .line { position: absolute; left: 22px; bottom: 34px; width: 60px; height: 14px; border-radius: 10px; background: #7f8ca1; }
  .bars { position: absolute; right: 24px; bottom: 58px; display: flex; align-items: end; gap: 10px; }
  .bar { width: 28px; border-radius: 14px; }
  .b1 { height: 58px; background: #286bff; }
  .b2 { height: 90px; background: #1688ff; }
  .b3 { height: 128px; background: #17c193; }
  .copy { position: relative; z-index: 2; width: 650px; }
  .brand { font-size: 100px; font-weight: 800; line-height: .94; letter-spacing: -4px; white-space: nowrap; }
  .brand .cv { color: #286bff; }
  .tagline { margin-top: 28px; font-size: 38px; font-weight: 750; line-height: 1.1; letter-spacing: .2px; }
  .features { margin-top: 26px; font-size: 31px; color: #b7c7df; white-space: nowrap; }
  .rule { margin-top: 34px; height: 10px; width: 420px; border-radius: 999px; background: #17c193; }
</style>
</head>
<body>
  <main class="card">
    <div class="orb1"></div>
    <div class="orb2"></div>
    <div class="mark" aria-hidden="true">
      <div class="doc">
        <div class="fold"></div>
        <div class="head"></div>
        <div class="body"></div>
        <div class="line"></div>
      </div>
      <div class="bars">
        <div class="bar b1"></div>
        <div class="bar b2"></div>
        <div class="bar b3"></div>
      </div>
    </div>
    <section class="copy">
      <div class="brand"><span class="cv">CV</span>entory</div>
      <div class="tagline">Your career. All in one place.</div>
      <div class="features">AI CV • ATS Resume • Career Profile • Portfolio</div>
      <div class="rule"></div>
    </section>
  </main>
</body>
</html>`);
  await page.screenshot({ path: output, type: 'png', fullPage: false });
} finally {
  await browser.close();
}

console.log(`Generated ${output}`);
