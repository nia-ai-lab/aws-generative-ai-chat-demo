# AWS Generative AI Chat Demo

受講者がブラウザから操作できる、AWS トレーニング向けの生成 AI チャットデモアプリケーションです。Generative AI Essentials に限らず、Generative AI Developer など複数のトレーニングで利用できる構成を目指します。

## Status

フロントエンド、API、認証、AgentCoreエージェント、CDKインフラ、テストを実装済みです。

- [要件定義書](./docs/requirements-definition.md)
- [システム設計書](./docs/system-design.md)
- [デプロイ・運用ガイド](./docs/deployment-guide.md)

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
- Claude Sonnet 5、Nova 2 Lite、Nova Proのクロスリージョン推論
- Python/LangGraphエージェントとAgentCore Memoryのセッション内短期記憶
- 管理者によるモデル・アプリ既定プロンプト設定
- KMS暗号化された7日保持の会話監査ログ
- Amplify Gen 2とCDK TypeScriptによる一括デプロイ

## Local checks

```bash
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
