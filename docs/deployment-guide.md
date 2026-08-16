# デプロイ・運用ガイド

## 1. 前提

- AWS CLI v2 と `aws login` が利用できること
- Node.js 22.13以上22系、npm 10.8.2、Python 3.12、zip、GitHub CLI が利用できること
- デプロイ先は `ap-northeast-1` であること
- GitHub リポジトリを Amplify Hosting に接続できる権限があること
- AgentCore、Bedrock、Cognito、API Gateway、Lambda、DynamoDB、KMS、CloudWatch、IAM を作成できるデプロイロールがあること

実AWSアカウントID、パスワード、トークンはリポジトリや `.env` に保存しない。

## 2. Amplify Hostingの接続

1. Amplifyコンソールを東京リージョンで開き、「新しいアプリ」を作成する。
2. GitHubの公開リポジトリ `nia-ai-lab/aws-generative-ai-chat-demo` と `main` ブランチを接続する。
3. ビルドイメージでNode.js 22とPython 3.12を利用する。
4. Amplifyの環境変数に、リポジトリ外で管理する次の値を登録する。

| 変数 | 値 |
|---|---|
| `DEPLOY_ACCOUNT_ID` | 対象AWSアカウントID |

`AWS_REGION` はAmplifyのビルド環境から自動供給される。Amplifyアプリ自体を必ず東京リージョンに作成する。

`amplify.yml` がAgentのARM64 ZIP作成、検査、Amplify Gen 2バックエンド、SPAの順にデプロイする。生成される `amplify_outputs.json` はコミットしない。
ビルドではNode.js 22系とnpm 10.8.2を明示し、同じツールチェーンで検証したlockfileを`npm ci`で使用する。

## 3. ローカル検証

```bash
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
agent/.venv/bin/mypy --config-file agent/pyproject.toml agent/main.py agent/graph.py agent/prompts.py agent/schemas.py
(cd agent && .venv/bin/pytest -q)
```

## 4. トレーニングユーザーの作成

バックエンドの初回デプロイ後に、共有受講者ユーザーと管理者ユーザーを作成する。Cognito構成上、ログインIDにはメールアドレス形式の文字列を使用する。

```bash
export STUDENT_USERNAME='<training-user-id>'
export STUDENT_PASSWORD='<temporary-environment-password>'
export ADMIN_USERNAME='<training-admin-id>'
export ADMIN_PASSWORD='<temporary-environment-password>'
export AWS_REGION='ap-northeast-1'
./scripts/provision-training-users.sh
unset STUDENT_USERNAME STUDENT_PASSWORD ADMIN_USERNAME ADMIN_PASSWORD
```

スクリプトはパスワードをファイルへ書き込まない。シェル履歴、画面共有、講義資料への記録にも注意する。

## 5. デプロイ後確認

1. `/health` が `200` を返す。
2. 受講者ユーザーと管理者ユーザーがログインできる。
3. 一般受講者に管理ボタンが表示されず、管理APIの直接呼び出しも `403` になる。
4. Claude Sonnet 5、Nova 2 Lite、Nova Proで応答できる。
5. `AI Thinking...` の後に応答が逐次表示され、見出し、箇条書き、表、リンク、コードブロックなどのMarkdownが描画される。
6. 同一会話では文脈を保持し、クリア後は以前の文脈を参照しない。
7. 2つのブラウザセッションで同じ共有IDを使っても会話が混ざらない。
8. CloudWatch Logsで会話監査ログを確認でき、AuthorizationヘッダーやJWTが含まれない。
9. 対象ロググループの保持期間が7日、KMS暗号化が有効である。

## 6. トレーニング終了後の削除

削除前にAmplify App ID、対象アカウント、東京リージョンであることを再確認する。

```bash
export DEPLOY_ACCOUNT_ID='<target-account-id>'
export AWS_APP_ID='<amplify-app-id>'
export AWS_REGION='ap-northeast-1'
export CONFIRM_DESTROY='delete-generative-ai-chat'
./scripts/destroy.sh
```

削除後はCloudFormation、AgentCore Runtime/Memory、Cognito、API Gateway、Lambda、DynamoDB、CloudWatch Logs、KMSにアプリ固有リソースが残っていないことを確認する。共有のCDK bootstrapリソースは削除しない。
