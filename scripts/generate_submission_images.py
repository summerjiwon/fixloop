from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "submission-assets"
PHOTO = ROOT / "frontend" / "public" / "demo-assets" / "sample-leaking-faucet.png"
MARK = ROOT / "frontend" / "public" / "brand-mark.png"
FONT = Path("C:/Windows/Fonts/malgun.ttf")
BOLD = Path("C:/Windows/Fonts/malgunbd.ttf")
W, H = 1920, 1080
BG, INK, MUTED, BRAND, PALE = "#F3F8F8", "#152525", "#607575", "#197A73", "#DDF2EF"


def f(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(BOLD if bold else FONT), size)


def base(kicker: str, title: str, subtitle: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    canvas = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, W, 18), fill=BRAND)
    mark = Image.open(MARK).convert("RGBA")
    mark.thumbnail((62, 62))
    canvas.paste(mark, (100, 60), mark)
    draw.text((180, 86), kicker, font=f(28, True), fill=BRAND)
    draw.text((100, 145), title, font=f(60, True), fill=INK)
    draw.multiline_text((100, 235), subtitle, font=f(28), fill=MUTED, spacing=10)
    draw.text((100, 1000), "공간기록  |  QR 신고 · AI 분류 · 조치 검증", font=f(24, True), fill=BRAND)
    return canvas, draw


def card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: str = "#FFFFFF") -> None:
    draw.rounded_rectangle(box, radius=30, fill=fill)


def cover() -> Image.Image:
    image, draw = base("공간기록", "사진으로 시작해, 원격으로 끝내는 운영.", "현장 사진 한 장을 AI가 운영 가능한 이슈로 구조화합니다.")
    photo = Image.open(PHOTO).convert("RGB")
    photo = ImageOps.fit(photo, (660, 600))
    image.paste(photo, (1120, 240))
    for x, text in [(100, "QR로 즉시 신고"), (415, "Gemini Vision 분류"), (800, "사진 기반 조치 검증")]:
        card(draw, (x, 520, x + 280, 610), PALE)
        draw.text((x + 24, 550), text, font=f(21, True), fill=BRAND)
    card(draw, (100, 680, 1020, 850))
    draw.text((140, 725), "누수 · 파손 · 안전 이슈를", font=f(28), fill=MUTED)
    draw.text((140, 775), "위치 · 설비 · 유형 · 심각도로 정리", font=f(36, True), fill=INK)
    return image


def report() -> Image.Image:
    image, draw = base("PUBLIC REPORT", "로그인 없이 사진 한 장으로 신고", "신고자는 AI 결과를 기다리지 않고 접수를 시작할 수 있습니다.")
    card(draw, (170, 390, 790, 870))
    draw.text((220, 440), "현장 사진 신고", font=f(24, True), fill=BRAND)
    draw.text((220, 500), "문제가 보이도록\n사진을 올려주세요", font=f(38, True), fill=INK, spacing=12)
    draw.rounded_rectangle((220, 650, 740, 750), radius=18, fill=BRAND)
    draw.text((300, 680), "사진만으로 신고 등록", font=f(26, True), fill="#FFFFFF")
    card(draw, (890, 470, 1690, 790), "#FFFFFF")
    draw.text((950, 535), "✓  신고가 접수됐습니다", font=f(38, True), fill=INK)
    draw.text((950, 610), "사진은 안전하게 저장됐고\nAI가 분석 중입니다.", font=f(27), fill=MUTED, spacing=12)
    draw.rounded_rectangle((950, 700, 1580, 750), radius=18, fill=PALE)
    draw.text((980, 712), "ANALYZING · AI 분석 중", font=f(22, True), fill=BRAND)
    return image


def tracking() -> Image.Image:
    image, draw = base("REPORT TRACKING", "접수 번호로 AI 분석 결과 확인", "사진·설명·운영자 코멘트는 보호하고 처리 상태만 보여줍니다.")
    card(draw, (360, 390, 1560, 870))
    draw.text((440, 465), "OPEN", font=f(25, True), fill=BRAND)
    draw.text((440, 525), "운영팀 확인 대기", font=f(48, True), fill=INK)
    rows = [("위치", "사무실 탕비실"), ("AI 분류", "배관 · 누수"), ("설비", "싱크대 배수관"), ("심각도", "긴급"), ("AI 신뢰도", "98%")]
    for index, (label, value) in enumerate(rows):
        y = 640 + index % 2 * 85
        x = 440 + (index // 2) * 430
        draw.text((x, y), label, font=f(22), fill=MUTED)
        draw.text((x + 150, y), value, font=f(24, True), fill=INK)
    return image


def operations() -> Image.Image:
    image, draw = base("OPERATIONS LOOP", "AI는 분류를 돕고, 사람은 최종 판단합니다.", "현장 신고부터 조치·검증·종결까지 하나의 흐름으로 관리합니다.")
    steps = [("01", "사진 신고", "QR 링크에서\n사진 한 장 등록"), ("02", "AI 구조화", "위치 · 설비 · 유형 ·\n심각도 자동 분류"), ("03", "조치 · 검증", "사진 증빙 확인 후\n운영자가 최종 종결")]
    for i, (number, title, detail) in enumerate(steps):
        x = 150 + i * 560
        card(draw, (x, 430, x + 460, 790))
        draw.text((x + 44, 480), number, font=f(24, True), fill=BRAND)
        draw.text((x + 44, 550), title, font=f(38, True), fill=INK)
        draw.multiline_text((x + 44, 630), detail, font=f(25), fill=MUTED, spacing=10)
        if i < 2:
            draw.text((x + 482, 590), "→", font=f(48, True), fill=BRAND)
    return image


OUT.mkdir(exist_ok=True)
for name, generator in [("01-cover.png", cover), ("02-photo-report.png", report), ("03-report-tracking.png", tracking), ("04-operations-loop.png", operations)]:
    generator().save(OUT / name, optimize=True)
    print(OUT / name)
