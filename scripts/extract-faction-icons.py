"""Extract the orange faction emblems from page 1 of the local team-rule PDFs.

Usage: python scripts/extract-faction-icons.py D:/work/Kill-Team-Companion/docs/rules/pdf
Requires pdftoppm and Pillow. The source PDFs are not bundled with this project.
"""

from pathlib import Path
import subprocess
import sys
import tempfile

from PIL import Image


SOURCES = {
    "angels_of_death": "eng_28-01_kill_team_team_rules_angels_of_death.pdf",
    "legionaries": "eng_17-12_kt_legionaries_online_rules.pdf",
    "plague_marines": "eng_29-04_kt_teamrules_plague_marines.pdf",
    "chaos_cult": "eng_17-12_kill_team_team_rules_chaos_cult-x4tsrknbaq-lc1rwd37iy.pdf",
    "warpcoven": "eng_29-04_kt_teamrules_warpcoven-dlvflmyfdc-tqfq81iy7v.pdf",
}
OUTPUT = Path(__file__).resolve().parents[1] / "public/assets/icons/factions"


def extract(source: Path, destination: Path) -> None:
    with tempfile.TemporaryDirectory() as directory:
        prefix = Path(directory) / "page"
        subprocess.run(
            ["pdftoppm", "-f", "1", "-l", "1", "-r", "300", "-png", "-singlefile", str(source), str(prefix)],
            check=True,
        )
        page = Image.open(prefix.with_suffix(".png")).convert("RGB")
        # The emblem is isolated at the upper left of every operative-card sheet.
        region = page.crop((30, 65, 430, 440))
        pixels = region.load()
        alpha = Image.new("L", region.size)
        mask = alpha.load()
        for y in range(region.height):
            for x in range(region.width):
                red, green, blue = pixels[x, y]
                # Neutral paper has almost no red/green difference; the printed
                # vermilion emblem does. Preserve anti-aliased edge coverage.
                mask[x, y] = max(0, min(255, round((red - green - 8) * 255 / 155))) if red > blue + 25 else 0
        bounds = alpha.point(lambda value: 255 if value > 80 else 0).getbbox()
        if bounds is None:
            raise RuntimeError(f"No emblem found in {source}")
        left, top, right, bottom = bounds
        box = (max(0, left - 6), max(0, top - 6), min(region.width, right + 6), min(region.height, bottom + 6))
        emblem = Image.new("RGBA", region.size, (241, 73, 28, 0))
        emblem.putalpha(alpha)
        emblem.crop(box).save(destination, optimize=True)
        print(f"{destination.name}: {right - left}x{bottom - top} emblem")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Pass the directory containing the five English team-rule PDFs")
    pdf_directory = Path(sys.argv[1])
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for faction, filename in SOURCES.items():
        extract(pdf_directory / filename, OUTPUT / f"{faction}.png")
