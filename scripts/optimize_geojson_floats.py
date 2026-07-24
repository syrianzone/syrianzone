import json
import sys
import os

def round_coords(obj, precision=5):
    if isinstance(obj, float):
        return round(obj, precision)
    elif isinstance(obj, list):
        return [round_coords(item, precision) for item in obj]
    elif isinstance(obj, dict):
        return {k: round_coords(v, precision) for k, v in obj.items()}
    return obj

def optimize_file(src_path, dst_path, precision=5):
    if not os.path.exists(src_path):
        print(f"File not found: {src_path}")
        return

    src_size = os.path.getsize(src_path)
    with open(src_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    opt_data = round_coords(data, precision)

    with open(dst_path, 'w', encoding='utf-8') as f:
        json.dump(opt_data, f, separators=(',', ':'), ensure_ascii=False)

    dst_size = os.path.getsize(dst_path)
    reduction = ((src_size - dst_size) / src_size) * 100
    print(f"Optimized {os.path.basename(src_path)}: {src_size / 1024 / 1024:.2f}MB -> {dst_size / 1024 / 1024:.2f}MB ({reduction:.1f}% reduction)")

if __name__ == '__main__':
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'population'))
    
    files = [
        ('syria_provinces.geojson', 'syria_provinces_opt.geojson'),
        ('syr_admin1.geojson', 'syr_admin1_opt.geojson'),
    ]

    for src, dst in files:
        optimize_file(os.path.join(base_dir, src), os.path.join(base_dir, dst))
