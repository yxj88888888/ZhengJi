const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');

function ruleFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[2];
}

const htmlRule = ruleFor('html');
if (!/height\s*:\s*100%/.test(htmlRule) || !/overflow\s*:\s*hidden/.test(htmlRule)) {
  throw new Error('HTML root should lock the page to one viewport');
}

const bodyRule = ruleFor('body');
if (!/height\s*:\s*100vh/.test(bodyRule) ||
    !/height\s*:\s*100dvh/.test(bodyRule) ||
    !/overflow\s*:\s*hidden/.test(bodyRule) ||
    !/display\s*:\s*flex/.test(bodyRule) ||
    !/flex-direction\s*:\s*column/.test(bodyRule)) {
  throw new Error('Body should be a fixed one-page vertical flex layout using the visible TV viewport');
}
if (!/background\s*:\s*var\(--bg-primary\)/.test(bodyRule) ||
    !/--bg-primary:\s*#f4ead8/.test(css)) {
  throw new Error('Fixed TV page should use a warm cream background instead of black');
}

const mainRule = ruleFor('.main-container');
if (!/flex\s*:\s*1\s+1\s+auto/.test(mainRule) ||
    !/min-height\s*:\s*0/.test(mainRule) ||
    !/overflow\s*:\s*hidden/.test(mainRule)) {
  throw new Error('Main container should fill remaining viewport without scrolling');
}

const sectionRule = ruleFor('.page-section.active');
if (!/display\s*:\s*flex/.test(sectionRule) || !/flex-direction\s*:\s*column/.test(sectionRule)) {
  throw new Error('Active page section should use a vertical flex layout');
}

const carouselRule = ruleFor('.certificate-carousel');
if (!/flex\s*:\s*0\s+1\s+auto/.test(carouselRule) ||
    !/width\s*:\s*100%/.test(carouselRule) ||
    !/aspect-ratio\s*:\s*2\.12/.test(carouselRule) ||
    !/min-height\s*:\s*0/.test(carouselRule)) {
  throw new Error('Certificate carousel should align with the price card while staying compact');
}

const portraitMarker = '@media (orientation: portrait) and (min-width: 520px) and (max-aspect-ratio: 3/4)';
const portraitStart = css.indexOf(portraitMarker);
if (portraitStart === -1) {
  throw new Error('Expected a 9:16 portrait layout media query');
}
const portraitNext = css.indexOf('\n@media', portraitStart + portraitMarker.length);
const portraitBlock = css.slice(portraitStart, portraitNext === -1 ? css.length : portraitNext);
if (!/\.price-hero\s*\{[\s\S]*flex:\s*1\s+1\s+auto[\s\S]*min-height:\s*clamp\(304px,\s*34vh,\s*620px\)[\s\S]*display:\s*flex/.test(portraitBlock)) {
  throw new Error('Portrait signage layout should let the price area fill spare vertical space');
}
if (!/\.price-combo-card\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)[\s\S]*grid-template-rows:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(portraitBlock)) {
  throw new Error('Portrait signage layout should stretch the four-grid price area evenly');
}
if (!/\.certificate-carousel\s*\{[\s\S]*flex:\s*0\s+1\s+auto[\s\S]*aspect-ratio:\s*auto[\s\S]*height:\s*clamp\(150px,\s*19vh,\s*360px\)[\s\S]*max-height:\s*21vh/.test(portraitBlock)) {
  throw new Error('Portrait signage layout should shrink certificate display to preserve one-page browsing');
}
if (!/\.page-section\.active\s*\{[\s\S]*gap:\s*clamp\(8px,\s*0\.9vh,\s*14px\)[\s\S]*justify-content:\s*flex-start/.test(portraitBlock)) {
  throw new Error('Portrait signage layout should place market content directly below the header');
}
if (!/\.fixed-price-note\s*\{[\s\S]*min-height:\s*clamp\(52px,\s*6vh,\s*82px\)[\s\S]*font-size:\s*clamp\(18px,\s*2\.75vw,\s*34px\)/.test(portraitBlock)) {
  throw new Error('Portrait bottom note should scale up with its text');
}
if (!/\.header-address\s*\{[\s\S]*color:\s*#3b2a14[\s\S]*font-size:\s*clamp\(45px,\s*7\.2vw,\s*64px\)[\s\S]*transform:\s*none[\s\S]*white-space:\s*normal/.test(portraitBlock) ||
    !/\.address-line\s*\{[\s\S]*display:\s*block/.test(css) ||
    !/\.address-main-line\s*\{[\s\S]*font-size:\s*1em[\s\S]*white-space:\s*nowrap[\s\S]*transform:\s*scaleX\(0\.62\)/.test(css) ||
    !/\.address-opposite-line\s*\{[\s\S]*font-size:\s*1em/.test(css)) {
  throw new Error('Portrait signage address should enlarge and wrap without overflowing');
}
if (!/grid-template-areas:\s*[\s\S]*"qr logo"[\s\S]*"qr time"[\s\S]*"address address"/.test(portraitBlock)) {
  throw new Error('Portrait signage header should keep QR, logo, and time in a compact layout');
}
if (!/\.header-inner\s*\{[\s\S]*grid-template-columns:\s*minmax\(176px,\s*26\.5vw\)\s+minmax\(0,\s*1fr\)/.test(portraitBlock) ||
    !/\.logo-section\s*\{[\s\S]*align-self:\s*center[\s\S]*min-height:\s*clamp\(140px,\s*15\.65vh,\s*165px\)[\s\S]*transform:\s*none/.test(portraitBlock) ||
    !/\.logo-circle\s*\{[\s\S]*width:\s*clamp\(104px,\s*14\.9vh,\s*160px\)/.test(portraitBlock) ||
    !/\.logo-title\s*\{[\s\S]*font-size:\s*clamp\(52px,\s*10\.8vw,\s*94px\)/.test(portraitBlock)) {
  throw new Error('Portrait signage logo should expand into the upper header space without crowding the time row');
}
if (!/\.admin-entry-link\s*\{[\s\S]*top:\s*clamp\(70px,\s*8vh,\s*105px\)[\s\S]*bottom:\s*auto/.test(portraitBlock)) {
  throw new Error('Portrait signage layout should keep the admin entry clear of market content');
}

const tvPortraitMarker = '@media (orientation: portrait) and (min-width: 650px) and (max-width: 760px) and (min-height: 1040px) and (max-aspect-ratio: 0.68)';
const tvPortraitStart = css.indexOf(tvPortraitMarker);
if (tvPortraitStart === -1) {
  throw new Error('Expected a dedicated 70:120 portrait TV layout media query');
}
const tvPortraitNext = css.indexOf('\n@media', tvPortraitStart + tvPortraitMarker.length);
const tvPortraitBlock = css.slice(tvPortraitStart, tvPortraitNext === -1 ? css.length : tvPortraitNext);
if (!/\.page-section\.active\s*\{[\s\S]*gap:\s*clamp\(9px,\s*0\.9vh,\s*12px\)[\s\S]*justify-content:\s*flex-start/.test(tvPortraitBlock)) {
  throw new Error('70:120 TV layout should start content directly below the header');
}
if (!/\.price-combo-card\s*\{[\s\S]*grid-template-rows:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[\s\S]*border-width:\s*2px/.test(tvPortraitBlock)) {
  throw new Error('70:120 TV layout should stretch the four price grid');
}
if (!/\.certificate-carousel\s*\{[\s\S]*height:\s*clamp\(170px,\s*18vh,\s*230px\)[\s\S]*max-height:\s*18vh/.test(tvPortraitBlock)) {
  throw new Error('70:120 TV layout should keep the certificate carousel compact');
}
if (!/\.header-qr-img\s*\{[\s\S]*width:\s*clamp\(150px,\s*13\.8vh,\s*166px\)[\s\S]*height:\s*clamp\(150px,\s*13\.8vh,\s*166px\)/.test(tvPortraitBlock)) {
  throw new Error('70:120 TV layout should keep the QR code large enough to scan');
}
if (!/\.fixed-price-note\s*\{[\s\S]*min-height:\s*clamp\(58px,\s*5\.9vh,\s*72px\)[\s\S]*font-size:\s*clamp\(20px,\s*3\.2vw,\s*25px\)/.test(tvPortraitBlock)) {
  throw new Error('70:120 TV bottom note should remain readable within one page');
}
if (!/\.header-address\s*\{[\s\S]*font-size:\s*clamp\(52px,\s*7\.8vw,\s*60px\)/.test(tvPortraitBlock) ||
    !/\.price-value\s*\{[\s\S]*font-size:\s*clamp\(144px,\s*22\.5vw,\s*174px\)[\s\S]*transform:\s*scaleX\(0\.5\)/.test(tvPortraitBlock) ||
    !/\.price-value-wrap\s*\{[\s\S]*flex-direction:\s*column/.test(tvPortraitBlock)) {
  throw new Error('70:120 TV layout should enlarge address and price text with safe maximums');
}

if (!/--brand-border:\s*#ffbb00/.test(css) ||
    !/\.logo-circle\s*\{[\s\S]*border:\s*4px\s+solid\s+var\(--brand-border\)/.test(css) ||
    !/\.logo-title\s*\{[\s\S]*font-size:\s*clamp\(44px,\s*5\.2vw,\s*68px\)[\s\S]*color:\s*var\(--brand-red\)/.test(css) ||
    !/\.logo-section\s*\{[\s\S]*align-self:\s*center[\s\S]*min-height:\s*clamp\(142px,\s*13\.5vh,\s*158px\)[\s\S]*transform:\s*none/.test(tvPortraitBlock) ||
    !/\.logo-circle\s*\{[\s\S]*width:\s*clamp\(128px,\s*12\.2vh,\s*144px\)/.test(tvPortraitBlock) ||
    !/\.logo-title\s*\{[\s\S]*font-size:\s*clamp\(76px,\s*11\.2vw,\s*86px\)/.test(tvPortraitBlock)) {
  throw new Error('70:120 TV layout should use the upper header space for an enlarged red brand mark');
}

const narrowPortraitMarker = '@media (orientation: portrait) and (min-width: 520px) and (max-width: 560px) and (max-aspect-ratio: 3/4)';
const narrowPortraitStart = css.indexOf(narrowPortraitMarker);
if (narrowPortraitStart === -1) {
  throw new Error('Expected a narrow portrait guard for the enlarged brand mark');
}
const narrowPortraitNext = css.indexOf('\n@media', narrowPortraitStart + narrowPortraitMarker.length);
const narrowPortraitBlock = css.slice(narrowPortraitStart, narrowPortraitNext === -1 ? css.length : narrowPortraitNext);
if (!/\.logo-circle\s*\{[\s\S]*width:\s*clamp\(104px,\s*14vh,\s*112px\)/.test(narrowPortraitBlock) ||
    !/\.logo-title\s*\{[\s\S]*font-size:\s*clamp\(52px,\s*10\.2vw,\s*56px\)/.test(narrowPortraitBlock)) {
  throw new Error('Narrow portrait guard should keep the enlarged brand mark inside the header');
}

const noteRule = ruleFor('.fixed-price-note');
if (/position\s*:\s*fixed/.test(noteRule) || !/flex\s*:\s*0\s+0\s+auto/.test(noteRule)) {
  throw new Error('Bottom note should live inside the fixed one-page layout, not overlay it');
}

console.log('page layout is locked to one viewport without vertical scrolling');
