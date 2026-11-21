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

  // 通知ページの各通知の左にあるマークも、いいねやリポストの通知を色で見分けられるよう元の色に戻す。
  // ただしXの青で描かれるマーク(フォローの人型、通知のベル)はユーザーの希望でテーマの青のままにするため、青だけは戻す対象から外す。
  // このマークにはdata-testidが無いため、通知1件ごとに1つだけ存在する「article直下の2階層下のsvg」という位置で特定している。
  const NOTIFICATION_MARK_SELECTOR = 'article[data-testid="notification"] > div > div > svg';
  const NOTIFICATION_MARK_THEMED = new Set(["1d9bf0"]);

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

  // チャット画面はshadcn/ui流に「204 88% 53%」のような色相・彩度・明度の数値だけを変数に入れ、使う側でhsl(var(--chat-accent))のように包む。
  // この変数に色そのものを入れるとhsl()の引数として無効になるため、役割の色を同じ数値の形に換算した変数--xgb-hr-*を別に用意する。
  // color-mix()は数値の形にできないので、ROLESの値をここで計算して確定させる。
  const parseHexColor = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mixRgb = (a, b, ratio) => a.map((v, i) => Math.round(v * ratio + b[i] * (1 - ratio)));
  function roleRgb(value) {
    const mix = /^color-mix\(in srgb, (#[0-9a-f]{6}) ([\d.]+)%, (#[0-9a-f]{6})\)$/.exec(value);
    return mix ? mixRgb(parseHexColor(mix[1]), parseHexColor(mix[3]), Number(mix[2]) / 100) : parseHexColor(value);
  }
  function hslChannels(rgb) {
    const { hue, lightness, chroma } = analyze(rgb);
    const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1));
    const round = (v) => Math.round(v * 10) / 10;
    return `${round(hue)} ${round(saturation * 100)}% ${round(lightness * 100)}%`;
  }
  // roleValueの色付き背景(役割の色を背景に18%混ぜたもの)も数値の形で用意する。
  const channelDecls = (roles) => {
    const bg = roleRgb(roles.bg);
    return Object.entries(roles)
      .map(([name, value]) => {
        const rgb = roleRgb(value);
        return `--xgb-hr-${name}: ${hslChannels(rgb)}; --xgb-hr-${name}-tint: ${hslChannels(mixRgb(rgb, bg, 0.18))};`;
      })
      .join(" ");
  };

  // Xがhtml要素のインラインstyleでcolor-schemeを指定するため、スクロールバーやフォーム部品の配色を合わせるには!importantで上書きする必要がある。
  ownStyle.textContent =
    `:root { color-scheme: light !important; ${roleDecls(ROLES.light)} ${channelDecls(ROLES.light)} }\n` +
    `@media (prefers-color-scheme: dark) { :root { color-scheme: dark !important; ${roleDecls(ROLES.dark)} ${channelDecls(ROLES.dark)} } }`;
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
  const notificationMarkRule = ownSheet.cssRules[ownSheet.insertRule(`${NOTIFICATION_MARK_SELECTOR} {}`, ownSheet.cssRules.length)];
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

  function roleOf(hex, rgb, sourceName) {
    const override = OVERRIDES[hex]?.[sourceName];
    if (override) return { role: override, tint: false };
    const { hue, lightness, chroma } = analyze(rgb);
    if (chroma < NEUTRAL_CHROMA) {
      let best = NEUTRAL_ANCHORS[sourceName][0];
      for (const anchor of NEUTRAL_ANCHORS[sourceName]) {
        if (Math.abs(anchor[0] - lightness) < Math.abs(best[0] - lightness)) best = anchor;
      }
      return { role: best[1], tint: false };
    }
    // 背景に近い明度の有彩色はエラー表示の薄い赤背景などの「色付き背景」なので、アクセント色そのものにすると文字が読めなくなる。
    const tint = sourceName === "light" ? lightness > 0.88 : lightness < 0.2;
    return { role: hueRole(hue), tint };
  }

  function roleValue(hex, rgb, sourceName) {
    const { role, tint } = roleOf(hex, rgb, sourceName);
    return tint ? `color-mix(in srgb, var(--xgb-r-${role}) 18%, var(--xgb-r-bg))` : `var(--xgb-r-${role})`;
  }

  const definedChannels = new Set();

  function defineChannels(hex, rgb) {
    if (definedChannels.has(hex)) return;
    definedChannels.add(hex);
    for (const [name, rule] of Object.entries(sourceRules)) {
      const { role, tint } = roleOf(hex, rgb, name);
      rule.style.setProperty(`--xgb-h-${hex}`, `var(--xgb-hr-${role}${tint ? "-tint" : ""})`);
    }
  }

  function define(hex, rgb) {
    if (defined.has(hex)) return;
    defined.add(hex);
    for (const [name, rule] of Object.entries(sourceRules)) {
      rule.style.setProperty(`--xgb-c-${hex}`, roleValue(hex, rgb, name));
    }
    // 灰色のアイコンや文字まで元に戻すとGruvboxの背景上で浮くため、有彩色だけを戻す。
    if (analyze(rgb).chroma >= NEUTRAL_CHROMA) {
      keepOriginalRule.style.setProperty(`--xgb-c-${hex}`, `#${hex}`);
      if (!NOTIFICATION_MARK_THEMED.has(hex)) notificationMarkRule.style.setProperty(`--xgb-c-${hex}`, `#${hex}`);
    }
  }

  const COLOR_RE =
    /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|rgba?\(\s*(\d{1,3})\s*,?\s*(\d{1,3})\s*,?\s*(\d{1,3})\s*(?:[,/]\s*(?:([\d.]+)(%?)|(var\(--[\w-]+(?:\s*,\s*[\d.]+)?\))))?\s*\)/gi;

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
    const result = value.replace(COLOR_RE, (match, hexDigits, r, g, b, a, percent, alphaVar) => {
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
      // クリエイタースタジオのJetfuel(rgba(255, 255, 255, var(--jbgo)))やTailwind v3(rgb(255 255 255 / var(--tw-bg-opacity, 1)))は透明度を変数で後から切り替えるため、値を確定させずに変数のまま百分率へ変換して渡す。
      if (alphaVar) return `color-mix(in srgb, ${ref} calc(${alphaVar} * 100%), transparent)`;
      // 半透明の色はホバー時の重ね塗りや影に使われるため、透明度を保ったまま色だけを置き換える。
      return alpha >= 1 ? ref : `color-mix(in srgb, ${ref} ${Math.round(alpha * 1000) / 10}%, transparent)`;
    });
    return changed ? result : null;
  }

  const HSL_CHANNELS_RE = /^\s*(-?[\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%\s*$/;

  function hslToRgb(hue, saturation, lightness) {
    const h = ((hue % 360) + 360) % 360;
    const a = saturation * Math.min(lightness, 1 - lightness);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
  }

  // 数値の形の値はカスタムプロパティにしか現れないので、呼び出し側でカスタムプロパティに限って渡す。
  // 差し替え後の値は正規表現に一致しなくなるため、再走査で二重に書き換えることはない。
  function rewriteChannels(value) {
    const match = HSL_CHANNELS_RE.exec(value);
    if (!match) return null;
    const rgb = hslToRgb(Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100);
    const hex = toHex(rgb);
    defineChannels(hex, rgb);
    return `var(--xgb-h-${hex}, ${value.trim()})`;
  }

  function rewriteDeclaration(style) {
    for (let i = 0; i < style.length; i++) {
      const property = style[i];
      const value = style.getPropertyValue(property);
      const next = (property.startsWith("--") && rewriteChannels(value)) || rewriteValue(value);
      if (next) style.setProperty(property, next, style.getPropertyPriority(property));
    }
  }

  // チャット画面はデザイントークンで色を指定し、ダークテーマでは本文・枠線・ボタンなど前景全般に--x-white(#ffffff)を使う。
  // 一方で送信した吹き出しの文字(text-white)や--x-fg-on-colorのように、青などの有彩色の上の文字にも同じ--x-whiteを使うため、OVERRIDESでは両者を区別できず、前景まで背景色になって受信メッセージが読めなくなる。
  // そこでダークテーマのトークン定義に限り--x-white(-NN)の参照を、白をfgに割り当てた別の変数--xgb-fg-white(-NN)に差し替える。
  // 透明度付きの--x-white-NNはXの定義をそのまま写して作るため、透明度の値を自前で持たない。
  const CHAT_DARK_SELECTOR = '[data-theme="dark"]';
  const CHAT_WHITE_REF_RE = /var\(--x-white(-\d+)?\)/g;
  const CHAT_WHITE_DEF_RE = /^--x-white(-\d+)?$/;
  const CHAT_ON_COLOR_TOKENS = new Set(["--x-fg-on-color"]);

  function rewriteChatTokens(rule) {
    const { style, selectorText } = rule;
    if (!selectorText) return;
    const isDark = selectorText.includes(CHAT_DARK_SELECTOR);
    const updates = [];
    for (let i = 0; i < style.length; i++) {
      const property = style[i];
      const value = style.getPropertyValue(property);
      const def = CHAT_WHITE_DEF_RE.exec(property);
      if (def) {
        const next = value.replaceAll("var(--xgb-c-ffffff, #ffffff)", "var(--xgb-r-fg)");
        const name = `--xgb-fg-white${def[1] ?? ""}`;
        if (next !== value && style.getPropertyValue(name) !== next) updates.push([name, next]);
        continue;
      }
      if (!isDark || !property.startsWith("--x-") || CHAT_ON_COLOR_TOKENS.has(property)) continue;
      // 差し替え後もフォールバックに--x-whiteが残るので、再走査で二重に包まないよう差し替え済みの値は飛ばす。
      if (value.includes("--xgb-fg-white")) continue;
      const next = value.replace(CHAT_WHITE_REF_RE, (match, alpha = "") => `var(--xgb-fg-white${alpha}, ${match})`);
      if (next !== value) updates.push([property, next, style.getPropertyPriority(property)]);
    }
    // 走査中にプロパティを追加すると添字がずれるため、まとめて適用する。
    for (const [property, value, priority = ""] of updates) style.setProperty(property, value, priority);
  }

  function rewriteRules(rules) {
    for (const rule of rules) {
      if (rule.style) {
        rewriteDeclaration(rule.style);
        rewriteChatTokens(rule);
      }
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

  // 投稿画面の文字数カウンターの円などは、SVGの提示属性(stroke="#1D9BF0"等)に色を直接書いている。
  // 提示属性はvar()を受け付けないため、属性はそのまま残し、優先度の高いインラインstyleに書き換えた色を入れる。
  // カウンターは残り文字数に応じて属性の色を変えるので、属性が変わるたびに作り直し、色でなくなった場合は自分で入れたstyleだけを外す。
  const SVG_COLOR_ATTRIBUTES = ["fill", "stroke", "stop-color", "flood-color", "lighting-color"];
  const SVG_COLOR_SELECTOR = SVG_COLOR_ATTRIBUTES.map((name) => `[${name}]`).join(", ");
  const svgOverrides = new WeakMap();

  function rewriteSvgAttributes(element) {
    if (!(element instanceof SVGElement)) return;
    let overridden = svgOverrides.get(element);
    for (const name of SVG_COLOR_ATTRIBUTES) {
      const next = rewriteValue(element.getAttribute(name));
      if (next) {
        element.style.setProperty(name, next);
        if (!overridden) svgOverrides.set(element, (overridden = new Set()));
        overridden.add(name);
      } else if (overridden?.has(name)) {
        element.style.removeProperty(name);
        overridden.delete(name);
      }
    }
  }

  // nodeにはShadowRootも渡るが、ShadowRootは属性を持たないのでrewriteElementに渡さない。
  function rewriteTree(node) {
    if (node.nodeName === "STYLE") rewriteSheet(node.sheet);
    if (node.nodeType === Node.ELEMENT_NODE) {
      rewriteElement(node);
      rewriteSvgAttributes(node);
    }
    for (const element of node.querySelectorAll("[style]")) rewriteElement(element);
    for (const element of node.querySelectorAll(SVG_COLOR_SELECTOR)) rewriteSvgAttributes(element);
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

  // 2026年11月、ユーザー環境でスーパーリロードすると約9割の頻度で、insertRuleを差し替えていても書き換えられないまま残るルールがあることを確認した。
  // 差し替えを通らない追加経路は特定できていないため、経路を問わず取りこぼしを拾えるよう、DOMが変化したフレームの描画前にルール数が変わったシートを走査し直す。
  // Reactは新しいクラスのルールを追加した直後にそのクラスを使う要素を描画するので、DOMの変化を契機にすれば白い状態が画面に出る前に書き換えられる。
  const scannedLength = new WeakMap();
  let rescanScheduled = false;

  // チャット画面(x.com/i/chat)はShadow DOM内に描画され、スタイルもShadowRootのadoptedStyleSheetsで指定されるため、documentの監視とシート一覧だけでは届かない。
  // closedモードのShadowRootはhost.shadowRootから辿れないので、attachShadowを差し替えて作成時に受け取る。
  const shadowRoots = new Set();

  function rescanSheets() {
    rescanScheduled = false;
    const sheets = [...document.styleSheets, ...document.adoptedStyleSheets];
    for (const shadow of shadowRoots) {
      // 画面遷移で外されたShadowRootを持ち続けないよう一覧から外す。再び接続された場合は、監視が続いているので変化の通知を受けた時点で戻す。
      if (!shadow.host.isConnected) {
        shadowRoots.delete(shadow);
        continue;
      }
      sheets.push(...shadow.styleSheets, ...shadow.adoptedStyleSheets);
    }
    for (const sheet of sheets) {
      let length;
      try {
        length = sheet.cssRules.length;
      } catch {
        continue;
      }
      if (scannedLength.get(sheet) === length) continue;
      scannedLength.set(sheet, length);
      rewriteSheet(sheet);
    }
  }

  function scheduleRescan() {
    if (rescanScheduled) return;
    rescanScheduled = true;
    requestAnimationFrame(rescanSheets);
  }

  const OBSERVE_OPTIONS = {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style", ...SVG_COLOR_ATTRIBUTES],
  };

  const observer = new MutationObserver((records) => {
    scheduleRescan();
    for (const record of records) {
      const recordRoot = record.target.getRootNode();
      if (recordRoot instanceof ShadowRoot) shadowRoots.add(recordRoot);
      if (record.type === "attributes") {
        if (record.attributeName === "style") rewriteElement(record.target);
        else rewriteSvgAttributes(record.target);
        continue;
      }
      // style要素の中身(テキストノード)が差し替えられた場合は、要素自体が追加されなくてもシートが作り直される。
      if (record.target.nodeName === "STYLE") rewriteSheet(record.target.sheet);
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) rewriteTree(node);
      }
    }
  });

  function watchShadowRoot(shadow) {
    if (shadowRoots.has(shadow)) return;
    shadowRoots.add(shadow);
    observer.observe(shadow, OBSERVE_OPTIONS);
    rewriteTree(shadow);
    scheduleRescan();
  }

  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (...args) {
    const shadow = originalAttachShadow.apply(this, args);
    try {
      watchShadowRoot(shadow);
    } catch {
      // 監視の登録に失敗してもXの描画は止めない。
    }
    return shadow;
  };

  observer.observe(document, OBSERVE_OPTIONS);

  // スクリプトの実行がXより遅れた場合に備え、既に作られているopenモードのShadowRootも拾う。
  for (const element of document.querySelectorAll("*")) {
    if (element.shadowRoot) watchShadowRoot(element.shadowRoot);
  }

  rescanSheets();
  rewriteTree(root);
})();
