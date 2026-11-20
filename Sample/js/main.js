'use strict';

// HTMLの読み込みが終わったら、各機能を順番に初期化する
initThemeToggle();
initSkillBadges();
initScrollSpy();
initBentoDragAndDrop();
initRobotAvatar();
initWeatherWidget();


/* ==========================================================================
   1. 昼夜モード（ライト / ダークテーマ）の切り替え機能
   ========================================================================== */
function initThemeToggle() {
  const STORAGE_KEY = 'portfolio-theme';
  const root = document.documentElement; // <html> タグのこと
  const toggleBtn = document.getElementById('theme-toggle');
  const toggleLabel = toggleBtn?.querySelector('.theme-toggle-label');

  // 指定されたテーマ（'light' または 'dark'）を画面に反映する関数
  const applyTheme = (theme) => {
    const isDark = theme === 'dark';
    // <html data-theme="dark"> を設定すると、CSS側の夜モード変数が有効になる
    root.setAttribute('data-theme', theme);

    // スマホブラウザのUIカラー（meta指定も切り替える）
    const themeMeta = document.getElementById('theme-color-meta');
    if (themeMeta) {
      themeMeta.setAttribute('content', isDark ? '#0f172a' : '#f4f5f7');
    }

    if (toggleBtn) {
      // スクリーンリーダー（音声読み上げ）向けに現在の状態を伝える属性を更新
      toggleBtn.setAttribute(
        'aria-label',
        isDark ? '昼モード（ライト）に切り替え' : '夜モード（ダーク）に切り替え'
      );
    }
    if (toggleLabel) {
      toggleLabel.textContent = isDark ? 'Night' : 'Day';
    }
  };

  // 前回保存したテーマがあればそれを使い、なければOS（Windows/Mac等）のダーク設定に合わせる
  const savedTheme = localStorage.getItem(STORAGE_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  applyTheme(initialTheme);

  if (!toggleBtn) return;

  // ボタンをクリックするたびに light ↔ dark を切り替えて保存する
  toggleBtn.addEventListener('click', () => {
    const currentTheme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
  });
}


/* ==========================================================================
   2. Skillsカードのバッジ選択 & 詳細モニター切り替え機能
   ========================================================================== */
function initSkillBadges() {
  const badges = document.querySelectorAll('.skill-badge');
  const detailTitle = document.getElementById('skill-detail-title');
  const detailDesc = document.getElementById('skill-detail-desc');

  // 対象要素が見つからない場合は何もしない（エラー防止）
  if (!badges.length || !detailTitle || !detailDesc) return;

  // 選択されたバッジの data-skill / data-desc 属性を読み取ってモニターに表示する
  const updateSkillDetail = (selectedBadge) => {
    badges.forEach((badge) => badge.classList.remove('is-active'));
    selectedBadge.classList.add('is-active');

    detailTitle.textContent = selectedBadge.dataset.skill || '';
    detailDesc.textContent = selectedBadge.dataset.desc || '';
  };

  badges.forEach((badge) => {
    badge.addEventListener('click', () => updateSkillDetail(badge));
    badge.addEventListener('mouseenter', () => updateSkillDetail(badge));
  });
}


/* ==========================================================================
   3. スクロール位置に連動してナビ（制御盤ボタン）を点灯させる機能
   ========================================================================== */
function initScrollSpy() {
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.bento-card[id]');

  if (!navLinks.length || !sections.length) return;

  // ナビをクリックして自動スクロールしている最中かどうかの目印（フラグ）
  let isClickScrolling = false;
  let scrollTimeout = null;

  // 指定したID（例: 'skills'）に対応するナビリンクだけを点灯状態にする
  const setActiveLink = (id) => {
    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      link.classList.toggle('is-current', href === `#${id}`);
    });
  };

  // (A) ナビボタンをクリックした時は、即座にそのボタンを点灯させて自動監視を一時停止する
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const targetId = link.getAttribute('href')?.replace('#', '');
      if (!targetId) return;

      isClickScrolling = true;
      setActiveLink(targetId);

      // スムーズスクロールが終わる頃（0.8秒後）に自動監視を再開する
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isClickScrolling = false;
      }, 800);
    });
  });

  // (B) 通常のスクロール監視：画面の上〜中央付近に入ったカードを検知する
  const observer = new IntersectionObserver(
    (entries) => {
      if (isClickScrolling) return;

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveLink(entry.target.id);
        }
      });
    },
    {
      root: null,
      // 画面の上20%と下55%を除外した「中央やや上」の帯を判定エリアにする
      rootMargin: '-20% 0px -55% 0px',
      threshold: 0,
    }
  );

  sections.forEach((section) => observer.observe(section));

  // (C) 一番下までスクロールし切った時は、最後のカードを点灯させる
  window.addEventListener(
    'scroll',
    () => {
      if (isClickScrolling) return;

      const isAtBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10;

      if (isAtBottom) {
        const lastSection = sections[sections.length - 1];
        setActiveLink(lastSection.id);
      }
    },
    { passive: true } // スクロール処理を重くしないための最適化オプション
  );

  // 初期表示時は一番上のカードを点灯させておく
  setActiveLink(sections[0].id);
}


/* ==========================================================================
   4. ドラッグ操作によるBentoカードの並び替え機能（PC・スマホ両対応）
   --------------------------------------------------------------------------
   - スマホ / タッチ操作：.drag-handle（6点ドット）を掴んだ時だけ反応
   - PC / マウス操作　　：カード内のボタン・リンク以外のどこからでも移動可能
   - 誤操作防止の閾値　：8px 以上動かした時だけドラッグ開始とみなす
   ========================================================================== */
function initBentoDragAndDrop() {
  const grid = document.getElementById('bento-grid');
  if (!grid) return;

  const ORDER_STORAGE_KEY = 'portfolio-bento-order';
  const DRAG_THRESHOLD = 8; // ドラッグ開始とみなす最小移動距離（px）

  // 前回保存したカードの並び順があれば復元する
  restoreCardOrder(grid, ORDER_STORAGE_KEY);

  // ドラッグ候補の情報と、実際にドラッグ中かどうかの状態を管理する変数
  let dragState = null;
  let isDragging = false;

  // 1. 押し始めた時（まだドラッグ開始はしない）
  grid.addEventListener('pointerdown', (e) => {
    // マウスの場合は左クリック（button === 0）のみ反応させる
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const handle = e.target.closest('.drag-handle');
    const isMobileOrTouch =
      e.pointerType === 'touch' || window.matchMedia('(max-width: 767px)').matches;

    // スマホ画面やタッチ操作では、ハンドル部分以外を触った時は通常スクロールさせる
    if (isMobileOrTouch && !handle) return;

    const card = (handle || e.target).closest('.bento-card');
    if (!card || card.parentNode !== grid) return;

    // PCでカード本体を掴む場合でも、他のボタンやリンクのクリックは邪魔しない
    if (!handle && e.target.closest('button, a, input, select, textarea')) return;

    dragState = {
      card,
      captureTarget: handle || card,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
    isDragging = false;
  });

  // 2. 指やマウスを動かした時
  grid.addEventListener('pointermove', (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;

    // 移動距離が閾値（8px）未満なら「ただのタップや手ブレ」とみなして何もしない
    if (!isDragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      isDragging = true;
      dragState.card.classList.add('is-dragging');

      // 指やマウスがカードの外に出ても、離すまで追跡し続ける設定
      try {
        dragState.captureTarget.setPointerCapture(e.pointerId);
      } catch {
        // 非対応環境などで失敗してもそのまま続行する
      }
    }

    // 移動量に合わせてカードを視覚的に動かす
    const { card } = dragState;
    card.style.transform = `translate(${dx}px, ${dy}px) scale(1.02)`;

    // ポインターの「真下」にある別のカードを探す（.is-dragging は CSS で pointer-events: none なので透過する）
    const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
    const targetCard = elementBelow?.closest('.bento-card');

    // 別のカードの上に乗ったら、HTMLの並び順を入れ替える
    if (targetCard && targetCard !== card && targetCard.parentNode === grid) {
      swapCardsKeepingPosition(grid, card, targetCard, dragState, e.clientX, e.clientY);
    }
  });

  // 3. 指やマウスを離した時（または中断された時）
  const endDrag = (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    if (isDragging) {
      dragState.card.classList.remove('is-dragging');
      dragState.card.style.transform = '';
      saveCardOrder(grid, ORDER_STORAGE_KEY);
    }

    dragState = null;
    isDragging = false;
  };

  grid.addEventListener('pointerup', endDrag);
  grid.addEventListener('pointercancel', endDrag);
}

/**
 * カードのDOM順を入れ替えつつ、レイアウト変化による座標ズレを補正して指に吸い付かせる
 */
function swapCardsKeepingPosition(grid, draggedCard, targetCard, dragState, clientX, clientY) {
  const prevRect = draggedCard.getBoundingClientRect();

  const cards = Array.from(grid.children);
  const draggedIndex = cards.indexOf(draggedCard);
  const targetIndex = cards.indexOf(targetCard);

  if (draggedIndex < targetIndex) {
    grid.insertBefore(draggedCard, targetCard.nextSibling);
  } else {
    grid.insertBefore(draggedCard, targetCard);
  }

  // 入れ替え前後の位置の差を計算して startX / startY を補正する
  const nextRect = draggedCard.getBoundingClientRect();
  dragState.startX += nextRect.left - prevRect.left;
  dragState.startY += nextRect.top - prevRect.top;

  const newDx = clientX - dragState.startX;
  const newDy = clientY - dragState.startY;
  draggedCard.style.transform = `translate(${newDx}px, ${newDy}px) scale(1.02)`;
}

/**
 * 現在のカードの並び順（idの配列）を localStorage に保存する
 */
function saveCardOrder(grid, storageKey) {
  const order = Array.from(grid.children)
    .map((el) => el.id)
    .filter(Boolean);
  localStorage.setItem(storageKey, JSON.stringify(order));
}

/**
 * localStorage に保存されたカードの並び順を復元する
 * ※カードが追加・削除された場合は古い並び順が崩れる原因になるため、構成が変わっていたらリセットする
 */
function restoreCardOrder(grid, storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!Array.isArray(saved)) return;

    const currentIds = Array.from(grid.children)
      .map((el) => el.id)
      .filter(Boolean);

    // 保存データと現在のカード構成（個数・ID）が完全一致しない場合はリセット
    const isSameStructure =
      saved.length === currentIds.length && currentIds.every((id) => saved.includes(id));

    if (!isSameStructure) {
      localStorage.removeItem(storageKey);
      return;
    }

    saved.forEach((id) => {
      const card = grid.querySelector(`.bento-card[id="${id}"]`);
      if (card) grid.appendChild(card);
    });
  } catch {
    // 保存データが壊れていた場合は初期順のまま表示する
  }
}


/* ==========================================================================
   5. Homeカード：ダンボールロボットのセリフ・表情切り替え機能
   --------------------------------------------------------------------------
   頭・胴体・脚部のクリック位置に応じてセリフとスプライト画像（4コマ）を切り替え、
   短時間に連打された場合はエラー表情（DoS攻撃警告）に変化させます。
   ========================================================================== */
function initRobotAvatar() {
  const messageEl = document.getElementById('robot-message');
  const spriteEl = document.getElementById('robot-sprite');
  const hitboxes = document.querySelectorAll('.hitbox[data-part]');

  // 対象要素が見つからないページでは何もしない
  if (!messageEl || !spriteEl || !hitboxes.length) return;

  // 部位名（data-part属性）と「セリフ配列」「表情クラス」の対応表
  const PART_ACTIONS = {
    head: { messages: ROBOT_DIALOGUES.idle, face: 'face-normal' },
    body: { messages: ROBOT_DIALOGUES.armActions, face: 'face-smile' },
    legs: { messages: ROBOT_DIALOGUES.heartErrors, face: 'face-active' },
  };

  const ANNOYED_THRESHOLD = 5; // 何回連続で押したら怒るか
  const CLICK_RESET_MS = 2000; // 連打カウントがリセットされるまでの時間（2秒）

  let rapidClickCount = 0;
  let resetTimer = null;

  // 2秒以内に5回以上クリックされたら「連打（怒り）」と判定する関数
  const isAnnoyedClick = () => {
    rapidClickCount += 1;
    // 前のタイマーを消して、新しく2秒後から数え直す（デバウンス的な制御）
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      rapidClickCount = 0;
    }, CLICK_RESET_MS);

    return rapidClickCount >= ANNOYED_THRESHOLD;
  };

  // 各当たり判定ボタン（頭・胴体・脚）にクリックイベントを登録
  hitboxes.forEach((hitbox) => {
    hitbox.addEventListener('click', () => {
      const part = hitbox.dataset.part;
      const action = PART_ACTIONS[part];
      if (!action) return;

      // 連打された場合はエラー顔＆怒りセリフ、通常時は部位ごとの表情＆セリフへ
      const nextMessages = isAnnoyedClick() ? ROBOT_DIALOGUES.annoyed : action.messages;
      const nextFace = rapidClickCount >= ANNOYED_THRESHOLD ? 'face-error' : action.face;

      messageEl.textContent = pickRandomMessage(nextMessages, messageEl.textContent);
      triggerSpriteGlitch(spriteEl, nextFace);
    });
  });
}

/**
 * 配列の中から「今表示しているもの以外」をランダムに1つ選ぶ
 * （同じセリフが2回連続で出ないようにするための工夫）
 */
function pickRandomMessage(messages, currentMessage) {
  if (messages.length <= 1) return messages[0] ?? '';
  const candidates = messages.filter((msg) => msg !== currentMessage);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * スプライトの表情クラスを切り替え、ノイズ風アニメーションを毎回発火させる
 */
function triggerSpriteGlitch(spriteEl, nextFaceClass) {
  // いったん全ての表情クラスとアニメーション用クラスを外す
  spriteEl.classList.remove(
    'face-normal',
    'face-smile',
    'face-active',
    'face-error',
    'is-animating'
  );

  // ブラウザに「クラスを外した状態」を一度認識させる（強制リフロー）
  // ※これがないと、同じ瞬間にクラスを付け直した時にアニメーションが再再生されない
  void spriteEl.offsetWidth;

  // 新しい表情クラスとアニメーション用クラスを同時に付与する
  spriteEl.classList.add(nextFaceClass, 'is-animating');
}


/* ==========================================================================
   6. 天気ウィジェット（Open-Meteo API から福岡の現在天気を取得）
   --------------------------------------------------------------------------
   APIキー不要の Open-Meteo API をブラウザから直接 fetch() で呼び出し、
   取得した気温・湿度・天気コード（WMO規格）を画面に表示します。
   ========================================================================== */
async function initWeatherWidget() {
  const weatherBody = document.getElementById('weather-body');
  if (!weatherBody) return;

  // 福岡（緯度33.5902 / 経度130.4017）の現在の気温・湿度・天気コードを取得するURL
  const apiUrl =
    'https://api.open-meteo.com/v1/forecast' +
    '?latitude=33.5902&longitude=130.4017' +
    '&current=temperature_2m,relative_humidity_2m,weather_code' +
    '&timezone=Asia%2FTokyo';

  try {
    // サーバーへ通信してレスポンスを待つ（非同期処理：await）
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTPエラー: ${response.status}`);
    }

    const data = await response.json();
    const current = data?.current;
    if (!current) {
      throw new Error('天気データが見つかりません');
    }

    const info = getWeatherInfo(current.weather_code);

    // 取得したデータで画面のDOMを組み立てる
    renderWeatherContent(weatherBody, {
      icon: info.icon,
      label: info.label,
      temp: current.temperature_2m,
      humidity: current.relative_humidity_2m,
    });
  } catch (err) {
    console.error('Open-Meteo取得エラー:', err);
    weatherBody.innerHTML = '';
    const errorEl = document.createElement('p');
    errorEl.className = 'weather-status is-error';
    errorEl.textContent = '天気の取得に失敗しました';
    weatherBody.appendChild(errorEl);
  }
}

/**
 * WMO天気コードを日本語のラベルと絵文字に変換する
 */
function getWeatherInfo(code) {
  if (code === 0) return { label: '快晴', icon: '☀️' };
  if (code >= 1 && code <= 3) return { label: '晴れ・曇り', icon: '⛅' };
  if (code >= 45 && code <= 48) return { label: '霧', icon: '🌫️' };
  if (code >= 51 && code <= 67) return { label: '雨', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { label: '雪', icon: '❄️' };
  if (code >= 80 && code <= 82) return { label: 'にわか雨', icon: '🌦️' };
  if (code >= 95 && code <= 99) return { label: '雷雨', icon: '⛈️' };
  return { label: '不明', icon: '🌡️' };
}

/**
 * 取得した天気データを安全なDOM操作（textContent）でカード内に描画する
 */
function renderWeatherContent(container, { icon, label, temp, humidity }) {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'weather-content';

  const mainInfo = document.createElement('div');
  mainInfo.className = 'weather-main';

  const iconEl = document.createElement('span');
  iconEl.className = 'weather-icon';
  iconEl.textContent = icon;

  const tempEl = document.createElement('span');
  tempEl.className = 'weather-temp';
  tempEl.textContent = `${temp}°C`;

  mainInfo.append(iconEl, tempEl);

  const subInfo = document.createElement('div');
  subInfo.className = 'weather-sub';

  const condEl = document.createElement('p');
  condEl.className = 'weather-condition';
  condEl.textContent = label;

  const humEl = document.createElement('p');
  humEl.textContent = `湿度: ${humidity}%`;

  subInfo.append(condEl, humEl);
  wrapper.append(mainInfo, subInfo);
  container.appendChild(wrapper);
}
