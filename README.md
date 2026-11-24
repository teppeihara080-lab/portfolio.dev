# BoxBot.Folio

「仕組みを考える」論理的思考と「使う・支える」現場感覚を掛け合わせた、teppee のポートフォリオサイトです。

🔗 **公開URL**: https://vercel.app

---

## 💡 制作コンセプト：部品化 × カスタマイズUI

ソフトウェア開発（3年）と、自治体・教育現場でのICT支援（6年）の経験から、**「システムは動くだけでなく、現場の人がストレスなく使い続けられる設計が大切である」**という考えをUIとして表現しました。

- **情報の「部品化」とカスタマイズ性**  
  部署や立場によって必要な情報は異なるため、各コンテンツを独立したカード（Bentoグリッド）として設計。閲覧者がドラッグ＆ドロップで並べ替えたり、不要なカードを非表示にしたりできるカスタマイズ機能を備えています。
- **「自分の手で調整できる」コントロール感**  
  使う人自身が画面を最適化できる体験を通じて、システムへの抵抗感を減らし、本来の業務に集中できる余白を生むUIのモデルケースを目指しました。

---

## ✨ 主な実装機能

- **カードのドラッグ＆ドロップ並び替え / 非表示・配置リセット**  
  直感的なレイアウト変更と、`localStorage` を用いた状態保存・復元。
- **昼夜モード（Light / Dark テーマ）切り替え**  
  OSのカラー設定の自動検知、手動切り替え、`localStorage` への設定保存、スマホブラウザUIカラー（`theme-color`）の連動。
- **インタラクティブ・マスコット「BoxBot」**  
  部位ごとのクリック・クリック連打に応じたリアクション表示。
- **外部API・サービス連携**  
  - **天気ウィジェット**: Open-Meteo API を用いた福岡のリアルタイム天気情報の非同期取得。
  - **お問い合わせモーダル**: Formspree 連携によるサーバーレスな非同期フォーム送信（スパム対策用ハニーポット・二重送信防止実装）。
- **レスポンシブ＆アクセシビリティ配慮**  
  CSS変数・コンテナクエリを活用した柔軟なレイアウト設計、およびキーボード操作（`Esc` キーでのモーダル閉鎖など）。

---

## 🛠 技術スタック

フレームワークに頼らず、**素の HTML / CSS / JavaScript（Vanilla JS）** で状態管理やDOM操作を実装しつつも、保守性の高いコード構造を意識しました。

- **Markup / Styling**: HTML5, CSS3（CSS Custom Properties, Grid / Flexbox, Container Queries）
- **Scripting**: JavaScript (ES2020+, `'use strict'`, 機能別モジュール関数設計)
- **External APIs / Services**: Open-Meteo API, Formspree
- **Hosting / Deployment**: Vercel

---

## 📂 ディレクトリ構成（例）

```text
.
├── index.html          # メインHTML
├── css/
│   └── style.css       # スタイルシート（テーマ変数・レイアウト・コンポーネント）
├── js/
│   └── script.js       # 機能別初期化スクリプト（テーマ・D&D・API連携・モーダル等）
├── images/             # サムネイル・アイコン画像（WebP / SVG）
└── README.md           # 本ドキュメント
```

---

## 📜 Credits / Licenses

本プロジェクトでは以下のオープンソース素材を使用しています。

- **Emoji Graphics**: [Twemoji](https://github.com) by Twitter, Inc and other contributors  
  Licensed under [CC-BY 4.0](https://creativecommons.org)
- **Icons**: [Phosphor Icons](https://phosphoricons.com) by Helena Zhang and Tobias Fried  
  Licensed under [MIT License](https://github.com)

---

© 2026 teppee / BoxBot.Folio
