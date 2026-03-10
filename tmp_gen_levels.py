import re
import json
from pathlib import Path

root = Path('/Users/juho/Documents/Skate-Hustle-Game')


def extract_calls(text: str):
    lines = text.splitlines()
    calls = []
    collecting = False
    buf = []
    for line in lines:
        if not collecting:
            if re.match(r'^\s*this\.createPlatform\s*\(', line):
                collecting = True
                buf = [line]
                if '});' in line:
                    calls.append('\n'.join(buf))
                    collecting = False
                    buf = []
        else:
            buf.append(line)
            if '});' in line:
                calls.append('\n'.join(buf))
                collecting = False
                buf = []
    return calls


def js_obj_to_json_str(obj_literal: str):
    s = re.sub(r'//.*', '', obj_literal)
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    s = re.sub(r'([\{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:', r'\1"\2":', s)
    s = s.replace("'", '"')
    s = re.sub(r',\s*([}\]])', r'\1', s)
    return s


def eval_expr(expr: str, world_width: int, world_height: int):
    normalized = (
        expr.strip()
        .replace('this.worldWidth', str(world_width))
        .replace('this.worldHeight', str(world_height))
    )
    return eval(normalized, {'__builtins__': {}}, {})


def parse_platforms(file_path: Path, world_width: int, world_height: int):
    text = file_path.read_text(encoding='utf-8')
    out = []

    for call in extract_calls(text):
        match = re.search(
            r'this\.createPlatform\s*\(([^,]+),\s*([^,]+),\s*({[\s\S]*})\s*\)\s*;',
            call,
        )
        if not match:
            continue

        x = eval_expr(match.group(1), world_width, world_height)
        y = eval_expr(match.group(2), world_width, world_height)
        config_json = (
            js_obj_to_json_str(match.group(3))
            .replace('this.worldWidth', str(world_width))
            .replace('this.worldHeight', str(world_height))
        )
        config = json.loads(config_json)

        render_width = config['radius'] * 2 if config.get('type') == 'CIRCLE' else config['width']
        render_height = config['radius'] * 2 if config.get('type') == 'CIRCLE' else config['height']

        top_left_x = x - (render_width / 2)
        top_left_y = y - (render_height / 2)

        if int(top_left_x) == top_left_x:
            top_left_x = int(top_left_x)
        if int(top_left_y) == top_left_y:
            top_left_y = int(top_left_y)

        out.append({
            'x': top_left_x,
            'y': top_left_y,
            'config': config,
        })

    return out


hub_platforms = parse_platforms(root / 'js/HubScene.js', 6400, 1800)
silly_platforms = parse_platforms(root / 'js/SillySpeedRunScene.js', 1600, 6000)

(root / 'assets/levels/hubLevel.json').write_text(
    json.dumps(
        {
            'worldWidth': 6400,
            'worldHeight': 1800,
            'spawn': {'x': 200, 'y': 950},
            'portal1': {'x': 300, 'y': 1250},
            'platforms': hub_platforms,
        },
        indent=2,
    )
    + '\n',
    encoding='utf-8',
)

(root / 'assets/levels/sillySpeedRunLevel.json').write_text(
    json.dumps(
        {
            'worldWidth': 1600,
            'worldHeight': 6000,
            'spawn': {'x': 800, 'y': 5830},
            'finishPortal': {'x': 800, 'y': 150},
            'platforms': silly_platforms,
        },
        indent=2,
    )
    + '\n',
    encoding='utf-8',
)

print(f'hub_count {len(hub_platforms)}')
print(f'silly_count {len(silly_platforms)}')
