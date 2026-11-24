'use strict';

// HTMLの読み込みが終わったら、各機能を順番に初期化する
initThemeToggle();
initSkillBadges();
initScrollSpy();
initBentoDragAndDrop();
initRobotAvatar();
initWeatherWidget();
initContactModal();

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
   4. ドラッグ操作によるBentoカードの並び替え機能（PC限定 & リセット機能付き）
   --------------------------------------------------------------------------
   - PC（768px以上・マウス操作）限定：スマホの誤作動や狭い画面での窮屈さを防ぐ
   - 誤操作防止の閾値：8px 以上動かした時だけドラッグ開始とみなす
   - 離した瞬間に入れ替え：ドラッグ中はドロップ先の枠だけ光らせ、離した瞬間に1回だけ
     入れ替えることで、途中でレイアウトが崩れてカードが宙に浮くバグを防ぐ
   ========================================================================== */
function initBentoDragAndDrop() {
  const grid = document.getElementById('bento-grid');
  if (!grid) return;

  const ORDER_STORAGE_KEY = 'portfolio-bento-order';
  const HIDDEN_STORAGE_KEY = 'portfolio-bento-hidden';
  const DRAG_THRESHOLD = 8; // ドラッグ開始とみなす最小移動距離（px）
  const resetBtn = document.getElementById('reset-order-btn');

  // ページ読み込み時点（HTMLどおり）の初期順を控えておく（リセットボタン用）
  const initialOrder = getGridOrder(grid);

  // 前回保存したカードの並び順・非表示状態があれば復元する
  restoreCardOrder(grid, ORDER_STORAGE_KEY);
  restoreHiddenCards(grid, HIDDEN_STORAGE_KEY);

  // 並び順が変わっている、または非表示カードが1つでもある時だけ「配置リセット」ボタンを表示
  const updateResetButton = () => {
    if (!resetBtn) return;
    const currentOrder = getGridOrder(grid);
    const isOrderModified = currentOrder.some((id, index) => id !== initialOrder[index]);
    const hasHiddenCards = grid.querySelector('.bento-card.is-hidden') !== null;
    resetBtn.hidden = !(isOrderModified || hasHiddenCards);
  };
  updateResetButton();

  // リセットボタンが押されたら、並び順も非表示状態もすべて初期状態に戻す
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(ORDER_STORAGE_KEY);
      localStorage.removeItem(HIDDEN_STORAGE_KEY);

      initialOrder.forEach((id) => {
        const card = grid.querySelector(`.bento-card[id="${id}"]`);
        if (card) {
          card.classList.remove('is-hidden');
          grid.appendChild(card);
        }
      });
      updateResetButton();
    });
  }

  // 各カードの「×（非表示）」ボタンが押されたらカードを隠す（CSS Gridが自動で隙間を詰める）
  grid.addEventListener('click', (e) => {
    const hideBtn = e.target.closest('.hide-card-btn');
    if (!hideBtn) return;

    const card = hideBtn.closest('.bento-card');
    if (!card || card.parentNode !== grid) return;

    card.classList.add('is-hidden');
    saveHiddenCards(grid, HIDDEN_STORAGE_KEY);
    updateResetButton();
  });

  let dragState = null;
  let isDragging = false;
  let dropTarget = null;

  // ドロップ先ハイライトを解除するヘルパー関数
  const clearDropTarget = () => {
    if (dropTarget) {
      dropTarget.classList.remove('is-drop-target');
      dropTarget = null;
    }
  };

  // 1. 押し始めた時（まだドラッグ開始はしない）
  grid.addEventListener('pointerdown', (e) => {
    // PC画面幅（768px以上）かつマウス等の左クリックのみ許可（スマホ・タッチは無効）
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if (!isDesktop || e.pointerType === 'touch' || e.button !== 0) return;

    // ハンドル部分（.drag-handle）を掴んだ時だけ反応させる（本文のテキスト選択と干渉させないため）
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;

    const card = handle.closest('.bento-card');
    if (!card || card.parentNode !== grid) return;

    dragState = {
      card,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
    isDragging = false;
  });

  // 2. マウスを動かした時（windowで監視することで画面外に出ても追跡が途切れない）
  window.addEventListener('pointermove', (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;

    // 移動距離が閾値（8px）未満なら「ただのクリックや手ブレ」とみなして何もしない
    if (!isDragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      isDragging = true;
      dragState.card.classList.add('is-dragging');
      document.body.classList.add('is-card-dragging');
    }

    // 移動量に合わせてカードを視覚的に動かす
    dragState.card.style.transform = `translate(${dx}px, ${dy}px) scale(1.01)`;

    // マウスの「真下」にある別のカードを探し、ドロップ先の点線枠を付ける
    const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
    const nextTarget = elementBelow?.closest('.bento-card');
    const validTarget =
      nextTarget && nextTarget !== dragState.card && nextTarget.parentNode === grid
        ? nextTarget
        : null;

    if (validTarget !== dropTarget) {
      clearDropTarget();
      if (validTarget) {
        dropTarget = validTarget;
        dropTarget.classList.add('is-drop-target');
      }
    }
  });

  // 3. マウスを離した時・中断された時（windowで監視し、確実に後片付けする）
  const endDrag = (e) => {
    if (!dragState) return;
    if (e && e.pointerId !== undefined && e.pointerId !== dragState.pointerId) return;

    const { card } = dragState;
    const target = dropTarget;
    const wasDragging = isDragging;

    // 状態と見た目を必ず元に戻す（宙浮き・操作不能バグの完全防止）
    card.classList.remove('is-dragging');
    card.style.transform = '';
    document.body.classList.remove('is-card-dragging');
    clearDropTarget();
    dragState = null;
    isDragging = false;

    // 別のカードの上で離した時だけ、1回だけHTMLの並び順を入れ替える
    if (wasDragging && target) {
      swapCardOrder(grid, card, target);
      saveCardOrder(grid, ORDER_STORAGE_KEY);
      updateResetButton();
    }
  };

  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  window.addEventListener('blur', () => endDrag());
}

/**
 * ドラッグしたカードをターゲット位置へ移動する
 */
function swapCardOrder(grid, draggedCard, targetCard) {
  const cards = Array.from(grid.children);
  const draggedIndex = cards.indexOf(draggedCard);
  const targetIndex = cards.indexOf(targetCard);

  if (draggedIndex < targetIndex) {
    grid.insertBefore(draggedCard, targetCard.nextSibling);
  } else {
    grid.insertBefore(draggedCard, targetCard);
  }
}

/**
 * 現在のグリッド内のカードID配列を取得する
 */
function getGridOrder(grid) {
  return Array.from(grid.children)
    .map((el) => el.id)
    .filter(Boolean);
}

/**
 * 現在のカードの並び順（idの配列）を localStorage に保存する
 */
function saveCardOrder(grid, storageKey) {
  localStorage.setItem(storageKey, JSON.stringify(getGridOrder(grid)));
}

/**
 * localStorage に保存されたカードの並び順を復元する
 * ※カードが追加・削除された場合は古い並び順が崩れる原因になるため、構成が変わっていたらリセットする
 */
function restoreCardOrder(grid, storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!Array.isArray(saved)) return;

    const currentIds = getGridOrder(grid);

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

/**
 * 非表示にしたカードのID一覧を localStorage に保存する
 */
function saveHiddenCards(grid, storageKey) {
  const hiddenIds = Array.from(grid.querySelectorAll('.bento-card.is-hidden'))
    .map((el) => el.id)
    .filter(Boolean);
  localStorage.setItem(storageKey, JSON.stringify(hiddenIds));
}

/**
 * localStorage に保存された非表示状態を復元する
 */
function restoreHiddenCards(grid, storageKey) {
  try {
    const hiddenIds = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!Array.isArray(hiddenIds)) return;

    hiddenIds.forEach((id) => {
      const card = grid.querySelector(`.bento-card[id="${id}"]`);
      if (card) card.classList.add('is-hidden');
    });
  } catch {
    // 保存データが壊れていた場合は無視する
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

/* ==========================================================================
   7. お問い合わせモーダル（Formspree連携）の制御機能
   ========================================================================== */
function initContactModal() {
  const modal = document.getElementById('contactModal');
  const openBtn = document.getElementById('openContactModal');
  const closeBtn = document.getElementById('closeContactModal');
  const form = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  const statusText = document.getElementById('formStatus');

  // 必要な要素が揃っていない場合は何もしない（安全対策）
  if (!modal || !openBtn || !form) return;

  // モーダルを開く関数
  const openModal = () => {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    // 開いたときに最初の入力欄へ自動でフォーカスを当てる（使いやすさ向上）
    form.querySelector('input')?.focus();
  };

  // モーダルを閉じる関数
  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  };

  // ボタン操作と背景クリック・Escキーで開閉する
  openBtn.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });

  // フォームの非同期送信（ページ遷移なしでFormspreeへ送信する）
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '送信中...';
    }
    if (statusText) {
      statusText.textContent = '';
    }

    try {
      const response = await fetch(form.action, {
        method: form.method,
        body: new FormData(form),
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        if (statusText) {
          statusText.textContent = 'お問い合わせを送信しました。ありがとうございます！';
        }
        form.reset();
        // 2秒後に自動でモーダルを閉じる
        setTimeout(closeModal, 2000);
      } else {
        if (statusText) {
          statusText.textContent = '送信に失敗しました。時間をおいて再度お試しください。';
        }
      }
    } catch (error) {
      if (statusText) {
        statusText.textContent = '通信エラーが発生しました。ネットワーク環境をご確認ください。';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '送信する';
      }
    }
  });
}
