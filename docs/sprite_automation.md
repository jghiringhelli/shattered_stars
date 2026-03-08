# Sprite Sheet Generation & Visual System
## **Automated Asset Pipeline for Faction Ship Variants**

---

## **VISUAL DESIGN PHILOSOPHY**

### **Faction Visual Identity**
Each faction has distinctive visual characteristics that make ships instantly recognizable:

**Terran Hegemony:** Clean geometric lines, blue/silver/white, angular designs
**Free Confederation:** Weathered, practical, orange/green/gold, modular appearance  
**Synthetic Collective:** Sleek curves, gunmetal/blue/chrome, seamless surfaces
**Void Corsairs:** Aggressive spikes, purple/red/brass, asymmetrical modifications
**Ascendant Empire:** Organic curves, green/gold/black, bio-mechanical fusion

---

## **AUTOMATED SPRITE GENERATION PIPELINE**

### **Base Asset Preparation**
```python
# Sprite generation configuration
class SpriteConfig:
    def __init__(self):
        self.base_resolution = (256, 256)  # High-res master sprites
        self.game_resolution = (64, 64)    # In-game display size
        self.rotation_steps = 64           # 64 rotation frames for smooth movement
        self.faction_variants = 5          # One per faction
        self.evolution_stages = 3          # Base, Evolved, Elite
        
    def generate_sprite_matrix(self):
        return {
            'ships': self.faction_variants * self.evolution_stages,
            'rotations': self.rotation_steps,
            'total_frames': ships * rotations,
            'sheet_dimensions': self.calculate_optimal_sheet_size()
        }
```

### **Faction Color Palette System**
```python
FACTION_PALETTES = {
    'terran_hegemony': {
        'primary': '#2E4A99',      # Imperial Blue
        'secondary': '#C0C0C0',    # Silver
        'accent': '#FFFFFF',       # White
        'energy': '#00BFFF',       # Electric Blue
        'glow': '#87CEEB'          # Light Blue
    },
    'free_confederation': {
        'primary': '#FF6B35',      # Rebel Orange
        'secondary': '#2D5016',    # Forest Green
        'accent': '#FFD700',       # Gold
        'energy': '#FFFF00',       # Yellow
        'glow': '#FFA500'          # Orange Glow
    },
    'synthetic_collective': {
        'primary': '#2F2F2F',      # Gunmetal
        'secondary': '#0080FF',    # Electric Blue
        'accent': '#C0C0C0',       # Chrome
        'energy': '#00FFFF',       # Cyan
        'glow': '#4169E1'          # Royal Blue
    },
    'void_corsairs': {
        'primary': '#4B0082',      # Deep Purple
        'secondary': '#DC143C',    # Crimson
        'accent': '#DAA520',       # Brass
        'energy': '#FF1493',       # Hot Pink
        'glow': '#8B008B'          # Dark Magenta
    },
    'ascendant_empire': {
        'primary': '#228B22',      # Forest Green
        'secondary': '#FFD700',    # Gold
        'accent': '#2F4F4F',       # Dark Slate Gray
        'energy': '#ADFF2F',       # Green Yellow
        'glow': '#32CD32'          # Lime Green
    }
}
```

### **Automated Color Application**
```python
def apply_faction_colors(base_sprite, faction_id):
    """
    Apply faction-specific color palette to base ship sprite
    Uses layer-based recoloring for different ship components
    """
    palette = FACTION_PALETTES[faction_id]
    
    # Define recoloring layers
    color_layers = {
        'hull': palette['primary'],          # Main ship body
        'details': palette['secondary'],     # Panels, details
        'weapons': palette['accent'],        # Weapon systems
        'engines': palette['energy'],        # Engine glow
        'highlights': palette['glow']        # Edge highlights
    }
    
    # Apply color mapping to sprite layers
    recolored_sprite = sprite_recolor_engine(base_sprite, color_layers)
    
    # Add faction-specific details (decals, markings)
    faction_sprite = add_faction_markings(recolored_sprite, faction_id)
    
    return faction_sprite

def add_faction_markings(sprite, faction_id):
    """Add faction-specific visual elements"""
    markings = {
        'terran_hegemony': ['imperial_eagle', 'numeric_codes', 'formation_stripes'],
        'free_confederation': ['star_emblems', 'nose_art', 'kill_markings'],
        'synthetic_collective': ['circuit_patterns', 'data_ports', 'led_strips'],
        'void_corsairs': ['skull_emblems', 'battle_damage', 'spikes'],
        'ascendant_empire': ['bio_textures', 'organic_panels', 'energy_veins']
    }
    
    for marking_type in markings[faction_id]:
        sprite = apply_marking(sprite, marking_type)
    
    return sprite
```

---

## **EVOLUTION VISUAL PROGRESSION**

### **Ship Evolution Stages**
```python
class EvolutionVisuals:
    def __init__(self):
        self.stages = {
            'base': {
                'scale': 1.0,
                'details': 'minimal',
                'weapons': 'basic',
                'markings': 'recruit'
            },
            'evolved': {
                'scale': 1.1,
                'details': 'enhanced',
                'weapons': 'upgraded',
                'markings': 'veteran',
                'modifications': ['armor_plating', 'sensor_arrays']
            },
            'elite': {
                'scale': 1.2,
                'details': 'maximum',
                'weapons': 'elite',
                'markings': 'ace',
                'modifications': ['advanced_systems', 'unique_variants']
            }
        }
    
    def generate_evolution_sprite(self, base_sprite, evolution_stage, faction):
        """Generate evolved version of ship sprite"""
        stage_config = self.stages[evolution_stage]
        
        # Scale ship slightly for evolved versions
        scaled_sprite = scale_sprite(base_sprite, stage_config['scale'])
        
        # Add evolution-specific modifications
        for modification in stage_config.get('modifications', []):
            scaled_sprite = add_modification(scaled_sprite, modification, faction)
        
        # Update markings for veteran status
        veteran_sprite = update_markings(scaled_sprite, stage_config['markings'])
        
        return veteran_sprite
```

### **Faction-Specific Evolution Visuals**
```python
EVOLUTION_MODIFICATIONS = {
    'terran_hegemony': {
        'evolved': ['additional_armor', 'targeting_arrays', 'formation_lights'],
        'elite': ['command_antennae', 'shield_projectors', 'medal_markings']
    },
    'free_confederation': {
        'evolved': ['jury_rigged_parts', 'external_modifications', 'pilot_decorations'],
        'elite': ['custom_paintjobs', 'trophy_racks', 'hero_markings']
    },
    'synthetic_collective': {
        'evolved': ['additional_sensors', 'processing_nodes', 'data_cables'],
        'elite': ['advanced_ai_core', 'network_antennae', 'efficiency_upgrades']
    },
    'void_corsairs': {
        'evolved': ['battle_scars', 'weapon_modifications', 'pirate_flags'],
        'elite': ['trophy_collections', 'intimidation_spikes', 'fear_markings']
    },
    'ascendant_empire': {
        'evolved': ['bio_growths', 'organic_modifications', 'living_weapons'],
        'elite': ['full_bio_integration', 'psionic_crystals', 'evolutionary_perfection']
    }
}
```

---

## **ROTATION FRAME GENERATION**

### **Smooth Rotation System**
```python
def generate_rotation_frames(base_sprite, num_frames=64):
    """
    Generate smooth rotation frames for ship movement
    Creates 64 frames for 360-degree rotation
    """
    rotation_frames = []
    angle_step = 360 / num_frames
    
    for frame in range(num_frames):
        angle = frame * angle_step
        rotated_sprite = rotate_sprite(base_sprite, angle)
        
        # Apply anti-aliasing for smooth rotation
        smoothed_sprite = apply_antialiasing(rotated_sprite)
        
        rotation_frames.append(smoothed_sprite)
    
    return rotation_frames

def optimize_rotation_frames(frames):
    """
    Optimize rotation frames for memory and performance
    """
    optimized_frames = []
    
    for frame in frames:
        # Compress similar frames
        compressed_frame = compress_sprite(frame)
        
        # Remove fully transparent pixels
        trimmed_frame = trim_transparency(compressed_frame)
        
        optimized_frames.append(trimmed_frame)
    
    return optimized_frames
```

### **Sprite Sheet Assembly**
```python
class SpriteSheetGenerator:
    def __init__(self, texture_size=4096):
        self.texture_size = texture_size
        self.sprite_size = 64
        self.sprites_per_row = texture_size // sprite_size
        
    def pack_sprites(self, ship_sprites):
        """
        Pack all ship sprites into optimal texture atlases
        Groups by faction for memory efficiency
        """
        sprite_sheets = {}
        
        for faction_id, ships in ship_sprites.items():
            sheet = self.create_empty_sheet()
            current_position = (0, 0)
            
            for ship_id, rotations in ships.items():
                for evolution_stage, frames in rotations.items():
                    position = self.pack_frames(sheet, frames, current_position)
                    
                    # Store sprite coordinates for runtime lookup
                    self.register_sprite_coordinates(
                        faction_id, ship_id, evolution_stage, position
                    )
                    
                    current_position = self.advance_position(position, len(frames))
            
            sprite_sheets[faction_id] = sheet
        
        return sprite_sheets
    
    def generate_sprite_atlas_data(self):
        """
        Generate JSON data for sprite atlas lookup
        """
        atlas_data = {
            'texture_size': self.texture_size,
            'sprite_size': self.sprite_size,
            'factions': {}
        }
        
        for faction_id in FACTION_PALETTES.keys():
            atlas_data['factions'][faction_id] = {
                'texture_file': f'{faction_id}_ships.png',
                'ships': self.get_ship_coordinates(faction_id)
            }
        
        return atlas_data
```

---

## **WEAPON EFFECT GENERATION**

### **Faction-Specific Weapon Visuals**
```python
WEAPON_EFFECTS = {
    'terran_hegemony': {
        'laser': 'blue_beam',
        'missile': 'guided_contrail',
        'torpedo': 'heavy_warhead',
        'particles': 'geometric_sparks'
    },
    'free_confederation': {
        'laser': 'orange_bolt',
        'missile': 'rebel_trail',
        'torpedo': 'proton_glow',
        'particles': 'explosion_debris'
    },
    'synthetic_collective': {
        'laser': 'cyan_pulse',
        'missile': 'seeker_drone',
        'torpedo': 'plasma_charge',
        'particles': 'digital_fragments'
    },
    'void_corsairs': {
        'laser': 'purple_beam',
        'missile': 'chaotic_trail',
        'torpedo': 'skull_warhead',
        'particles': 'violent_sparks'
    },
    'ascendant_empire': {
        'laser': 'green_bio_beam',
        'missile': 'living_seeker',
        'torpedo': 'bio_spore',
        'particles': 'organic_splatter'
    }
}

def generate_weapon_effects(faction_id):
    """Generate faction-specific weapon effect sprites"""
    effects = WEAPON_EFFECTS[faction_id]
    effect_sprites = {}
    
    for weapon_type, effect_style in effects.items():
        # Generate animated effect frames
        effect_frames = create_weapon_animation(effect_style, faction_id)
        
        # Apply faction color palette
        colored_frames = [
            apply_faction_colors(frame, faction_id) 
            for frame in effect_frames
        ]
        
        effect_sprites[weapon_type] = colored_frames
    
    return effect_sprites
```

---

## **PERFORMANCE OPTIMIZATION**

### **Memory Management**
```python
class SpriteMemoryManager:
    def __init__(self):
        self.loaded_factions = set()
        self.sprite_cache = {}
        self.max_memory_mb = 512  # 512MB sprite memory limit
        
    def load_faction_sprites(self, faction_id):
        """Load sprites for specific faction on demand"""
        if faction_id in self.loaded_factions:
            return self.sprite_cache[faction_id]
        
        # Check memory limit
        if self.get_memory_usage() > self.max_memory_mb:
            self.unload_unused_factions()
        
        # Load faction sprite sheet
        sprite_data = load_sprite_sheet(f'{faction_id}_ships.png')
        self.sprite_cache[faction_id] = sprite_data
        self.loaded_factions.add(faction_id)
        
        return sprite_data
    
    def unload_unused_factions(self):
        """Unload sprite data for factions not currently in battle"""
        active_factions = get_active_battle_factions()
        
        for faction_id in list(self.loaded_factions):
            if faction_id not in active_factions:
                del self.sprite_cache[faction_id]
                self.loaded_factions.remove(faction_id)
```

### **Runtime Sprite Selection**
```python
def get_ship_sprite(ship_id, faction_id, evolution_stage, rotation_angle):
    """
    Efficiently retrieve the correct sprite for a ship
    """
    # Calculate rotation frame index
    frame_index = int((rotation_angle / 360) * 64) % 64
    
    # Lookup sprite coordinates in atlas
    atlas_coords = get_sprite_coordinates(
        faction_id, ship_id, evolution_stage, frame_index
    )
    
    # Return sprite region from texture atlas
    return extract_sprite_region(faction_id, atlas_coords)

def batch_sprite_updates(ships_to_update):
    """
    Batch multiple sprite updates for efficiency
    """
    updates_by_faction = group_by_faction(ships_to_update)
    
    for faction_id, ships in updates_by_faction.items():
        # Ensure faction sprites are loaded
        faction_sprites = sprite_manager.load_faction_sprites(faction_id)
        
        # Process all ships of this faction together
        for ship in ships:
            ship.sprite = get_ship_sprite(
                ship.ship_id, faction_id, ship.evolution_stage, ship.rotation
            )
```

---

## **MODDING & CUSTOMIZATION SUPPORT**

### **Custom Faction Creation**
```python
def create_custom_faction(faction_config):
    """
    Allow players to create custom factions with their own color schemes
    """
    custom_palette = {
        'primary': faction_config['primary_color'],
        'secondary': faction_config['secondary_color'],
        'accent': faction_config['accent_color'],
        'energy': faction_config['energy_color'],
        'glow': faction_config['glow_color']
    }
    
    # Generate sprites using custom palette
    base_ships = get_base_ship_templates()
    custom_sprites = {}
    
    for ship_id, base_sprite in base_ships.items():
        custom_sprites[ship_id] = apply_faction_colors(base_sprite, custom_palette)
    
    return custom_sprites

def export_sprite_templates():
    """
    Export layered sprite templates for modding community
    """
    templates = {
        'base_ships': get_base_ship_sprites(),
        'color_layers': get_recoloring_masks(),
        'detail_layers': get_detail_overlays(),
        'effect_templates': get_weapon_effect_templates()
    }
    
    save_modding_package('sprite_templates.zip', templates)
```

This automated sprite generation system creates thousands of ship variants efficiently while maintaining visual consistency and faction identity. The modular approach allows for easy expansion and community modding support.
