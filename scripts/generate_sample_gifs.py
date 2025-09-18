import os
import base64
import struct

BASE_DIR = os.path.dirname(__file__)
OUTPUT_DIR = os.path.join(BASE_DIR, '..', 'generated-gifs')
DATA_FILE = os.path.join(BASE_DIR, '..', 'assets', 'js', 'popularSources.js')
os.makedirs(OUTPUT_DIR, exist_ok=True)


def pack_header(width, height, gct_size_bits, background_index=0):
    gct_flag = 0x80
    color_resolution = (gct_size_bits - 1) << 4
    sort_flag = 0
    size_value = int(gct_size_bits - 1)
    packed = gct_flag | color_resolution | sort_flag | size_value
    return struct.pack('<6sHHBBB', b'GIF89a', width, height, packed, background_index, 0)


def write_color_table(colors):
    return b''.join(struct.pack('BBB', *c) for c in colors)


def lzw_encode(indices, min_code_size):
    clear_code = 1 << min_code_size
    end_code = clear_code + 1
    dictionary = {tuple([i]): i for i in range(clear_code)}
    dict_size = end_code + 1
    code_size = min_code_size + 1

    bitstream = []
    current = 0
    bits_in_current = 0

    def write_code(code):
        nonlocal current, bits_in_current, code_size, dict_size
        mask = (1 << code_size) - 1
        current |= (code & mask) << bits_in_current
        bits_in_current += code_size
        while bits_in_current >= 8:
            bitstream.append(current & 0xFF)
            current >>= 8
            bits_in_current -= 8

    write_code(clear_code)
    w = (indices[0],)
    for k in indices[1:]:
        wk = w + (k,)
        if wk in dictionary:
            w = wk
        else:
            write_code(dictionary[w])
            dictionary[wk] = dict_size
            dict_size += 1
            if dict_size == (1 << code_size) and code_size < 12:
                code_size += 1
            w = (k,)
    write_code(dictionary[w])
    write_code(end_code)
    if bits_in_current:
        bitstream.append(current & 0xFF)
    return bytes(bitstream)


def build_image_block(indices, min_code_size, width, height, delay=5, transparent_index=None):
    data_bytes = lzw_encode(indices, min_code_size)
    blocks = []
    remaining = data_bytes
    while remaining:
        chunk = remaining[:255]
        remaining = remaining[255:]
        blocks.append(bytes([len(chunk)]) + chunk)
    blocks.append(b'\x00')

    if transparent_index is None:
        packed_gce = 0
        trans_byte = 0
    else:
        packed_gce = 0x01
        trans_byte = transparent_index
    gce = b'\x21\xF9\x04' + bytes([packed_gce]) + struct.pack('<H', delay) + bytes([trans_byte]) + b'\x00'

    image_descriptor = b'\x2C' + struct.pack('<HHHHB', 0, 0, width, height, 0)
    image_data = bytes([min_code_size]) + b''.join(blocks)
    return gce + image_descriptor + image_data


def build_gif(filename, width, height, colors, frames, loop=True):
    size = len(colors)
    bits = 1
    while (1 << bits) < size:
        bits += 1
    header = pack_header(width, height, bits, 0)
    gct = write_color_table(colors)

    app_ext = b''
    if loop:
        app_ext = b'\x21\xFF\x0B' + b'NETSCAPE2.0' + b'\x03\x01' + struct.pack('<H', 0) + b'\x00'

    body = b''.join(frames)
    trailer = b'\x3B'

    output_path = os.path.join(OUTPUT_DIR, filename)
    with open(output_path, 'wb') as f:
        f.write(header)
        f.write(gct)
        f.write(app_ext)
        f.write(body)
        f.write(trailer)

    print(f'Generated {filename}')
    return output_path


PALETTE = [
    (0, 0, 0),
    (255, 0, 0),
    (0, 148, 255),
    (255, 255, 255),
    (255, 200, 0),
    (0, 255, 136),
    (163, 73, 164),
    (255, 105, 180),
]


def diagonal_frame(width, height, color_a, color_b):
    indices = []
    for y in range(height):
        for x in range(width):
            indices.append(color_a if (x + y) % 2 == 0 else color_b)
    return indices


def stripe_frame(width, height, colors):
    indices = []
    band = max(1, height // len(colors))
    for y in range(height):
        color = colors[min(len(colors) - 1, y // band)]
        for _ in range(width):
            indices.append(color)
    return indices


def gradient_frame(width, height):
    indices = []
    palette_indices = [5, 6, 7, 4, 3, 1]
    steps = len(palette_indices)
    band = max(1, height // steps)
    for y in range(height):
        idx = palette_indices[min(steps - 1, y // band)]
        for _ in range(width):
            indices.append(idx)
    return indices


WIDTH = HEIGHT = 64

rickroll_frames = [
    build_image_block(diagonal_frame(WIDTH, HEIGHT, 1, 2), 3, WIDTH, HEIGHT, delay=8),
    build_image_block(diagonal_frame(WIDTH, HEIGHT, 2, 1), 3, WIDTH, HEIGHT, delay=8),
]

nyan_frames = [
    build_image_block(stripe_frame(WIDTH, HEIGHT, [7, 4, 3, 1, 2, 5]), 3, WIDTH, HEIGHT, delay=6),
    build_image_block(stripe_frame(WIDTH, HEIGHT, [5, 2, 1, 3, 4, 7]), 3, WIDTH, HEIGHT, delay=6),
]

dancing_frames = [
    build_image_block(gradient_frame(WIDTH, HEIGHT), 3, WIDTH, HEIGHT, delay=10),
    build_image_block(diagonal_frame(WIDTH, HEIGHT, 5, 6), 3, WIDTH, HEIGHT, delay=10),
    build_image_block(diagonal_frame(WIDTH, HEIGHT, 6, 5), 3, WIDTH, HEIGHT, delay=10),
]

generated_files = {
    'rickroll': build_gif('rickroll-loop.gif', WIDTH, HEIGHT, PALETTE, rickroll_frames),
    'nyan-cat': build_gif('nyan-cat-trail.gif', WIDTH, HEIGHT, PALETTE, nyan_frames),
    'dancing-baby': build_gif('dancing-baby-wave.gif', WIDTH, HEIGHT, PALETTE, dancing_frames),
}

with open(DATA_FILE, 'w', encoding='utf-8') as data_file:
    data_file.write('export const POPULAR_GIF_SOURCES = {\n')
    for key, path in generated_files.items():
        with open(path, 'rb') as gif_file:
            b64 = base64.b64encode(gif_file.read()).decode('ascii')
        data_uri = f"data:image/gif;base64,{b64}"
        data_file.write(f"  '{key}': '{data_uri}',\n")
    data_file.write('};\n\n')
    data_file.write('if (typeof window !== \"undefined\") {\n')
    data_file.write('  window.POPULAR_GIF_SOURCES = POPULAR_GIF_SOURCES;\n')
    data_file.write('}\n')

print(f'Finished! GIFs saved to {OUTPUT_DIR}/ and data written to {DATA_FILE}')
