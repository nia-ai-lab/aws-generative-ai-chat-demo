# Web検索・RAG デモガイド

このガイドは、受講者が同じチャットアプリで「モデル単体」「ツールを使うAgent」「RAG」の違いを比較するための手順である。社内規定RAG文書はすべて、教材で一貫して扱う架空企業「AnyCompany」の架空規程である（[文書一覧](../knowledge-base/README.md)）。人事ツールを使うエージェントのデモは[モジュール別デモ実施ガイド](./module-demo-guide.md)のM0・M6・M8で扱う。架空家電の製品情報RAGは[顧客サポートで学ぶ責任あるAIデモガイド](./customer-support-responsible-ai-demo-guide.md)で扱う。

## 1. RAGの比較

1. 設定を開き、Web検索とRAGをオフにする。
2. 次のプロンプトを送信する。

```text
結婚したときの特別休暇は何日？
```

3. 「会社によって異なります」などの一般論になることを確認する。
4. 設定で「RAG（社内規定検索）」をオンにし、同じプロンプトを送信する。
5. 就業規則第12条の「連続5営業日」という固有値と、閉じた「参照元」に就業規則が表示されることを確認する。

追加プロンプト:

```text
AnyCompany では、国内出張の宿泊費上限はいくらですか？東京23区とその他地域を分けて答えてください。
```

```text
育休は何日取れる？
```

```text
在宅勤務は週に何日までですか？海外から働ける例外も教えてください。
```

```text
在宅勤務手当はいくらですか？
```

最後の質問は、規程に手当の記載がないため「規程では確認できない」と答え、人事部の窓口を案内するのが期待動作である。もっともらしい金額を答えた場合は、根拠のない回答（ハルシネーション）の例として扱う。

```text
経費の領収書が必要になる金額、顧客会食の目安、事前承認が必要になる総額を表にしてください。
```

## 2. Web検索ツール

1. RAGをオフ、Web検索をオンにする。
2. モデルの学習時点以後に変化し得る質問を送信する。

```text
今日時点のAmazon Bedrock AgentCore Web Searchの提供リージョンと、公式情報のURLを調べてください。
```

3. `AI Thinking...`の後に応答がストリーミングされることを確認する。
4. 「参照元」を展開し、検索結果のタイトルとリンクを確認する。
5. 「利用量・モデル推論料金（概算）」を展開し、モデルの複数呼び出し分を合算したトークン数、Web検索回数と概算料金を確認する。

Web検索が不要な例:

```text
1から10までの合計を計算してください。
```

Web検索をオンにしていても、モデルが検索不要と判断すれば検索回数が0になることを確認する。

## 3. RAGとWeb検索の使い分け

両方をオンにして次を送信する。

```text
AnyCompany の生成AI利用規程を要約し、Amazon Bedrock Guardrailsの現在の公式機能と組み合わせる案を提案してください。社内規程とWeb情報の出典を分けて示してください。
```

RAGは社内規定を毎回検索し、Web検索はモデルが必要と判断した場合だけ実行される。参照元欄で、書籍アイコンの社内規定と地球アイコンのWebページが分離されることを確認する。

## 4. セッション分離と管理者制御

1. 同じ受講者IDで2つのブラウザタブへログインする。
2. 一方だけWeb検索をオンにし、もう一方は設定がオフのままであることを確認する。
3. 管理者が「利用可能なツール」からWeb検索をオフにする。
4. 受講者画面を再読み込みし、Web検索が表示されず、古いセッション設定が残っていても実行されないことを確認する。
5. デモ後は管理者設定を元に戻す。

## 5. 注意

- Web検索の問い合わせは200文字以内、1回答につき最大2回、各5件までである。
- Web検索結果のリンクと引用は削除せず受講者に表示する。
- RAG文書は教材用の架空情報であり、実際の就業規則として利用しない。
- 製品情報RAGは社内規定とは別のKnowledge Baseであり、顧客サポートデモでは社内規定RAGをオフにする。
- Web検索料金は検索1回あたりのAgentCore Web SearchとGateway呼び出しを概算表示する。RAG表示額にはS3 Vectors、埋め込み、Knowledge Bases等の全AWS料金は含めない。

## 6. AWS公式資料

- [AgentCore Web Search Tool](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-web-search-tool.html)
- [AgentCore GatewayのWeb Search target設定](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-add-target-api-target-config.html#gateway-add-target-api-target-config-web-search)
- [Bedrock Knowledge BasesでS3 Vectorsを使用する](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-bedrock-kb.html)
- [Bedrock Knowledge BasesのRetrieve API](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-retrieve.html)
- [AgentCore料金](https://aws.amazon.com/bedrock/agentcore/pricing/)
