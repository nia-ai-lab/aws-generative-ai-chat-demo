# Generative AI Chat ドキュメント

AWS トレーニングコース「Generative AI Essentials on AWS」で受講者が操作するデモアプリケーションの要件と設計をまとめる。

## 文書一覧

- [要件定義書](./requirements-definition.md)
- [システム設計書](./system-design.md)

## 採用方針

- フロントエンド: React + TypeScript
- API、Lambda、インフラ: TypeScript
- AI Agent: Python 3.12 + LangGraph
- AI 実行基盤: Amazon Bedrock AgentCore Runtime
- 会話メモリ: Amazon Bedrock AgentCore Memory の短期メモリ
- 認証・認可: Amazon Cognito User Pools とロールベースアクセス制御
- ホスティング・継続的デプロイ: AWS Amplify Gen 2
- デプロイ先: 環境変数 `DEPLOY_ACCOUNT_ID` で指定する AWS アカウント、東京リージョン `ap-northeast-1`

## 文書ステータス

初版設計。実装開始前に、各文書の「確認事項」を確定すること。
