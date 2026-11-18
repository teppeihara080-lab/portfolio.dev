'use strict';

// 各機能の初期化を実行
initSkillBadges();
initScrollSpy();
initBentoDragAndDrop();

/**
 * Skillsカードのバッジ選択・詳細モニター切り替え機能
 */
function initSkillBadges() {
  const badges = document.querySelectorAll('.skill-badge');
  const detailTitle = document.getElementById('skill-detail-title');
  const detailDesc = document.getElementById('skill-detail-desc');

  // 対象要素が存在しないページでのエラー防止
  if (!badges.length || !detailTitle || !detailDesc) return;

  const updateSkillDetail = (badge) => {
    badges.forEach((b) => b.classList.remove('is-active'));
    badge.classList.add('is-active');

    detailTitle.textContent = badge.dataset.skill || '';
    detailDesc.textContent = badge.dataset.desc || '';
  };

  badges.forEach((badge) => {
    badge.addEventListener('click', () => updateSkillDetail(badge));
    badge.addEventListener('mouseenter', () => updateSkillDetail(badge));
  });
}


/**
 * スクロール位置に連動してナビゲーション（制御盤ボタン）を点灯させる機能
 * （クリック遷移時の誤点灯防止＆最下部補正付き）
 */
function initScrollSpy() {
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.bento-card[id]');

  if (!navLinks.length || !sections.length) return;

  let isClickScrolling = false; // クリックによるスクロール中かどうかのフラグ
  let scrollTimeout = null;

  // 該当するIDのリンクだけをアクティブ（点灯）にする関数
  const setActiveLink = (id) => {
    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      link.classList.toggle('is-current', href === `#${id}`);
    });
  };

  // 1. ナビボタンをクリックした時は、即座にそのボタンを点灯させて監視を一時ロック
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const targetId = link.getAttribute('href')?.replace('#', '');
      if (!targetId) return;

      isClickScrolling = true;
      setActiveLink(targetId);

      // スムーズスクロールが完了するまで監視をロック（0.8秒後に解除）
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isClickScrolling = false;
      }, 800);
    });
  });

  // 2. 通常のスクロール監視（画面の上寄り〜中央付近を判定エリアに設定）
  const observerOptions = {
    root: null,
    rootMargin: '-20% 0px -55% 0px',
    threshold: 0,
  };

  const observer = new IntersectionObserver((entries) => {
    // クリック遷移中の自動上書きをブロック
    if (isClickScrolling) return;

    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        setActiveLink(entry.target.id);
      }
    });
  }, observerOptions);

  sections.forEach((section) => observer.observe(section));

  // 3. ページ最下部までスクロールし切った時は、最後のセクション（About）を点灯させる
  window.addEventListener('scroll', () => {
    if (isClickScrolling) return;

    const isAtBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10;

    if (isAtBottom) {
      const lastSection = sections[sections.length - 1];
      setActiveLink(lastSection.id);
    }
  }, { passive: true });

  // 初期表示時は一番上の要素を点灯
  setActiveLink(sections.id);
}

/**
 * ドラッグハンドル操作によるBentoカードの並び替え機能（PC・スマホ両対応）
 */
function initBentoDragAndDrop() {
  const grid = document.getElementById('bento-grid');
  if (!grid) return;

  let draggedCard = null;
  let startX = 0;
  let startY = 0;

  grid.addEventListener('pointerdown', (e) => {
    // ハンドル部分が押された時だけ反応する
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;

    draggedCard = handle.closest('.bento-card');
    if (!draggedCard) return;

    // 掴んだ瞬間の座標を記録
    startX = e.clientX;
    startY = e.clientY;

    draggedCard.classList.add('is-dragging');
    // 指やマウスがカードから外れても追跡し続ける設定
    handle.setPointerCapture(e.pointerId);
  });

  grid.addEventListener('pointermove', (e) => {
    if (!draggedCard) return;

    // 指（マウス）の移動量に合わせてカードを視覚的に動かす
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    draggedCard.style.transform = `translate(${dx}px, ${dy}px) scale(1.02)`;

    // ドラッグ中のカードの「真下」にある別のカードを取得
    const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
    const targetCard = elementBelow?.closest('.bento-card');

    // 別のカードの上に乗ったらDOMの順番を入れ替える
    if (targetCard && targetCard !== draggedCard && targetCard.parentNode === grid) {
      const prevRect = draggedCard.getBoundingClientRect();

      const cards = Array.from(grid.children);
      const draggedIndex = cards.indexOf(draggedCard);
      const targetIndex = cards.indexOf(targetCard);

      if (draggedIndex < targetIndex) {
        grid.insertBefore(draggedCard, targetCard.nextSibling);
      } else {
        grid.insertBefore(draggedCard, targetCard);
      }

      // DOM入れ替えによるレイアウト位置のジャンプ分を相殺して指に吸い付かせる
      const nextRect = draggedCard.getBoundingClientRect();
      startX += nextRect.left - prevRect.left;
      startY += nextRect.top - prevRect.top;

      const newDx = e.clientX - startX;
      const newDy = e.clientY - startY;
      draggedCard.style.transform = `translate(${newDx}px, ${newDy}px) scale(1.02)`;
    }
  });

  const endDrag = () => {
    if (!draggedCard) return;

    draggedCard.classList.remove('is-dragging');
    draggedCard.style.transform = '';
    draggedCard = null;
  };

  grid.addEventListener('pointerup', endDrag);
  grid.addEventListener('pointercancel', endDrag);
}





