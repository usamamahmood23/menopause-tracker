"""Generate placeholder EaseTrack icons (cream circle, sage leaf)."""
from PIL import Image, ImageDraw

CREAM = (250, 246, 242, 255)
SAGE = (168, 184, 158, 255)
ROSE = (212, 165, 165, 255)


def make_icon(size: int, path: str) -> None:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Cream filled circle (the "tile")
    pad = size // 16
    draw.ellipse((pad, pad, size - pad, size - pad), fill=CREAM, outline=ROSE, width=max(2, size // 80))

    # Sage leaf shape — two overlapping ellipses rotated for an organic feel.
    cx, cy = size // 2, size // 2
    leaf_w = int(size * 0.55)
    leaf_h = int(size * 0.30)

    leaf = Image.new("RGBA", (leaf_w, leaf_h), (0, 0, 0, 0))
    ldraw = ImageDraw.Draw(leaf)
    ldraw.ellipse((0, 0, leaf_w, leaf_h), fill=SAGE)

    rotated = leaf.rotate(-30, resample=Image.BICUBIC, expand=True)
    img.paste(rotated, (cx - rotated.width // 2, cy - rotated.height // 2), rotated)

    rotated2 = leaf.rotate(30, resample=Image.BICUBIC, expand=True)
    smaller = rotated2.resize((int(rotated2.width * 0.75), int(rotated2.height * 0.75)), Image.BICUBIC)
    img.paste(smaller, (cx - smaller.width // 2, cy - smaller.height // 2 + size // 12), smaller)

    # Small stem line
    stem_w = max(2, size // 60)
    draw.line(
        [(cx - size // 4, cy + size // 6), (cx + size // 3, cy - size // 6)],
        fill=(135, 152, 124, 255),
        width=stem_w,
    )

    img.save(path, "PNG")


if __name__ == "__main__":
    make_icon(192, "icons/icon-192.png")
    make_icon(512, "icons/icon-512.png")
    print("Created icons/icon-192.png and icons/icon-512.png")
