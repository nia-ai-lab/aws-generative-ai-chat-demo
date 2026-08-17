# AWS Generative AI Chat Demo

受講者がブラウザから操作できる、AWS トレーニング向けの生成 AI チャットデモアプリケーションです。Generative AI Essentials に限らず、Generative AI Developer など複数のトレーニングで利用できる構成を目指します。

## Status

フロントエンド、API、認証、AgentCoreエージェント、CDKインフラ、テストを実装済みです。

- [要件定義書](./docs/requirements-definition.md)
- [システム設計書](./docs/system-design.md)
- [デプロイ・運用ガイド](./docs/deployment-guide.md)
- [モジュール別デモ実施ガイド](./docs/module-demo-guide.md)

## Planned architecture

- React + TypeScript
- AWS Amplify Gen 2
- Amazon Cognito
- Amazon API Gateway + AWS Lambda
- Amazon Bedrock AgentCore Runtime / Memory
- LangGraph Agent in Python 3.12
- Amazon Bedrock foundation models
- Amazon DynamoDB
- Amazon CloudWatch

## Features

- Cognito Access Tokenを検証するLambda Authorizerとロールベースアクセス制御
- React SPAのレスポンシブなチャットUIと日本語IME対応
- Claude Sonnet 5、Nova 2 Lite、Nova Micro、Nova Proのクロスリージョン推論
- Python/LangGraphエージェントとAgentCore Memoryのセッション内短期記憶
- 管理者によるモデル・アプリ既定プロンプト設定（空設定対応）
- ペルソナ設定と現在日時・タイムゾーンの動的プロンプト変数
- 受講者ごとのTemperature・Top P・最大アウトプットトークン設定
- 応答ごとのInput / Outputトークン数とモデル推論料金（日本円・概算）の折りたたみ表示
- ブラウザセッションごとに複数選択できる事前定義Bedrock Guardrailsと、管理者が解除不能にできる必須Guardrail
- KMS暗号化された7日保持の会話監査ログ
- Amplify Gen 2とCDK TypeScriptによる一括デプロイ

## Local checks

Node.jsとnpmはlockfileの再現性を保つため固定している。nvmを利用する場合は先に次を実行する。

```bash
nvm install
nvm use
npm install --global npm@10.8.2
```

```bash
npm run verify:toolchain
npm ci
npm run package:agent
npm run check
```

## Security

このリポジトリは公開リポジトリです。次の情報をコミットしないでください。

- AWS アクセスキー、セッショントークン、Cognito JWT
- パスワード、API キー、秘密鍵、証明書
- 実 AWS アカウント ID や個人用の環境設定
- `.env`、`amplify_outputs.json`、ローカル AWS 設定
- AWS トレーニング教材や再配布権限のないファイル

デプロイ先アカウントなどの環境固有値は、リポジトリ外の環境変数または Amplify の環境設定から渡します。

## License

ライセンスはコード実装開始時に確定します。ライセンスが追加されるまで、無断での再利用・再配布は許諾されません。
