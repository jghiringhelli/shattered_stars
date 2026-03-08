# AR & Voice Control Design
## Shattered Stars Advanced Input Systems

---

## Voice Command System

### Fleet-Level Commands (High Priority)
Voice commands that affect multiple ships at once:

| Command | Action | Scope |
|---------|--------|-------|
| "All attack" / "Attack formation" | All ships focus on aggressive AI profile | Fleet |
| "All defend" / "Defensive posture" | All ships prioritize evasion and formation | Fleet |
| "Regroup" / "Form up" | All ships converge on player or designated ship | Fleet |
| "Scatter" / "Break formation" | Ships spread out to avoid AoE | Fleet |
| "Retreat" / "Fall back" | Ships disengage and move to map edge | Fleet |
| "Initial volley" / "Alpha strike" | Coordinated first attack, missiles/torpedoes | Fleet |
| "Focus fire [target]" | All ships attack designated target | Fleet |
| "Protect [ship]" | All ships prioritize defending a specific ally | Fleet |

### Ship Class Commands
Commands targeting specific ship roles:

| Command | Action |
|---------|--------|
| "Fighters, engage" | Light/heavy fighters attack nearest enemies |
| "Bombers, target capital" | Bombers prioritize largest enemy |
| "Interceptors, screen" | Interceptors protect bombers/support ships |
| "Support, assist [ship]" | Support ships coordinate with specified ally |

### Individual Actions
Quick action selection:

| Command | Action |
|---------|--------|
| "Focus" | Selected ship takes focus action |
| "Evade" | Selected ship takes evade action |
| "Lock [target]" | Selected ship acquires target lock |
| "Barrel roll left/right" | Repositioning action |
| "Boost" | Forward repositioning |

### Maneuver Commands
Speed/direction by voice:

| Command | Action |
|---------|--------|
| "Speed [1-5]" | Set maneuver speed |
| "Bank left/right" | Bank maneuver |
| "Hard left/right" | Turn maneuver |
| "K-turn" / "Flip" | 180° turn |
| "Straight" | Direct forward |

---

## Pilot Radio Chatter System

### Concept
During battle, AI pilots occasionally request help or report status via "radio":
- Creates immersion and narrative
- Provides tactical information naturally
- Prompts player to use voice commands

### Example Radio Calls

**Help Requests:**
- "This is Alpha-2, I've got two on my tail! Need assistance!"
- "Bomber wing taking heavy fire, requesting escort!"
- "My shields are down, pulling back for repairs."

**Status Reports:**
- "Target locked, ready to fire on your mark."
- "Enemy capital ship shields at 50%!"
- "Missile volley ready, awaiting command."

**Victory/Loss:**
- "Splash one! Enemy down!"
- "We lost Alpha-3... they came out of nowhere."

### Player Responses (Voice)
- "Copy, Alpha-2. Help is on the way." → Nearest ally assists
- "Acknowledged, weapons free." → Execute attack
- "Negative, hold position." → Cancel pending action

---

## AR Gesture System

### Hand Gestures (Vision-based)

| Gesture | Action |
|---------|--------|
| **Point** | Select target/ship in that direction |
| **Closed fist** | Confirm selection |
| **Open palm** | Cancel / Deselect |
| **Swipe left/right** | Pan camera |
| **Pinch in/out** | Zoom |
| **Two-finger tap** | Context menu |
| **Thumbs up** | Approve AI suggestion |
| **Thumbs down** | Reject AI suggestion |

### Gaze Control
- **Dwell selection**: Look at ship for 1s to select
- **Gaze + voice**: "Attack that" while looking at target
- **Gaze minimap**: Quick-look at minimap positions

### Head Tracking
- **Head tilt**: Camera pan
- **Lean forward**: Zoom in
- **Lean back**: Zoom out / overview mode

---

## Implementation Architecture

### Voice Recognition Layer
```
Microphone → Web Speech API → Intent Parser → Command Dispatcher → Game Systems
```

**Intent Parser** converts speech to ActionIntents:
- Uses keyword matching for commands
- Fuzzy matching for ship names/targets
- Confirmation required for destructive commands

### AR Input Layer
```
Camera → MediaPipe / TensorFlow.js → Gesture Recognizer → ActionIntent → Game Systems
```

- WebXR for immersive AR (future)
- MediaPipe Hands for gesture recognition
- Face mesh for gaze direction

### Fallback Strategy
All voice/AR commands have equivalent:
1. Keyboard shortcut
2. Mouse/touch interface
3. Gamepad button

Never require voice/AR — always optional enhancement.

---

## Accessibility Considerations

- **Voice-only mode**: Full game playable with voice alone (for mobility impairments)
- **Visual feedback**: All voice commands show on-screen confirmation
- **Customizable wake word**: "Computer" / "Fleet" / "Admiral" / custom
- **Command history**: Show recent voice commands in HUD
- **Training mode**: Practice voice commands outside of battle

---

## Phased Implementation

### Phase A (Foundation)
- Voice command recognition (Web Speech API)
- Basic fleet commands (attack/defend/regroup)
- Visual feedback for commands

### Phase B (Expansion)
- Ship class commands
- Individual action commands
- Pilot radio chatter (text + audio)

### Phase C (AR Integration)
- Hand gesture recognition
- Gaze selection
- Head tracking for camera

### Phase D (Polish)
- Natural language understanding (more flexible commands)
- Context-aware suggestions
- Adaptive radio chatter based on battle state

---

*This document outlines the vision for advanced input systems. Implementation will be phased based on core gameplay stability and player feedback.*
