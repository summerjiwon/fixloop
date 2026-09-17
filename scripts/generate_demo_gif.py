from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "demo-assets" / "gonggan-girok-flow.gif"
PHOTO = ROOT / "frontend" / "public" / "demo-assets" / "sample-leaking-faucet.png"
FONT = Path("C:/Windows/Fonts/malgun.ttf")
BOLD_FONT = Path("C:/Windows/Fonts/malgunbd.ttf")
SIZE = (1080, 1350)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(BOLD_FONT if bold else FONT), size)


def rounded_card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: str) -> None:
    draw.rounded_rectangle(box, radius=34, fill=fill)


def frame(step: str, heading: str, detail: str, card_lines: list[tuple[str, str]]) -> Image.Image:
    image = Image.new("RGB", SIZE, "#f4f8f8")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 1080, 20), fill="#16736d")
    draw.text((72, 72), "공간기록", font=font(32, True), fill="#16736d")
    draw.text((72, 122), step, font=font(24, True), fill="#4d8a85")
    draw.text((72, 175), heading, font=font(54, True), fill="#172424")
    draw.multiline_text((72, 252), detail, font=font(28), fill="#536565", spacing=12)

    photo = Image.open(PHOTO).convert("RGB")
    photo.thumbnail((936, 500))
    x = (1080 - photo.width) // 2
    y = 390
    image.paste(photo, (x, y))

    card_top = 940
    rounded_card(draw, (72, card_top, 1008, 1230), "#ffffff")
    for index, (label, value) in enumerate(card_lines):
        y = card_top + 42 + index * 72
        draw.text((112, y), label, font=font(23), fill="#667979")
        draw.text((420, y), value, font=font(25, True), fill="#172424")
    draw.text((72, 1270), "공간기록  |  사진 신고 → AI 분류 → 조치·검증", font=font(24, True), fill="#16736d")
    return image


frames = [
    frame(
        "01 · 현장 신고",
        "QR로 사진 한 장 신고",
        "앱 설치나 로그인 없이\n현장에서 바로 접수합니다.",
        [("입력", "사진 1장 · 설명은 선택"), ("접근", "QR 링크로 즉시 시작")],
    ),
    frame(
        "02 · 즉시 접수",
        "사용자는 기다리지 않습니다",
        "사진 저장 후 AI 분석은\n백그라운드에서 이어집니다.",
        [("접수 상태", "ANALYZING · AI 분석 중"), ("사용자 안내", "신고 접수를 시작했습니다")],
    ),
    frame(
        "03 · 운영 판단",
        "AI가 이슈를 구조화합니다",
        "운영팀은 우선순위를 확인하고\n사진 증빙으로 조치를 검증합니다.",
        [("AI 분류", "배관·누수 · 싱크대 배수관"), ("심각도", "긴급 · 신뢰도 98%")],
    ),
]

OUT.parent.mkdir(parents=True, exist_ok=True)
frames[0].save(OUT, save_all=True, append_images=frames[1:], duration=[2400, 2400, 3000], loop=0, optimize=True)
print(OUT)
