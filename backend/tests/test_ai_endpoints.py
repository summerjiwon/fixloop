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
