# 30同時実行負荷試験ガイド

## 1. 試験方針

同時利用容量はブラウザを30台操作せず、公開APIへ30個の独立したブラウザセッションIDと会話セッションIDを付けて試験する。これによりAPI Gateway、Lambda Authorizer、Chat Lambda、AgentCore Runtime、Memory、Bedrockモデルの実経路を再現性のある条件で計測できる。

UIは通常の機能試験として、1台のPCとiPhone相当表示でログイン、IME、SSEストリーミング、Markdown、設定、クリアを確認する。30画面の同時操作はバックエンド容量の証明には使用しない。

## 2. 既定シナリオ

`npm run loadtest`は次を実行する。

1. Cognitoへ共有受講者IDでSRPログインし、アクセストークンをメモリ内だけで保持する。
2. 1リクエストを送って認可キャッシュとRuntimeをウォームアップする。
3. Nova Micro、ツールなしで30個の新規セッションを同時開始する。
4. 各セッションへ異なる無害なニックネームを記憶させる。
5. 同じ30セッションで2ターン目を同時実行し、自分のニックネームだけを回答できるか確認する。
6. 他セッションのニックネームが1件も混入しないことを検査する。

計測値はHTTPステータス、SSE完了率、最初の`delta`までの時間、完了時間、エラーコード、短期メモリ分離結果である。アクセストークン、パスワード、会話本文はレポートへ保存しない。

## 3. 実行

本番トレーニングを実施していない時間帯に行う。

```bash
export LOAD_TEST_USERNAME='<training-user-id>'
npm run loadtest
unset LOAD_TEST_USERNAME
```

パスワードはプロンプトへ非表示で入力する。シェル履歴、リポジトリ、ログファイルには指定しない。結果は既定で`tmp/load-test-report.json`へ権限`0600`で保存され、Git管理されない。

## 4. 条件変更

30セッションの開始を2秒間に分散する場合:

```bash
export LOAD_TEST_USERNAME='<training-user-id>'
export LOAD_TEST_RAMP_MS='2000'
npm run loadtest
unset LOAD_TEST_USERNAME LOAD_TEST_RAMP_MS
```

Claude Sonnet 5で確認する場合:

```bash
export LOAD_TEST_MODEL='claude-sonnet-5'
```

RAGまたはWeb検索を含める場合:

```bash
export LOAD_TEST_TOOL_KEYS='rag'
export LOAD_TEST_TOOL_KEYS='web-search,rag'
```

Web検索は実行回数に応じた料金が発生する。モデルやツールの条件は一度に変えず、基本試験に合格してから個別に実行する。

## 5. 合格基準

- 1ターン目と2ターン目がともに30/30成功する。
- HTTP `429`、`5xx`、SSE `error`が0件である。
- 30セッションすべてが自分のニックネームを回答する。
- 他セッションのニックネーム混入が0件である。
- Chat Lambda、Authorizer、AgentCore、BedrockでThrottleまたはErrorの増加がない。
- P95の最初の`delta`時間と完了時間を記録し、講義で許容する応答時間内である。

完全同時開始が失敗し、2秒ランプアップが成功する場合は、AgentCoreの新規Runtimeセッション作成レートが主な候補となる。必要に応じてクォータ引き上げまたは一時スロットリングへの再試行を検討する。
