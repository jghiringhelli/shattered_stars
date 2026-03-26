#!/usr/bin/env python3
"""
Analyze QA screenshots with Claude Vision API.
Looks for visual glitches, alignment issues, text legibility, etc.
"""

import anthropic
import base64
import json
import sys
from pathlib import Path

SCREENSHOTS_DIR = Path('screenshots/qa/2026-03-25T00-56-45')
MODEL = 'claude-opus-4-6'

PROMPTS = {
    '01_main_menu': 'Analyze this main menu screenshot. Check for: text clarity and alignment, button positioning, starfield visual quality, any visual glitches or artifacts, proper text contrast.',
    '02_squad_builder_arcade': 'Analyze this squad builder scene. Check for: UI layout and alignment, button/text positioning, proper spacing, any visual glitches.',
    '03_arcade_battle_start': 'Analyze this arcade battle start scene. Check for: HUD positioning (top-left, top-right), ship sprite visibility and rotation, background visual quality.',
    '04a_arcade_thrust': 'Analyze. Check for: ship visibility and position, HUD clarity, any rendering glitches.',
    '04b_arcade_turning_right': 'Analyze. Check for: ship rotation correctness, HUD elements positioned correctly, no visual artifacts.',
    '04c_arcade_fired_shots': 'Analyze. Check for: projectile visibility, ship position, HUD clarity, any visual glitches.',
    '04d_arcade_mid_battle': 'Analyze mid-battle. Check for: multiple ships visible and distinct, HUD alignment, minimap/status display clarity, no overlapping UI glitches.',
    '05_pause_overlay': 'Analyze pause overlay. Check for: overlay clarity and opacity, button visibility and alignment, text readability, dark background properly dimmed.',
    '06_main_menu_return': 'Analyze main menu after return. Check for: identical visual quality as first main menu, no corruption or visual state issues.',
    '07_survival_scene': 'Analyze survival scene. Check for: scene loaded correctly, UI visible and aligned, background properly rendered.',
    '08_ace_duel_scene': 'Analyze ace duel scene. Check for: title text visible, button positioning, UI layout correct, no visual glitches.',
    '09_epic_battle_scene': 'Analyze epic battle scene. Check for: large-scale scene rendered properly, UI aligned, no performance visual glitches (missing sprites, tearing, etc).',
    '10_campaign_scene': 'Analyze campaign scene. Check for: UI layout, branch visualization clarity, text alignment and readability, background visual quality.',
    '11_settings_scene': 'Analyze settings scene. Check for: sliders positioned correctly, labels aligned, section titles clear, scrolling area visible.',
    '12_credits_scene': 'Analyze credits scene. Check for: text alignment and positioning, proper spacing between lines, background visual quality.',
}

def analyze_screenshot(screenshot_path: Path, prompt: str) -> dict:
    """Analyze a single screenshot with Claude Vision."""
    print(f"  Analyzing {screenshot_path.name}...")
    
    with open(screenshot_path, 'rb') as f:
        image_b64 = base64.standard_b64encode(f.read()).decode()
    
    client = anthropic.Anthropic()
    message = client.messages.create(
        model=MODEL,
        max_tokens=300,
        messages=[
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'image',
                        'source': {
                            'type': 'base64',
                            'media_type': 'image/png',
                            'data': image_b64,
                        },
                    },
                    {
                        'type': 'text',
                        'text': f'{prompt}\n\nRespond with JSON: {{"issues": [...], "severity": "critical|warning|ok", "summary": "..."}}'
                    }
                ],
            }
        ],
    )
    
    try:
        result = json.loads(message.content[0].text)
    except (json.JSONDecodeError, IndexError, KeyError):
        result = {
            'issues': [message.content[0].text],
            'severity': 'unknown',
            'summary': 'Parse error'
        }
    
    return result

def main():
    if not SCREENSHOTS_DIR.exists():
        print(f"Error: Screenshots directory not found: {SCREENSHOTS_DIR}")
        sys.exit(1)
    
    print(f"\n📸 Analyzing QA screenshots with Claude Vision ({MODEL})\n")
    
    results = {}
    for name, prompt in PROMPTS.items():
        screenshot = SCREENSHOTS_DIR / f'{name}.png'
        if screenshot.exists():
            result = analyze_screenshot(screenshot, prompt)
            results[name] = result
            
            severity = result.get('severity', 'unknown')
            emoji = '🔴' if severity == 'critical' else '🟡' if severity == 'warning' else '🟢'
            print(f"    {emoji} {severity}: {result.get('summary', 'N/A')[:80]}")
    
    # Write report
    report_file = SCREENSHOTS_DIR / 'vision_analysis.json'
    with open(report_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n✅ Report written to {report_file}\n")
    
    # Summary
    critical = sum(1 for r in results.values() if r.get('severity') == 'critical')
    warnings = sum(1 for r in results.values() if r.get('severity') == 'warning')
    ok = sum(1 for r in results.values() if r.get('severity') == 'ok')
    
    print(f"Summary: {ok} ok ✅  {warnings} warnings ⚠️  {critical} critical 🔴\n")
    
    return critical

if __name__ == '__main__':
    sys.exit(main())
