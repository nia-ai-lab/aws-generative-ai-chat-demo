from rag import _title_from_uri


def test_policy_title_is_derived_from_source_uri_for_mid_document_chunk() -> None:
    title = _title_from_uri(
        "s3://training/policies/07-business-travel.md",
        0,
        "宿泊費上限は東京23区・大阪市が1泊15,000円です。",
    )

    assert title == "国内・海外出張規程"


def test_heading_is_used_for_an_unknown_document() -> None:
    assert _title_from_uri("s3://training/policies/custom.md", 0, "# 独自規程\n本文") == "独自規程"
