# Amazon Bedrock AgentCore Observability 設計

## 対象範囲

このアプリのデモで確認しやすいように、東京リージョンの次のリソースを AgentCore 純正 Observability に対応させる。

- AgentCore Runtime と `LiveEndpoint`
- AgentCore Memory（短期会話メモリ）
- LangGraph、Amazon Bedrock モデル呼び出し、ツール呼び出し、AWS SDK 呼び出しの自動トレース

Web Search Gateway はバージニア北部（`us-east-1`）にあるため、今回のログ／トレース対象には含めない。既存のWeb検索機能は変更しない。

## 構成

```text
ブラウザ
  -> API Gateway / Lambda（既存構成・既存監査ログを維持）
  -> AgentCore Runtime / LiveEndpoint（東京）
       |- APPLICATION_LOGS -> /aws/bedrock-agentcore/runtimes/<runtime-id>-LiveEndpoint
       |- ADOT spans        -> 同じロググループの spans ストリーム
       |- LangGraph / model / tool spans（自動計装）
       `- AgentCore Memory
            |- APPLICATION_LOGS -> /aws/vendedlogs/bedrock-agentcore/memory/APPLICATION_LOGS/<memory-id>
            `- TRACES          -> X-Ray / CloudWatch Transaction Search
```

## Runtime

RuntimeのコードZIPは、AWS CDKが案内するCode Assetの起動形式を使う。

```text
opentelemetry-instrument main.py
```

Python依存関係には次の2つだけをObservability目的で追加する。

- `aws-opentelemetry-distro>=0.18.0`
- `openinference-instrumentation-langchain==0.1.70`

LangGraph/LangChain用の計装ライブラリはOpenInference版だけを使用する。アプリコードから手動でTracerを初期化せず、AgentCore Runtimeが用意するADOT環境と自動計装を利用する。

`UNIFIED_TRACES_DESTINATION_ENABLED=true` をRuntime環境変数に設定し、スパンの出力先を `LiveEndpoint` のロググループへ集約する。それ以外のOTEL環境変数はアプリ側で上書きしない。

LambdaからRuntimeへのHTTP呼び出しでは、受信した `traceparent`、`tracestate`、`X-Amzn-Trace-Id` をそのまま転送する。受信したX-Rayヘッダーがない場合だけLambda標準の `_X_AMZN_TRACE_ID` を使用する。独自Correlation IDは生成しない。

Runtimeの `APPLICATION_LOGS` 配信には次のフィールドを明示する。

- `timestamp`
- `resource_arn`
- `event_timestamp`
- `account_id`
- `request_id`
- `session_id`
- `trace_id`
- `span_id`
- `service_name`
- `operation`
- `request_payload`
- `response_payload`

プロンプト、応答、思考過程をアプリが独自に重複記録する処理は追加しない。既存の開始／エラー運用ログのみを維持する。

## Memory

既存のMemoryリソースは変更・置換しない。Memory ARNに対して、CloudWatch Logsのネイティブ配信リソースを追加する。

- `APPLICATION_LOGS` をMemory専用ロググループへ配信
- `TRACES` をX-Rayへ配信
- ADOTのAWS SDK自動計装により `CreateEvent`、`GetEvent`、`ListEvents` をRuntimeのトレース内でも確認可能にする

Memoryロググループの保持期間は7日。追加のKMSキーは作らず、CloudWatch Logs標準の保存時暗号化を使う。スタック削除時にはロググループも削除する。

## IAM

Runtime実行ロールにはObservabilityに必要な次の権限だけを付与する。

- `xray:PutTraceSegments`
- `xray:PutTelemetryRecords`
- `xray:GetSamplingRules`
- `xray:GetSamplingTargets`
- `logs:CreateLogGroup`
- `logs:DescribeLogGroups`
- `logs:DescribeLogStreams`
- `logs:CreateLogStream`
- `logs:PutLogEvents`
- `logs:PutResourcePolicy`
- `cloudwatch:PutMetricData`（namespaceを `bedrock-agentcore` に限定）

`logs:PutResourcePolicy` はAWS公式のRuntime実行ロール例に合わせる。このアクションはIAM上でリソースレベル制御に対応していないため、Resourceは `*` とする。

## AWSアカウント側の前提

この実装ではAWSアカウント設定を変更しない。デプロイ後にトレースを表示するには、対象アカウントの東京リージョンでCloudWatch Transaction Searchが有効で、トレースセグメントの送信先がCloudWatch Logsになっている必要がある。

この設定がない場合、アプリのチャット機能は動作しても、統合された `spans` ストリームやTransaction Searchの表示は利用できない。

## デモでの確認箇所

1. CloudWatchのGenerative AI ObservabilityでRuntimeとセッションを選ぶ。
2. 同一セッションで複数回チャットし、1つのセッションに複数のトレースが属することを確認する。
3. Runtimeロググループで `runtime-logs`、`otel-rt-logs`、`spans` を確認する。
4. モデル呼び出し、LangGraph処理、ツール呼び出し、Memory操作の親子関係と処理時間を確認する。
5. Memory専用ロググループでMemoryのネイティブログを確認する。

テレメトリの反映には数分かかることがある。

## コストを抑えるための方針

- ログ保持は7日
- Observability用のKMSキーは追加しない
- ダッシュボード、アラーム、Application Signalsの追加設定は作らない
- Web Search Gatewayのクロスリージョンログは収集しない
- CloudTrailやBedrockアカウントレベルのモデル呼び出しログは設定しない

CloudWatch Logsの取り込み／保存、X-Ray／Transaction Search、AgentCoreの利用量に応じた料金は別途発生する。

## ローカル検証

```bash
npm run package:agent
npm run check
```

インフラテストでは次を検証する。

- RuntimeのADOT起動コマンド
- `UNIFIED_TRACES_DESTINATION_ENABLED=true`
- Runtime／Memoryの `APPLICATION_LOGS` と `TRACES` 配信
- Runtime Application Logsのフィールド一覧
- Memoryログの7日保持と追加KMSキーなし
- Runtime実行ロールのObservability権限
- W3C／X-Ray標準トレースコンテキストだけを転送すること
- Memory本体の設定が従来どおりであること

## 対象外

- AWSへのデプロイと実環境でのチャット呼び出し
- CloudWatch Transaction Searchの有効化
- Web Search Gatewayのログとトレース
- ダッシュボード、アラーム、CloudTrail、Bedrockモデル呼び出しログ
- フロントエンド変更
- Lambda監査ログの変更
