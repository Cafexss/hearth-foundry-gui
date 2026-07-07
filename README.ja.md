# Hearth 🔥⚒

**[Foundry](https://github.com/foundry-rs/foundry) ツールチェーンのための、温かくエレガントなデスクトップ GUI。**

[English](README.md) · [中文](README.zh-CN.md) · 日本語 · [한국어](README.ko.md)

Hearth はローカルの `forge`・`cast`・`anvil`・`chisel` を Claude スタイルの美しいデスクトップアプリに包み込みます。コントラクトのデプロイ、トランザクション送信、失敗のトレース、ローカルチェーンの起動——コマンドラインフラグを覚える必要はありません。

![Hearth](docs/screenshot.png)

## 必要環境

- [Foundry](https://getfoundry.sh)（`forge` / `cast` / `anvil` / `chisel` が `~/.foundry/bin` または PATH 上にあること）
- Node.js ≥ 18

## 起動

```bash
npm install
npm start
```

## 機能

| モジュール | 内容 |
|-----------|------|
| **ダッシュボード** | ネットワーク状態（ブロック高・gas 価格・RPC レイテンシ）、ツールチェーンバージョン、残高クイック照会、取引履歴 |
| **ビルド & テスト** (forge) | プロジェクトの作成・オープン、ワンクリックで build / test / fmt / snapshot / coverage、ストリーミング出力とテストフィルタ |
| **デプロイ** (forge create / script) | 単一コントラクトのデプロイ（コンストラクタ引数の自動解析・dry-run）、`forge script` 完全対応——シミュレーション、ブロードキャスト、`run-latest.json` の全トランザクション解析 |
| **ABI ワークベンチ** | プロジェクト成果物または貼り付けた JSON から ABI を読み込み、クリック可能な関数パネルを生成：一括読み取り、引数付き呼び出し、書き込みの見積りと送信、payable 対応 |
| **送金** (cast send) | ネイティブコイン送金（gas を残した全額ボタン付き）、decimals 自動換算の ERC-20 送金、approve / 無制限承認 / allowance 照会 |
| **コントラクト呼び出し** (cast call / send) | シグネチャによる読み書き、実際の送信者での gas 見積り、未検証コントラクト向け Raw Calldata モード、生の cast コマンド実行 |
| **チェーン照会** (cast) | 残高 / Nonce / コード / Tx / レシート / ブロック / ストレージスロット |
| **デバッグ & ログ** (cast run / logs) | トランザクション Trace 再生、シミュレーション追跡（色付き出力）、アドレス・シグネチャ・ブロック範囲によるイベントログ照会 |
| **エンコード & 変換** (cast) | 単位・基数変換、Keccak-256、セレクタとイベントトピック、ABI エンコード / Calldata デコード、チェックサム、4byte 逆引き |
| **ウォレット** (cast wallet) | ウォレット・ニーモニック生成、アドレス導出、メッセージ署名と検証、Keystore のインポートと一覧 |
| **Anvil ノード** | ワンクリックのローカルチェーン（メインネットフォーク対応）、10 個のテストアカウントをコピー可能な表に自動解析 |
| **チェーン操作** (cast rpc) | マイニング、時間送り、状態スナップショットと復元、任意アドレスの残高設定、クジラアカウントの impersonate |
| **マルチチェーン** | Ethereum / Sepolia / Base / Arbitrum / Optimism / Polygon / BSC / Anvil を内蔵、カスタム RPC、ワンクリック切替 |
| **多言語 & テーマ** | 中文 / English / 日本語 / 한국어、ライト & ダークテーマ |

## セキュリティ

- 秘密鍵はローカルの `forge` / `cast` プロセスへの引数としてのみ渡され、**保存されません**。ログでは自動的にマスクされます。
- より安全な方法として、`cast wallet import` で Keystore をインポートし、アカウント名とパスワードで署名できます。
- 設定はすべてローカルの `userData` ディレクトリに保存されます。

## パフォーマンスと安定性

子プロセスの出力は約 40ms のウィンドウで結合してから IPC を通過し、レンダラはアニメーションフレームごとに DOM 書き込みをバッチ処理します——5,000 行のテストログ（369KB）を約 0.5 秒で描画、UI のカクつきはゼロ。設定はデバウンス + アトミック書き込み、シングルインスタンスロック、レンダラクラッシュの自動復旧を備えます。

## クレジット

このアプリは **Claude (Fable 5)** が設計・開発しました。Foundry は [Paradigm / foundry-rs](https://github.com/foundry-rs/foundry) のプロジェクトです。

## ライセンス

[MIT](LICENSE)
