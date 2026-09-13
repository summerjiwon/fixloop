from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_triage_returns_validated_structured_output() -> None:
    response = client.post(
        "/api/ai/triage",
        json={
            "before_image_url": "https://example.com/images/before.jpg",
            "location_context": "부평점 Zone B",
            "reporter_text": "의자 등받이가 흔들립니다.",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["severity"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    assert 0 <= payload["confidence"] <= 1


def test_verify_returns_limits_with_photo_based_result() -> None:
    response = client.post(
        "/api/ai/verify",
        json={
            "before_image_url": "https://example.com/images/before.jpg",
            "after_image_url": "https://example.com/images/after.jpg",
            "issue_context": "의자 등받이 연결부 이탈",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload["same_asset"], bool)
    assert isinstance(payload["visible_issue_resolved"], bool)
    assert payload["limitations"]


def test_triage_rejects_invalid_image_url() -> None:
    response = client.post(
        "/api/ai/triage",
        json={"before_image_url": "not-a-url", "location_context": "부평점 Zone B"},
    )

    assert response.status_code == 422


def test_report_to_resolution_flow_requires_explicit_verification_and_approval() -> None:
    analysis = client.post(
        "/api/reports/analyze",
        data={"location_id": "00000000-0000-0000-0000-000000000001", "reporter_text": "의자 파손"},
        files={"image": ("before.jpg", b"fake-before-image", "image/jpeg")},
    )
    assert analysis.status_code == 201

    issue = client.post(f"/api/reports/{analysis.json()['draft_id']}/confirm")
    assert issue.status_code == 201
    issue_id = issue.json()["id"]
    assert issue.json()["status"] == "OPEN"

    forbidden = client.patch(f"/api/issues/{issue_id}/status", json={"status": "RESOLVED"})
    assert forbidden.status_code == 409

    after = client.post(
        f"/api/issues/{issue_id}/after",
        files={"image": ("after.jpg", b"fake-after-image", "image/jpeg")},
    )
    assert after.status_code == 200
    assert after.json()["status"] == "VERIFYING"

    verified = client.post(f"/api/issues/{issue_id}/verify")
    assert verified.status_code == 200
    assert verified.json()["verification"] is not None

    resolved = client.post(f"/api/issues/{issue_id}/resolve")
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "RESOLVED"


def test_insights_use_api_aggregates() -> None:
    response = client.get("/api/insights")

    assert response.status_code == 200
    payload = response.json()
    assert payload["period_days"] == 30
    assert isinstance(payload["total_issues"], int)
    assert all(item["metric"] for item in payload["insights"])
