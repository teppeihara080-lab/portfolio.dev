'use strict';

// HTMLの読み込みが終わったら、4つの機能を順番に初期化する
initThemeToggle();
initSkillBadges();
initScrollSpy();
initBentoDragAndDrop();


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
      toggleBtn.setAttribute('aria-pressed', String(isDark));
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
 */
function restoreCardOrder(grid, storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!Array.isArray(saved)) return;

    saved.forEach((id) => {
      const card = grid.querySelector(`.bento-card[id="${id}"]`);
      if (card) grid.appendChild(card);
    });
  } catch {
    // 保存データが壊れていた場合は初期順のまま表示する
  }
}
