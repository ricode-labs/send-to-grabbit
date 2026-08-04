# Send-to-Grabbit

Chrome のダウンロードを Grabbit に送るための拡張機能です。

## 使う理由

手動で URL をコピーして Grabbit に貼り付ける手間をなくします。

設定は不要です。

さらに、利用可能な場合は cookie、referrer、user agent、取得できたリクエストヘッダーも引き継ぎます。ログイン状態や署名付きリクエストに依存するダウンロードでは、単純な URL だけを渡すより成功しやすくなります。

## コマンド

- `npm install` で依存関係をインストールします。
- `npm run typecheck` で TypeScript のチェックを実行します。
- `npm run build` で拡張機能を `dist/` にビルドします。

## Chrome への読み込み

1. `npm run build` を実行します。
2. `chrome://extensions` を開きます。
3. デベロッパーモードを有効にします。
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、このリポジトリの `dist/` ディレクトリを選びます。

## プロトコル

ダウンロードは 1 つの固定形式で Grabbit に送られます。

```text
grabbit://addUri?payload=<url-encoded-json>
```

`payload` クエリパラメータには、`url` と aria2 形式の `header` 行を含む URL エンコード済み JSON が入ります。

```json
{
  "url": "https://example.com/file.zip",
  "header": ["Accept-Language: ja", "Accept-Charset: utf-8"]
}
```
