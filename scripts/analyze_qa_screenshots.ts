import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = 'screenshots/qa/2026-03-25T00-56-45';
const MODEL = 'claude-opus-4-6';

const PROMPTS: Record<string, string> = {
  '01_main_menu': 'Analyze this main menu screenshot. Check for: text clarity and alignment, button positioning, starfield visual quality, any visual glitches or artifacts.',
  '02_squad_builder_arcade': 'Analyze this squad builder scene. Check for: UI layout and alignment, button/text positioning, proper spacing.',
  '03_arcade_battle_start': 'Analyze this arcade battle start. Check for: HUD positioning, ship sprite visibility, background quality.',
  '04a_arcade_thrust': 'Analyze arcade gameplay. Check for: ship visibility, HUD clarity, rendering glitches.',
  '04b_arcade_turning_right': 'Analyze arcade turning. Check for: ship rotation, HUD positioning, visual artifacts.',
  '04c_arcade_fired_shots': 'Analyze projectiles and combat. Check for: projectile visibility, HUD clarity.',
  '04d_arcade_mid_battle': 'Analyze mid-battle. Check for: multiple ships visible, HUD alignment, no UI glitches.',
  '05_pause_overlay': 'Analyze pause menu. Check for: overlay clarity, button visibility, text readability.',
  '06_main_menu_return': 'Analyze main menu after return. Check for: visual consistency with initial load.',
  '07_survival_scene': 'Analyze survival scene. Check for: scene loaded correctly, UI visible and aligned.',
  '08_ace_duel_scene': 'Analyze ace duel. Check for: title text, button positioning, UI layout.',
  '09_epic_battle_scene': 'Analyze epic battle. Check for: large-scale rendering, UI alignment, no glitches.',
  '10_campaign_scene': 'Analyze campaign scene. Check for: UI layout, branch visualization, text alignment.',
  '11_settings_scene': 'Analyze settings. Check for: sliders positioned, labels aligned, sections clear.',
  '12_credits_scene': 'Analyze credits. Check for: text alignment, spacing, background quality.',
};

async function analyzeScreenshot(screenshotPath: string, prompt: string): Promise<any> {
  const filename = path.basename(screenshotPath);
  console.log(`  Analyzing ${filename}...`);
  
  const imageBuffer = fs.readFileSync(screenshotPath);
  const imageB64 = imageBuffer.toString('base64');
  
  const client = new Anthropic();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: imageB64,
            },
          },
          {
            type: 'text',
            text: `${prompt}\n\nRespond with ONLY valid JSON (no markdown, no code blocks): {"issues": [], "severity": "critical|warning|ok", "summary": "..."}`,
          },
        ],
      },
    ],
  });
  
  let result: any = { issues: [], severity: 'unknown', summary: 'N/A' };
  try {
    const text = (message.content[0] as any).text;
    // Try to parse JSON, stripping markdown if present
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    } else {
      result = { issues: [text], severity: 'unknown', summary: 'Parse error' };
    }
  } catch (e) {
    result = { issues: [(message.content[0] as any).text], severity: 'error', summary: 'JSON parse failed' };
  }
  
  return result;
}

async function main() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    console.error(`Error: Screenshots directory not found: ${SCREENSHOTS_DIR}`);
    process.exit(1);
  }
  
  console.log(`\n📸 Analyzing QA screenshots with Claude Vision (${MODEL})\n`);
  
  const results: Record<string, any> = {};
  
  for (const [name, prompt] of Object.entries(PROMPTS)) {
    const screenshot = path.join(SCREENSHOTS_DIR, `${name}.png`);
    if (fs.existsSync(screenshot)) {
      const result = await analyzeScreenshot(screenshot, prompt);
      results[name] = result;
      
      const severity = result.severity || 'unknown';
      const emoji = severity === 'critical' ? '🔴' : severity === 'warning' ? '🟡' : '🟢';
      const summary = (result.summary || 'N/A').substring(0, 80);
      console.log(`    ${emoji} ${severity}: ${summary}`);
    }
  }
  
  // Write report
  const reportFile = path.join(SCREENSHOTS_DIR, 'vision_analysis.json');
  fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
  
  console.log(`\n✅ Report written to ${reportFile}\n`);
  
  // Summary
  const critical = Object.values(results).filter((r: any) => r.severity === 'critical').length;
  const warnings = Object.values(results).filter((r: any) => r.severity === 'warning').length;
  const ok = Object.values(results).filter((r: any) => r.severity === 'ok').length;
  
  console.log(`Summary: ${ok} ok ✅  ${warnings} warnings ⚠️  ${critical} critical 🔴\n`);
  
  process.exit(critical > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Analysis failed:', err);
  process.exit(1);
});
