# デプロイ・運用ガイド

## 1. 前提

- AWS CLI v2 と `aws login` が利用できること
- Node.js 22.18.0、npm 10.8.2、Python 3.12、zip、GitHub CLI が利用できること
- デプロイ先は `ap-northeast-1` であること
- GitHub リポジトリを Amplify Hosting に接続できる権限があること
- AgentCore、Bedrock Knowledge Bases、S3/S3 Vectors、Cognito、API Gateway、Lambda、DynamoDB、KMS、CloudWatch、IAM を作成できるデプロイロールがあること
- 東京リージョンでAgentCore Gateway（Web Search connector）を作成・呼び出しできること。旧構成から移行する初回デプロイだけは、米国東部（バージニア北部）の旧Gatewayを削除できるOrganizations/SCP設定であること

実AWSアカウントID、パスワード、トークンはリポジトリや `.env` に保存しない。

## 2. Amplify Hostingの接続

1. Amplifyコンソールを東京リージョンで開き、「新しいアプリ」を作成する。
2. GitHubの公開リポジトリ `nia-ai-lab/aws-generative-ai-chat-demo` と `main` ブランチを接続する。
3. ビルドイメージでNode.js 22.18.0とPython 3.12を利用する。
4. Amplifyの環境変数に、リポジトリ外で管理する次の値を登録する。

| 変数 | 値 |
|---|---|
| `DEPLOY_ACCOUNT_ID` | 対象AWSアカウントID |

`AWS_REGION` はAmplifyのビルド環境から自動供給される。Amplifyアプリ自体を必ず東京リージョンに作成する。

`amplify.yml` がAgentのARM64 ZIP作成、検査、Amplify Gen 2バックエンド、SPAの順にデプロイする。生成される `amplify_outputs.json` はコミットしない。
`package.json`の`overrides`は、`@aws-amplify/data-construct`等に同梱された`@aws-cdk/toolkit-lib`が`semver`を同梱しないため`npm ci`が毎回レジストリの最新`semver`を解決し、lockfileと不一致になる問題（2026-11に`semver@7.8.6`公開で発生）を防ぐためにlockfileと同じ`semver`へ固定している。依存を更新してlockfileの`semver`が変わった場合は、この固定値も合わせて更新する。
ビルドでは`.nvmrc`と`amplify.yml`によりNode.js 22.18.0、npm 10.8.2を固定し、同じツールチェーンで生成・検証したlockfileを`npm ci`で使用する。`.npmrc`の`engine-strict`と`npm run verify:toolchain`により、異なるNode.js/npmでの依存更新を早期に拒否する。

## 3. ローカル検証

```bash
nvm install
nvm use
npm install --global npm@10.8.2
npm run verify:toolchain
npm ci
npm run package:agent
npm run check
```

Agent単体の検証:

```bash
python3 -m venv agent/.venv
agent/.venv/bin/python -m pip install uv==0.12.5
agent/.venv/bin/uv pip install --python agent/.venv/bin/python --editable 'agent[dev]'
agent/.venv/bin/ruff check agent
agent/.venv/bin/mypy --config-file agent/pyproject.toml agent
(cd agent && .venv/bin/pytest -q)
```

## 4. トレーニングユーザーの作成

バックエンドの初回デプロイ後に、共有受講者ユーザーと管理者ユーザーを作成する。Cognito構成上、ログインIDにはメールアドレス形式の文字列を使用する。

```bash
export DEPLOY_ACCOUNT_ID='<target-account-id>'
export STUDENT_USERNAME='<training-user-id>'
export ADMIN_USERNAME='<training-admin-id>'
export AWS_REGION='ap-northeast-1'
./scripts/provision-training-users.sh
unset DEPLOY_ACCOUNT_ID STUDENT_USERNAME ADMIN_USERNAME
```

スクリプトのプロンプトで受講者・管理者に共通のパスワードを2回入力する。パスワードをファイルやシェル履歴へ書き込まない。画面共有、講義資料への記録にも注意する。自動実行する場合だけ、`TRAINING_PASSWORD` 環境変数で共通パスワードを渡せる。

## 5. デプロイ後確認

受講者利用停止のバックエンドスモークテストは、対象アカウントを明示して実行する。

```bash
export DEPLOY_ACCOUNT_ID='<target-account-id>'
export AWS_REGION='ap-northeast-1'
npm run smoke:participant-access
unset DEPLOY_ACCOUNT_ID AWS_REGION
```

このテストは現在の受講者利用設定を記録し、一時的に利用停止へ変更して、一般受講者のチャットが`PARTICIPANT_ACCESS_DISABLED`で拒否されることを確認する。成功・失敗にかかわらず、終了時にはテスト開始前の利用設定へ復元する。ストリーミングLambdaを通常のLambda Invokeで直接呼び出すため、出力ファイルにはHTTPレスポンス外形ではなくレスポンス本文だけが格納される。したがって、このテストはLambda実行成功と安定した拒否コードを検証し、ブラウザに返るHTTP 403は次の画面確認で検証する。

1. `/health` が `200` を返す。
2. 受講者ユーザーと管理者ユーザーがログインできる。
3. 一般受講者に管理ボタンが表示されず、管理APIの直接呼び出しも `403` になる。
4. Claude Sonnet 5.5、Nova 2 Lite、Nova Micro、Nova Proで応答できる。
5. `AI Thinking...` の後に応答が逐次表示され、見出し、箇条書き、表、リンク、コードブロックなどのMarkdownが描画される。
6. 同一会話では文脈を保持し、クリア後は以前の文脈を参照しない。
7. 2つのブラウザセッションで同じ共有IDを使っても会話が混ざらない。
8. 初期状態のGuardrailが「なし」で、旅行トピックが日本語の旅行質問を拒否し、英単語 `pineapple` 禁止が `Tell me about pineapple.` を拒否する。
9. 管理者必須Guardrailを設定すると、受講者側が「なし」でも解除されない。
10. PII匿名化の確認には架空のメールアドレスまたは電話番号だけを使用する。
11. CloudWatch Logsで会話監査ログを確認でき、AuthorizationヘッダーやJWTが含まれない。
12. 対象ロググループの保持期間が7日、KMS暗号化が有効である。
13. AI応答末尾の閉じた「利用量・モデル推論料金（概算）」を展開し、Input / Outputトークン数、円換算額、モデル単価、換算レートが表示される。
14. 管理者がUSD/JPY換算レートを変更すると、以後の応答の概算料金へ反映される。表示額が基盤モデル推論だけの概算であることも確認する。
15. 利用者設定で社内規定RAGをオンにし、「国内出張の宿泊費上限は？」と質問すると、架空社内規定に基づく回答とRAG参照元が表示される。
16. RAGをオフにして同じ質問を行い、架空規定の固有金額を根拠なく再現しないことを確認する。
17. Web検索をオンにして最新情報を尋ねると、必要な場合だけWeb検索が実行され、回答末尾の「参照元」にタイトルとリンクが表示される。
18. 受講者側ですべてのツールをオフにすると実行回数が0になり、別タブで同じ共有IDへログインしてもツール選択が引き継がれない。
19. 管理者がツールを無効化すると、受講者設定から非表示となり、古いブラウザ設定やAPI直接指定でも実行されない。
20. 製品情報RAGだけをオンにし、「AP-500のE17は？」と質問すると送風ファン回転異常の回答と製品資料の参照元が表示される。
21. 製品情報RAGで「E17が出た」とだけ質問すると、AP-500とSWD-900で意味が異なるため型番の確認を求める。
22. 製品情報RAGをオフにして同じ製品質問を行い、架空製品の固有情報を根拠なく再現しないことを確認する。

## 6. トレーニング終了後の削除

共有受講者ユーザーと管理者ユーザーだけを削除し、アプリ環境を次回も使用する場合:

```bash
export DEPLOY_ACCOUNT_ID='<target-account-id>'
export STUDENT_USERNAME='<training-user-id>'
export ADMIN_USERNAME='<training-admin-id>'
export AWS_REGION='ap-northeast-1'
./scripts/delete-training-users.sh
unset DEPLOY_ACCOUNT_ID STUDENT_USERNAME ADMIN_USERNAME
```

スクリプトがアカウント、リージョン、User Pool、削除対象の2ユーザーを表示する。内容を確認し、確認文字列を入力して削除する。対象ユーザーがすでに存在しない場合は正常にスキップする。

アプリ環境そのものも削除する場合は、削除前にAmplify App ID、対象アカウント、東京リージョンであることを再確認する。

```bash
export DEPLOY_ACCOUNT_ID='<target-account-id>'
export AWS_APP_ID='<amplify-app-id>'
export AWS_REGION='ap-northeast-1'
export CONFIRM_DESTROY='delete-generative-ai-chat'
./scripts/destroy.sh
```

削除後はCloudFormation、AgentCore Runtime/Memory、東京リージョンのWeb Search Gateway（旧構成の場合は米国東部も）、Bedrock Knowledge Base、S3/S3 Vectors、Cognito、API Gateway、Lambda、DynamoDB、CloudWatch Logs、KMSにアプリ固有リソースが残っていないことを確認する。共有のCDK bootstrapリソースは削除しない。
