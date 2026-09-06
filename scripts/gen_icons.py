import struct
import zlib
import os

VIOLET = (101, 88, 211, 255)
WHITE = (255, 255, 255, 255)


def draw_L(width, height, bg, fg):
    """Solid bg square with a simple white 'L' mark roughly centered."""
    pixels = bytearray(bg * (width * height))

    def set_px(x, y, color):
        if 0 <= x < width and 0 <= y < height:
            i = (y * width + x) * 4
            pixels[i:i + 4] = bytes(color)

    bar_w = max(2, width // 8)
    top = height // 4
    bottom = height - height // 4
    left = width // 3

    for y in range(top, bottom):
        for x in range(left, left + bar_w):
            set_px(x, y, fg)
    for x in range(left, left + width // 3):
        for y in range(bottom - bar_w, bottom):
            set_px(x, y, fg)

    return bytes(pixels)


def write_png(path, width, height, pixel_bytes):
    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data +
                struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    raw = bytearray()
    stride = width * 4
    for row in range(height):
        raw.append(0)  # filter type: none
        raw.extend(pixel_bytes[row * stride:(row + 1) * stride])
    idat = zlib.compress(bytes(raw), 9)
    png = sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


icons_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(icons_dir, exist_ok=True)

sizes = {
    'icon-192.png': 192,
    'icon-512.png': 512,
    'maskable-512.png': 512,
    'apple-touch-icon-180.png': 180,
}

for name, size in sizes.items():
    px = draw_L(size, size, VIOLET, WHITE)
    write_png(os.path.join(icons_dir, name), size, size, px)
    print('wrote icons/' + name)

favicon_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'favicon.png')
write_png(favicon_path, 32, 32, draw_L(32, 32, VIOLET, WHITE))
print('wrote favicon.png')
