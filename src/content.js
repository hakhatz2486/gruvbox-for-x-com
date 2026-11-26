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
  // ログアウト時のx.comはx-webという別のアプリで描かれ、表示モードをbodyではなくhtml要素のdata-theme(OSの設定かnight_mode Cookieで決まるlight/dark)で切り替える。
  // x-webのダークは黒背景なので、ブラックモードとして扱う。
  const SOURCE_BY_HTML_THEME = { light: "light", dark: "dark" };

  // x-webは配色のスタイルシートをabs.twimg.comからcrossorigin属性なしで読み込むため、別オリジン扱いになってcssRulesを読めず、色を書き換えられない。
  // このホストはAccess-Control-Allow-Origin: *を返すので、crossorigin="anonymous"を付けた複製を読み込ませて書き換える(reloadSheetWithCors)。
  // Access-Control-Allow-Originを返さないホスト(Googleログインボタンのaccounts.google.com等)の複製は読み込み自体が失敗するため、ホストを限定している。
  const CORS_SHEET_SELECTOR = 'link[rel~="stylesheet"][href^="https://abs.twimg.com/"]:not([crossorigin])';

  // いいね・リポスト・ブックマークは押したかどうかがXのピンク・緑・青で一目で分かることを優先し、ボタン内の有彩色だけ元の色に戻す。
  // 押す前後でdata-testidが切り替わる(like→unlike、retweet→unretweet、bookmark→removeBookmark)ため両方を指定する。
  const KEEP_ORIGINAL_SELECTOR =
    ':is([data-testid="like"], [data-testid="unlike"], [data-testid="retweet"], [data-testid="unretweet"], [data-testid="bookmark"], [data-testid="removeBookmark"])';

  // 通知ページの各通知の左にあるマークも、いいねやリポストの通知を色で見分けられるよう元の色に戻す。
  // ただしXの青で描かれるマーク(フォローの人型、通知のベル)はユーザーの希望でテーマの青のままにするため、青だけは戻す対象から外す。
  // このマークにはdata-testidが無いため、通知1件ごとに1つだけ存在する「article直下の2階層下のsvg」という位置で特定している。
  const NOTIFICATION_MARK_SELECTOR = 'article[data-testid="notification"] > div > div > svg';
  const NOTIFICATION_MARK_THEMED = new Set(["1d9bf0"]);

  // 動画プレイヤーの操作部分と、投稿画面で添付した画像の上の「編集」「削除」ボタンは、テーマの背景ではなく画像・動画の上に黒い半透明の下地を敷いて白い文字やアイコンを載せている。
  // ダーク系モードでは#ffffffも#0f1419も背景色に割り当てるため、テーマ色のままだと下地と文字が同じ暗い色になって読めなくなる。
  // 下地が画像・動画である以上テーマに合わせる意味が薄いので、これらの中は無彩色も含めすべてXの元の色に戻す。
  // 添付欄(attachments)の中でも、画像の下の「タグ付けする」等のリンクはテーマの背景の上にあるため、button要素だけに限っている。
  // 引用ポストを作成する時の引用元カードも添付欄の中のbutton要素だが、テーマの背景の上にあり、元の色に戻すと文字がテーマ色にならず枠線(#2f3336)もGruvboxの背景に紛れて見えなくなるため、投稿者名(User-Name)を含むbuttonは除外している。
  // センシティブな内容の警告(「内容の警告: ヌード」と「表示」ボタン)も、ぼかした画像や投稿の上に黒50%の下地を重ねて白い文字を載せているため同じ扱いにする。
  // この重ね合わせにはdata-testidもroleも無いため、「警告アイコンのsvg・見出し・説明文が並ぶdivと、表示ボタンを持つ要素」という構造で特定している。
  const SENSITIVE_WARNING_SELECTOR =
    "div:has(> div:only-child > div:first-child > svg:first-child + div + div:last-child):has(> div:only-child > button:last-child)";
  // 複数画像のポストで画像の上に出る左右移動ボタン(ScrollSnap)も、#0f1419の75%の丸に白い矢印を載せており、同じ理由で丸と矢印が同じ暗い色になる。
  const SCROLL_SNAP_BUTTON_SELECTOR = '[data-testid="ScrollSnap-prevButtonWrapper"], [data-testid="ScrollSnap-nextButtonWrapper"]';
  // リンクの大きいカードは、画像の左下に黒77%の下地を重ねて白い文字でページのタイトルを載せており、同じ理由で下地と文字が同じ暗い色になる。
  // この下地にはdata-testidが無いが、card.layoutLarge.mediaの中には画像とこの下地しか無く枠線も無いため、カードの画像部分ごと元の色に戻す。
  const LINK_CARD_MEDIA_SELECTOR = '[data-testid="card.layoutLarge.media"]';
  // プロフィール編集画面のバナーとアイコンの上の「画像を追加」ボタンも、#0f1419の75%の丸に白いカメラのアイコンを載せており、同じ理由で丸とアイコンが同じ暗い色になる。
  // このボタンにはdata-testidが無く、aria-labelは表示言語で変わるため、ファイル選択のinput(fileInput)の直前にあるbuttonという構造で特定する。
  // 投稿欄の画像追加のfileInputは直前にbuttonを持たないので一致しない。
  // 画像を設定済みの時に並ぶ「削除」ボタンも同じ層に置かれると考え、ボタン単体ではなく画像の上に重なる層全体を対象にしている(削除ボタンは未確認)。
  const PROFILE_IMAGE_BUTTONS_SELECTOR = 'div:has(> div > button + [data-testid="fileInput"])';
  const ON_MEDIA_SELECTOR = `:is([data-testid="videoPlayer"], ${SCROLL_SNAP_BUTTON_SELECTOR}, ${LINK_CARD_MEDIA_SELECTOR}, [data-testid="attachments"] button:not(:has([data-testid="User-Name"])), ${SENSITIVE_WARNING_SELECTOR}, ${PROFILE_IMAGE_BUTTONS_SELECTOR})`;

  // ボタンにホバーした時のツールチップは、表示モードによらず濃い灰色(#464646の90%)の下地に白い文字を載せている。
  // ダーク系モードでは#ffffffを背景色に割り当てる(OVERRIDES参照)ため、下地がbg-2、文字がbgの暗い色同士になって読めなくなる。
  // 下地は灰色としてテーマ色に置き換わっており画像の上でもないので、元の色には戻さず、文字だけを本文色に割り当て直す。
  const TOOLTIP_SELECTOR = '[role="tooltip"]';

  // 右サイドバーのGrok Botの宣伝カード(「Get Grok Bot with X Premium」)は、表示モードによらず黒い下地(#000000)に白い文字と白い枠線、白い顔に黒い目のGrokのマークを載せている。
  // ダーク系モードでは黒も白も背景色になって文字とマークが消えるため、ツールチップと同じく白だけを本文色に割り当て直す。
  // カード自体にはdata-testidが無いため、閉じるボタン(grokBotOfferDismiss)を含むaside要素として特定している。
  const GROK_BOT_OFFER_SELECTOR = 'aside:has([data-testid="grokBotOfferDismiss"])';

  // ポストをチャットで共有した時などに画面下に出るトースト(sonner)は、表示モードによらず#222222の60%の下地に--x-fg-on-color(白)の文字を載せ、ボタンと説明文は--x-white-NNで描いている。
  // ダーク系モードでは下地も白も暗い色になるが、これらのトークンは:rootで色が確定してから継承されるため、ツールチップのように--xgb-c-ffffffを差し替えても効かない。
  // そのためトースト自身でトークンを定義し直す。使われている透明度は、ボタンの15%(ホバー時)と20%、説明文の80%だけである。
  // トーストを表示するToasterはチャットのShadow DOMの中にあり、documentのスタイルもhtml[data-xgb-source]での判定も届かないため、このルールはchatSheetに置き、ダーク系モードかどうかはチャット側のdata-theme="dark"で判定する。
  const TOAST_SELECTOR = "[data-sonner-toast]";
  const TOAST_WHITE_ALPHAS = [15, 20, 80];
  const toastWhiteDecls = TOAST_WHITE_ALPHAS.map((alpha) => `--x-white-${alpha}: color-mix(in srgb, var(--xgb-r-fg) ${alpha}%, transparent);`).join(" ");

  // ニュースのポストに付くカード(Jetfuelという別系統のUIで描かれる)は、画像の上に黒から透明へのグラデーションを重ね、白い文字で見出しや日時を載せている。
  // ダーク系モードでは黒も白も背景色に割り当てるため文字が読めなくなるが、グラデーションはカードの下端でページの背景に溶け込ませる作りなので、元の色に戻すより背景色のまま残し、白だけを本文色に割り当て直す。
  // Jetfuelのクラス名はビルドごとに変わるが、grid-rows-1やrow-start-1のようなTailwind由来の名前は残っているため、「1マスのグリッドに重ねた2枚目以降の層」として画像の上の層を特定している。
  const JETFUEL_MEDIA_OVERLAY_SELECTOR = ".jetfuel-style-root .grid-rows-1 > .row-start-1 + .row-start-1";
  const WHITE_AS_FG_SELECTOR = `:is(${TOOLTIP_SELECTOR}, ${GROK_BOT_OFFER_SELECTOR}, ${JETFUEL_MEDIA_OVERLAY_SELECTOR})`;
  // 逆にデフォルトモードでは、黒いグラデーションが本文色、白い文字が背景色になり、カードの帯だけ明暗が反転した見た目になる。
  // その帯の上にある分類名(「Gaming」等)の灰色#71717aは、明度だけで判定すると補助文字色になり、帯と同じ側の色同士でコントラストが2:1前後しかなくなる。
  // 反転した帯の上の補助文字には、背景と反対側にあるbg-3(ライトでは#bdae93、ダークでは#665c54)を割り当てる。
  const JETFUEL_OVERLAY_MUTED_HEX = "71717a";

  // 同じカードでは、正方形の画像が見出しの帯の下まで敷かれたまま、角丸(24px)の枠で切り抜かれている。
  // 角の曲線では画像と帯が別々に半透明で縁取られるため、帯の下の画像が透けて、白い画像なら角が白く、黒い画像なら枠線が暗く欠けて見える。
  // 画像の層だけ下の角を枠より大きく丸め、下端も1px削ることで、曲線の縁に画像が来ないようにしている。
  const JETFUEL_MEDIA_LAYER_SELECTOR = ".jetfuel-style-root .grid-rows-1 > .row-start-1:has(+ .row-start-1)";

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
  const onMediaRule = ownSheet.cssRules[ownSheet.insertRule(`${ON_MEDIA_SELECTOR} {}`, ownSheet.cssRules.length)];
  const whiteAsBgSources = Object.keys(OVERRIDES.ffffff).map((name) => `[data-xgb-source="${name}"]`);
  ownSheet.insertRule(`html:is(${whiteAsBgSources.join(", ")}) ${WHITE_AS_FG_SELECTOR} { --xgb-c-ffffff: var(--xgb-r-fg); }`, ownSheet.cssRules.length);
  ownSheet.insertRule(`html[data-xgb-source="light"] ${JETFUEL_MEDIA_OVERLAY_SELECTOR} { --xgb-c-${JETFUEL_OVERLAY_MUTED_HEX}: var(--xgb-r-bg-3); }`, ownSheet.cssRules.length);
  ownSheet.insertRule(`${JETFUEL_MEDIA_LAYER_SELECTOR} { clip-path: inset(0 0 1px 0 round 0 0 26px 26px); }`, ownSheet.cssRules.length);
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
    onMediaRule.style.setProperty(`--xgb-c-${hex}`, `#${hex}`);
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

  // var()を含む値をショートハンドで書くと(例: Jetfuelのカード枠のborder-color: rgba(39, 39, 42, var(--jbo)))、style[i]で列挙される個別のプロパティの値が空文字になり、色が書き換えられずに残る。
  // その場合に限り、色を含みうるショートハンドの値を読んで書き換える。
  const COLOR_SHORTHANDS = [
    "border",
    "border-color",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "border-block",
    "border-block-color",
    "border-block-start",
    "border-block-end",
    "border-inline",
    "border-inline-color",
    "border-inline-start",
    "border-inline-end",
    "outline",
    "background",
    "text-decoration",
    "column-rule",
    "text-emphasis",
    "-webkit-text-stroke",
  ];

  function rewriteDeclaration(style) {
    let hasPendingShorthand = false;
    for (let i = 0; i < style.length; i++) {
      const property = style[i];
      const value = style.getPropertyValue(property);
      if (!value) hasPendingShorthand = true;
      const next = (property.startsWith("--") && rewriteChannels(value)) || rewriteValue(value);
      if (next) style.setProperty(property, next, style.getPropertyPriority(property));
    }
    if (!hasPendingShorthand) return;
    for (const shorthand of COLOR_SHORTHANDS) {
      const next = rewriteValue(style.getPropertyValue(shorthand));
      if (next) style.setProperty(shorthand, next, style.getPropertyPriority(shorthand));
    }
  }

  // チャット画面はデザイントークンで色を指定し、ダークテーマでは本文・枠線・ボタンなど前景全般に--x-white(#ffffff)を使う。
  // 一方で送信した吹き出しの文字(text-white)や--x-fg-on-colorのように、青などの有彩色の上の文字にも同じ--x-whiteを使うため、OVERRIDESでは両者を区別できず、前景まで背景色になって受信メッセージが読めなくなる。
  // そこでダークテーマのトークン定義に限り--x-white(-NN)の参照を、白をfgに割り当てた別の変数--xgb-fg-white(-NN)に差し替える。
  // 透明度付きの--x-white-NNはXの定義をそのまま写して作るため、透明度の値を自前で持たない。
  // --x-fg-alpha-NNや--x-border-elevatedは--x-whiteを参照せず白を直接書いているため、書き換え後の白の参照をfgに直接差し替える。
  // これを漏らすと、例えば共有画面の送信ボタンでアイコンを囲む輪(--x-fg-alpha-100)が、本文色のボタンの上で背景色の黒い輪になる。
  const CHAT_DARK_SELECTOR = '[data-theme="dark"]';
  const CHAT_WHITE_REF_RE = /var\(--x-white(-\d+)?\)/g;
  const CHAT_WHITE_LITERAL = "var(--xgb-c-ffffff, #ffffff)";
  const CHAT_WHITE_DEF_RE = /^--x-white(-\d+)?$/;
  const CHAT_ON_COLOR_TOKENS = new Set(["--x-fg-on-color"]);

  // クリエイタースタジオなどJetfuelで描かれる画面も、ダークテーマ用のルール([data-theme="dark"] .jetfuel-style-root ...)では文字色に白を直接書いている。
  // トークンを介さないので、これらのルールに限り、プロパティを問わず白をfgに差し替える。
  const JETFUEL_ROOT_SELECTOR = ".jetfuel-style-root";

  function rewriteChatTokens(rule) {
    const { style } = rule;
    // Grokの画面ではトークンがネストしたCSSの中にあり、宣言部分がセレクタを持たないCSSNestedDeclarationsになるため、親ルールのセレクタで判定する。
    const selectorText = rule.selectorText ?? rule.parentRule?.selectorText;
    if (!selectorText) return;
    const isDark = selectorText.includes(CHAT_DARK_SELECTOR);
    const isJetfuelDark = isDark && selectorText.includes(JETFUEL_ROOT_SELECTOR);
    const updates = [];
    // var()を含むショートハンドは個別プロパティの値が空文字になるため、rewriteDeclarationと同じくショートハンドも見る。
    const properties = isJetfuelDark ? [...style, ...COLOR_SHORTHANDS] : style;
    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      const value = style.getPropertyValue(property);
      const def = CHAT_WHITE_DEF_RE.exec(property);
      if (def) {
        const next = value.replaceAll(CHAT_WHITE_LITERAL, "var(--xgb-r-fg)");
        const name = `--xgb-fg-white${def[1] ?? ""}`;
        if (next !== value && style.getPropertyValue(name) !== next) updates.push([name, next]);
        continue;
      }
      if (isJetfuelDark && !property.startsWith("--x-")) {
        const next = value.replaceAll(CHAT_WHITE_LITERAL, "var(--xgb-r-fg)");
        if (next !== value) updates.push([property, next, style.getPropertyPriority(property)]);
        continue;
      }
      if (!isDark || !property.startsWith("--x-") || CHAT_ON_COLOR_TOKENS.has(property)) continue;
      // 差し替え後もフォールバックに--x-whiteが残るので、再走査で二重に包まないよう差し替え済みの値は飛ばす。
      if (value.includes("--xgb-fg-white")) continue;
      const next = value
        .replace(CHAT_WHITE_REF_RE, (match, alpha = "") => `var(--xgb-fg-white${alpha}, ${match})`)
        .replaceAll(CHAT_WHITE_LITERAL, "var(--xgb-r-fg)");
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
    if (!sheet || sheet === ownSheet || sheet === chatSheet) return;
    try {
      rewriteRules(sheet.cssRules);
    } catch {
      // 別オリジンのスタイルシートはcssRulesを読めない。
    }
  }

  function detectSource(backgroundColor) {
    const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(backgroundColor);
    if (match) setSource(SOURCE_BY_BODY_BG[toHex(match.slice(1, 4).map(Number))]);
  }

  function setSource(detected) {
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

  // 元のlink要素に属性を後付けする方法は、属性の変更で再取得されるかがブラウザの実装次第なので採らない。
  // 複製の読み込みが終わるまで元の要素を残すのは、その間に配色の無い画面が出ないようにするため。
  // 複製が読み込めなかった場合は複製だけを外し、Xの元の色のまま表示させる。
  // パース中はhead要素の追加とその中のlink要素の追加が別々に通知され、同じlink要素が2回渡りうるため、処理済みの要素を覚えておく。
  const corsReloaded = new WeakSet();

  function reloadSheetWithCors(link) {
    if (corsReloaded.has(link)) return;
    corsReloaded.add(link);
    const copy = link.cloneNode();
    copy.crossOrigin = "anonymous";
    copy.addEventListener(
      "load",
      () => {
        rewriteSheet(copy.sheet);
        link.remove();
      },
      { once: true },
    );
    copy.addEventListener("error", () => copy.remove(), { once: true });
    link.after(copy);
  }

  // nodeにはShadowRootも渡るが、ShadowRootは属性を持たないのでrewriteElementに渡さない。
  function rewriteTree(node) {
    if (node.nodeName === "STYLE") rewriteSheet(node.sheet);
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.matches(CORS_SHEET_SELECTOR)) reloadSheetWithCors(node);
      rewriteElement(node);
      rewriteSvgAttributes(node);
    }
    for (const link of node.querySelectorAll(CORS_SHEET_SELECTOR)) reloadSheetWithCors(link);
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

  // 共有画面の送信ボタン(bg-btn-primary)は、宛先のアイコンをfg-alpha-100の輪で囲んでいる。
  // Xではこの輪がボタンと同じ色で見えないが、Gruvboxダークの本文色のボタンだと輪が無いとアイコンの縁が締まらないため、ユーザーの希望で#282828より一段明るいbg-1にしている。
  // Gruvboxライトでは問題になっていないので、ダークに限る。
  // documentのスタイルはShadow DOMの中に届かないため、ShadowRootごとにこのシートを追加する。
  const chatSheet = new CSSStyleSheet();
  chatSheet.replaceSync(
    "@media (prefers-color-scheme: dark) { .bg-btn-primary .bg-fg-alpha-100 { background-color: var(--xgb-r-bg-1); } }\n" +
      `${CHAT_DARK_SELECTOR} ${TOAST_SELECTOR} { --x-fg-on-color: var(--xgb-r-fg); ${toastWhiteDecls} }`,
  );

  // Xが後からadoptedStyleSheetsを代入し直すと自前のシートが外れるため、再走査のたびに付け直す。
  function adoptChatSheet(shadow) {
    if (!shadow.adoptedStyleSheets.includes(chatSheet)) shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, chatSheet];
  }

  function rescanSheets() {
    rescanScheduled = false;
    const sheets = [...document.styleSheets, ...document.adoptedStyleSheets];
    for (const shadow of shadowRoots) {
      // 画面遷移で外されたShadowRootを持ち続けないよう一覧から外す。再び接続された場合は、監視が続いているので変化の通知を受けた時点で戻す。
      if (!shadow.host.isConnected) {
        shadowRoots.delete(shadow);
        continue;
      }
      adoptChatSheet(shadow);
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
    attributeFilter: ["style", "data-theme", "data-xgb-source", ...SVG_COLOR_ATTRIBUTES],
  };

  const observer = new MutationObserver((records) => {
    scheduleRescan();
    for (const record of records) {
      const recordRoot = record.target.getRootNode();
      if (recordRoot instanceof ShadowRoot) shadowRoots.add(recordRoot);
      if (record.type === "attributes") {
        // チャットやJetfuelの内側の要素もdata-themeを持つが、表示モードを表すのはhtml要素のものだけである。
        if (record.attributeName === "data-theme") {
          if (record.target === root) setSource(SOURCE_BY_HTML_THEME[root.dataset.theme]);
        } else if (record.attributeName === "data-xgb-source") {
          // x-webのReact(19)はhtml要素を引き継ぐ時に属性をすべて消すため、data-xgb-sourceも消えて変数の定義が当たらなくなり、描画の数フレーム後にXの元の色へ戻ってしまう。
          // 通知は消された直後の描画前に届くので、ここで付け直せば元の色は画面に出ない。
          if (record.target === root && root.dataset.xgbSource !== source) root.dataset.xgbSource = source;
        } else if (record.attributeName === "style") rewriteElement(record.target);
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

  setSource(SOURCE_BY_HTML_THEME[root.dataset.theme]);
  rescanSheets();
  rewriteTree(root);
})();
