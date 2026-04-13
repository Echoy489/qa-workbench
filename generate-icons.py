"""Generate simple PNG icons for the QA Workbench extension."""
import struct, zlib, os

def png(size, r=37, g=99, b=235):
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    rows = []
    for y in range(size):
        row = b'\x00'
        for x in range(size):
            m = max(1, size // 5)
            corner = (x < m and y < m) or (x >= size-m and y < m) or \
                     (x < m and y >= size-m) or (x >= size-m and y >= size-m)
            row += b'\xff\xff\xff' if corner else bytes([r, g, b])
        rows.append(row)
    idat = chunk(b'IDAT', zlib.compress(b''.join(rows)))
    iend = chunk(b'IEND', b'')
    return b'\x89PNG\r\n\x1a\n' + ihdr + idat + iend

os.makedirs('public/icons', exist_ok=True)
for s in [16, 32, 48, 128]:
    with open(f'public/icons/icon{s}.png', 'wb') as f:
        f.write(png(s))
    print(f'  icon{s}.png created')
print('Icons done.')
