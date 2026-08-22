# Web検索・RAG デモガイド

このガイドは、受講者が同じチャットアプリで「モデル単体」「ツールを使うAgent」「RAG」の違いを比較するための手順である。RAG文書はすべて架空企業「蒼空フロンティア株式会社」の架空規定である。

## 1. RAGの比較

1. 設定を開き、Web検索とRAGをオフにする。
2. 次のプロンプトを送信する。

```text
蒼空フロンティア株式会社では、国内出張の宿泊費上限はいくらですか？東京23区とその他地域を分けて答えてください。
```

3. 根拠がない、または一般論になることを確認する。
4. 設定で「RAG（社内規定検索）」をオンにし、同じプロンプトを送信する。
5. 東京23区は15,000円、その他地域は12,000円という固有値と、閉じた「参照元」を確認する。

追加プロンプト:

```text
生成AIへ入力してはいけない情報と、AIで作った本番プログラムを公開する前の確認手順を教えてください。
```

```text
リモートワークは週に何日までですか？海外から働ける例外も教えてください。
```

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
蒼空フロンティア株式会社の生成AI利用規程を要約し、Amazon Bedrock Guardrailsの現在の公式機能と組み合わせる案を提案してください。社内規程とWeb情報の出典を分けて示してください。
```

RAGは社内規定を毎回検索し、Web検索はモデルが必要と判断した場合だけ実行される。参照元欄で、書籍アイコンの社内規定と地球アイコンのWebページが分離されることを確認する。

## 4. セッション分離と管理者デフォルト

1. 同じ受講者IDで2つのブラウザタブへログインする。
2. 一方だけWeb検索をオンにし、もう一方は設定がオフのままであることを確認する。
3. 管理者の「ツール設定」でWeb検索をデフォルトオンにする。
4. 各受講者が設定画面を開き、Web検索がオンになったことを確認する。以前にツール選択を変更したセッションにも、管理者の変更が一度反映される。
5. 反映後、受講者がWeb検索とRAGを自由にオン・オフでき、その選択が同じブラウザセッションで維持されることを確認する。
6. デモ後は管理者のツール設定を両方オフに戻す。

## 5. 注意

- Web検索の問い合わせは200文字以内、1回答につき最大2回、各5件までである。
- Web検索結果のリンクと引用は削除せず受講者に表示する。
- RAG文書は教材用の架空情報であり、実際の就業規則として利用しない。
- Web検索料金は検索1回あたりのAgentCore Web SearchとGateway呼び出しを概算表示する。RAG表示額にはS3 Vectors、埋め込み、Knowledge Bases等の全AWS料金は含めない。

## 6. AWS公式資料

- [AgentCore Web Search Tool](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-web-search-tool.html)
- [AgentCore GatewayのWeb Search target設定](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-add-target-api-target-config.html#gateway-add-target-api-target-config-web-search)
- [Bedrock Knowledge BasesでS3 Vectorsを使用する](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-bedrock-kb.html)
- [Bedrock Knowledge BasesのRetrieve API](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-retrieve.html)
- [AgentCore料金](https://aws.amazon.com/bedrock/agentcore/pricing/)
