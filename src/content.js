// x.comの配色をGruvbox Light/Dark Mediumに置き換えるコンテンツスクリプト。
// XのスタイルはReact Native Webが実行時に生成する原子的CSSクラスとインラインstyle属性に色リテラルとして埋め込まれており、クラス名もビルドごとに変わるため、セレクタで上書きせず、現れた色リテラルを元の色ごとのCSS変数(--xgb-c-<hex>)の参照に書き換える。
// 同じ色でもXの表示モード(デフォルト/ダークブルー/ブラック)によって役割が変わる(例: #0f1419はライトでは本文色、ブラックではボタン上の文字色)ため、変数の中身はhtml[data-xgb-source]ごとに定義し、モード切替に書き換え済みのルールを触らずに追従できるようにしている。
// Gruvboxのライト/ダークはhakhatz.devと同じくOSのprefers-color-schemeに連動させる。
// manifestでworld: "MAIN"を指定しているのは、Xのスクリプトより先にCSSStyleSheet.prototype.insertRuleを差し替える必要があるため(隔離ワールドのプロトタイプはページ側と別物で、差し替えても効かない)。
(() => {
  "use strict";

  // 値はhakhatz.devのstyle.cssと同じGruvbox Mediumの色。
  // 背景はlight0/dark0、本文はdark0/light0、リンク色はfaded-blue/bright-blue、ホバー色はfaded-purple/bright-purpleで、サイトと揃えている。
  const ROLES = {
    light: {
      bg: "#fbf1c7",
      "bg-soft": "#f2e5bc",
      "bg-1": "#ebdbb2",
      "bg-2": "#d5c4a1",
      "bg-3": "#bdae93",
      fg: "#282828",
      // dark4(#7c6f64)はlight0上で4.29:1しかなくWCAG AAの4.5:1に届かないため、補助文字にはdark3を使う。
      "fg-muted": "#665c54",
      blue: "#076678",
      "blue-hover": "#8f3f71",
      red: "#9d0006",
      // faded-green/faded-aquaはlight0上で4.29:1/4.40:1とわずかにAAに届かないため、dark0を5%だけ混ぜて4.5:1を超えさせる。
      green: "color-mix(in srgb, #79740e 95%, #282828)",
      aqua: "color-mix(in srgb, #427b58 95%, #282828)",
      // faded-yellowは3.33:1だが、Xで黄色が使われるのは認証バッジ等のアイコン(非テキストの基準3:1)なので補正しない。
      yellow: "#b57614",
      orange: "#af3a03",
      purple: "#8f3f71",
    },
    dark: {
      bg: "#282828",
      "bg-soft": "#32302f",
      "bg-1": "#3c3836",
      "bg-2": "#504945",
      "bg-3": "#665c54",
      fg: "#fbf1c7",
      // light4(#a89984)はdark1上で4.17:1になるため、一段明るいlight3を使う。
      "fg-muted": "#bdae93",
      blue: "#83a598",
      "blue-hover": "#d3869b",
      // bright-redはdark0上で4.29:1とAAに届かないため、light0を10%混ぜる。
      red: "color-mix(in srgb, #fb4934 90%, #fbf1c7)",
      green: "#b8bb26",
      aqua: "#8ec07c",
      yellow: "#fabd2f",
      orange: "#fe8019",
      purple: "#d3869b",
    },
  };

  // 無彩色(灰色系)は、元の色の明度に最も近い基準点の役割へ割り当てる。
  // 基準点はXが実際に使う色の明度(HSLのL)で、ライトは2026年11月にx.comで実測した値、ダークブルーとブラックは過去の配色からの推定値。
  const NEUTRAL_ANCHORS = {
    light: [
      [1.0, "bg"], // #ffffff 背景
      [0.973, "bg-soft"], // #f7f9f9 サイドパネル
      [0.947, "bg-1"], // #eff3f4 区切り線・検索欄
      [0.86, "bg-2"], // #cfd9de ボタンの枠線
      [0.776, "bg-3"], // #b9cad3 スクロールバー
      [0.59, "fg-muted"], // #829aab
      [0.385, "fg-muted"], // #536471 補助文字
      [0.078, "fg"], // #0f1419 本文
    ],
    dim: [
      [0.125, "bg"], // #15202b
      [0.157, "bg-soft"], // #1e2732
      [0.202, "bg-1"], // #273340
      [0.261, "bg-2"], // #38444d
      [0.4, "bg-3"],
      [0.596, "fg-muted"], // #8b98a5
      [0.97, "fg"], // #f7f9f9
    ],
    dark: [
      [0.0, "bg"], // #000000
      [0.098, "bg-soft"], // #16181c
      [0.14, "bg-1"], // #202327
      [0.198, "bg-2"], // #2f3336
      [0.385, "bg-3"], // #536471 ボタンの枠線
      [0.463, "fg-muted"], // #71767b
      [0.91, "fg"], // #e7e9ea
    ],
  };

  // 明度だけでは役割を判定できない色の個別指定。
  // ダーク系モードの#ffffffと、ブラックモードの#0f1419は、濃色背景の上の文字ではなく明色ボタンや青ボタンの上の文字として使われるため、背景色と同じ役割にして反転を保つ。
  const OVERRIDES = {
    "1a8cd8": { light: "blue-hover", dim: "blue-hover", dark: "blue-hover" },
    ffffff: { dim: "bg", dark: "bg" },
    "0f1419": { dark: "bg" },
  };

  // Xの青系灰色(#536471の彩度幅は約0.12)を無彩色として扱いつつ、アクセント色(最小でも約0.28)は有彩色として残す閾値。
  const NEUTRAL_CHROMA = 0.2;

  // bodyの背景色から表示モードを判定する(Xは表示モードを本体のbody要素のインラインstyleに反映する)。
  const SOURCE_BY_BODY_BG = { ffffff: "light", "15202b": "dim", "000000": "dark" };

  // いいね・リポスト・ブックマークは押したかどうかがXのピンク・緑・青で一目で分かることを優先し、ボタン内の有彩色だけ元の色に戻す。
  // 押す前後でdata-testidが切り替わる(like→unlike、retweet→unretweet、bookmark→removeBookmark)ため両方を指定する。
  const KEEP_ORIGINAL_SELECTOR =
    ':is([data-testid="like"], [data-testid="unlike"], [data-testid="retweet"], [data-testid="unretweet"], [data-testid="bookmark"], [data-testid="removeBookmark"])';

  const STORAGE_KEY = "xgb-source";

  const root = document.documentElement;
  if (!root) return;

  // bodyの背景色が分かるまでの間に別モードの配色で一瞬描画されるのを避けるため、前回判定したモードを先に適用する。
  let source = "light";
  try {
    source = localStorage.getItem(STORAGE_KEY) || "light";
  } catch {
    // ストレージが使えない環境ではデフォルトのライトモードとして扱う。
  }
  root.dataset.xgbSource = source;

  const ownStyle = document.createElement("style");
  ownStyle.id = "xgb-theme";
  const roleDecls = (roles) =>
    Object.entries(roles)
      .map(([name, value]) => `--xgb-r-${name}: ${value};`)
      .join(" ");
  // Xがhtml要素のインラインstyleでcolor-schemeを指定するため、スクロールバーやフォーム部品の配色を合わせるには!importantで上書きする必要がある。
  ownStyle.textContent =
    `:root { color-scheme: light !important; ${roleDecls(ROLES.light)} }\n` +
    `@media (prefers-color-scheme: dark) { :root { color-scheme: dark !important; ${roleDecls(ROLES.dark)} } }`;
  // document_start時点ではheadがまだ無いため、html要素の直下に置く。
  root.appendChild(ownStyle);
  const ownSheet = ownStyle.sheet;

  // insertRuleを差し替える前に作っておくことで、自前のルール追加が書き換え処理を通らないようにする。
  const sourceRules = {};
  for (const name of Object.keys(NEUTRAL_ANCHORS)) {
    const index = ownSheet.insertRule(`html[data-xgb-source="${name}"] {}`, ownSheet.cssRules.length);
    sourceRules[name] = ownSheet.cssRules[index];
  }
  // ボタン要素自身に変数を定義すれば、html要素で定義した値より優先して子孫に継承される。
  const keepOriginalRule = ownSheet.cssRules[ownSheet.insertRule(`${KEEP_ORIGINAL_SELECTOR} {}`, ownSheet.cssRules.length)];
  const defined = new Set();

  function analyze([r, g, b]) {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const chroma = max - min;
    let hue = 0;
    if (chroma > 0) {
      const [rn, gn, bn] = [r / 255, g / 255, b / 255];
      if (max === rn) hue = ((gn - bn) / chroma) % 6;
      else if (max === gn) hue = (bn - rn) / chroma + 2;
      else hue = (rn - gn) / chroma + 4;
      hue = (hue * 60 + 360) % 360;
    }
    return { hue, lightness: (max + min) / 2, chroma };
  }

  // Gruvboxにピンクが無いため、いいねのピンク(#f91880)は色相の近いpurpleに寄せる。
  function hueRole(hue) {
    if (hue < 15 || hue >= 345) return "red";
    if (hue < 40) return "orange";
    if (hue < 70) return "yellow";
    if (hue < 140) return "green";
    if (hue < 190) return "aqua";
    if (hue < 250) return "blue";
    return "purple";
  }

  function roleValue(hex, rgb, sourceName) {
    const override = OVERRIDES[hex]?.[sourceName];
    if (override) return `var(--xgb-r-${override})`;
    const { hue, lightness, chroma } = analyze(rgb);
    if (chroma < NEUTRAL_CHROMA) {
      let best = NEUTRAL_ANCHORS[sourceName][0];
      for (const anchor of NEUTRAL_ANCHORS[sourceName]) {
        if (Math.abs(anchor[0] - lightness) < Math.abs(best[0] - lightness)) best = anchor;
      }
      return `var(--xgb-r-${best[1]})`;
    }
    const role = hueRole(hue);
    // 背景に近い明度の有彩色はエラー表示の薄い赤背景などの「色付き背景」なので、アクセント色そのものにすると文字が読めなくなる。
    const isTint = sourceName === "light" ? lightness > 0.88 : lightness < 0.2;
    return isTint ? `color-mix(in srgb, var(--xgb-r-${role}) 18%, var(--xgb-r-bg))` : `var(--xgb-r-${role})`;
  }

  function define(hex, rgb) {
    if (defined.has(hex)) return;
    defined.add(hex);
    for (const [name, rule] of Object.entries(sourceRules)) {
      rule.style.setProperty(`--xgb-c-${hex}`, roleValue(hex, rgb, name));
    }
    // 灰色のアイコンや文字まで元に戻すとGruvboxの背景上で浮くため、有彩色だけを戻す。
    if (analyze(rgb).chroma >= NEUTRAL_CHROMA) keepOriginalRule.style.setProperty(`--xgb-c-${hex}`, `#${hex}`);
  }

  const COLOR_RE =
    /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|rgba?\(\s*(\d{1,3})\s*,?\s*(\d{1,3})\s*,?\s*(\d{1,3})\s*(?:[,/]\s*([\d.]+)(%?))?\s*\)/gi;

  function parseHex(digits) {
    const full = digits.length <= 4 ? [...digits].map((c) => c + c).join("") : digits;
    const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    const alpha = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
    return { rgb, alpha };
  }

  const toHex = (rgb) => rgb.map((v) => Math.min(255, v).toString(16).padStart(2, "0")).join("");

  // 書き換え済みの値はフォールバックに元の色(#hex)を含むため、--xgb-を含む値は再処理しない。
  // url()内の#はフラグメント識別子である可能性があり、色と区別できないので値ごと触らない。
  function rewriteValue(value) {
    if (!value || value.includes("--xgb-") || /url\(/i.test(value)) return null;
    let changed = false;
    const result = value.replace(COLOR_RE, (match, hexDigits, r, g, b, a, percent) => {
      let rgb;
      let alpha = 1;
      if (hexDigits) {
        ({ rgb, alpha } = parseHex(hexDigits.toLowerCase()));
      } else {
        rgb = [r, g, b].map(Number);
        if (a !== undefined) alpha = percent ? Number(a) / 100 : Number(a);
      }
      if (alpha === 0) return match;
      const hex = toHex(rgb);
      define(hex, rgb);
      changed = true;
      const ref = `var(--xgb-c-${hex}, #${hex})`;
      // 半透明の色はホバー時の重ね塗りや影に使われるため、透明度を保ったまま色だけを置き換える。
      return alpha >= 1 ? ref : `color-mix(in srgb, ${ref} ${Math.round(alpha * 1000) / 10}%, transparent)`;
    });
    return changed ? result : null;
  }

  function rewriteDeclaration(style) {
    for (let i = 0; i < style.length; i++) {
      const property = style[i];
      const next = rewriteValue(style.getPropertyValue(property));
      if (next) style.setProperty(property, next, style.getPropertyPriority(property));
    }
  }

  function rewriteRules(rules) {
    for (const rule of rules) {
      if (rule.style) rewriteDeclaration(rule.style);
      if (rule.cssRules) rewriteRules(rule.cssRules);
    }
  }

  function rewriteSheet(sheet) {
    if (!sheet || sheet === ownSheet) return;
    try {
      rewriteRules(sheet.cssRules);
    } catch {
      // 別オリジンのスタイルシートはcssRulesを読めない。
    }
  }

  function detectSource(backgroundColor) {
    const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(backgroundColor);
    if (!match) return;
    const detected = SOURCE_BY_BODY_BG[toHex(match.slice(1, 4).map(Number))];
    if (!detected || detected === source) return;
    source = detected;
    root.dataset.xgbSource = source;
    try {
      localStorage.setItem(STORAGE_KEY, source);
    } catch {
      // 保存できなくても次回の初期表示が一瞬ずれるだけなので無視する。
    }
  }

  const STYLE_HINT = /#|rgb/i;

  function rewriteElement(element) {
    const inline = element.getAttribute("style");
    if (!inline || !STYLE_HINT.test(inline) || !element.style) return;
    if (element === document.body) detectSource(element.style.backgroundColor);
    rewriteDeclaration(element.style);
  }

  function rewriteTree(node) {
    if (node.nodeName === "STYLE") rewriteSheet(node.sheet);
    rewriteElement(node);
    for (const element of node.querySelectorAll("[style]")) rewriteElement(element);
    for (const style of node.querySelectorAll("style")) rewriteSheet(style.sheet);
  }

  // React Native Webは原子的CSSをinsertRuleで1件ずつ追加するため、追加直後のルールだけを書き換える。
  for (const proto of [CSSStyleSheet.prototype, CSSGroupingRule.prototype]) {
    const original = proto.insertRule;
    proto.insertRule = function (...args) {
      const index = original.apply(this, args);
      try {
        rewriteRules([this.cssRules[index]]);
      } catch {
        // 書き換えに失敗してもXの描画は止めない。
      }
      return index;
    };
  }

  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        rewriteElement(record.target);
        continue;
      }
      // style要素の中身(テキストノード)が差し替えられた場合は、要素自体が追加されなくてもシートが作り直される。
      if (record.target.nodeName === "STYLE") rewriteSheet(record.target.sheet);
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) rewriteTree(node);
      }
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });

  for (const sheet of document.styleSheets) rewriteSheet(sheet);
  rewriteTree(root);
})();
