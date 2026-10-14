"""Prompts for generate_creature_art_comfy.py (SDXL). Keys are sprite ids without the creature_ prefix.

Orientation contract: top-down, head / front pointing UP, centred, on a pure black backdrop.
Lore: docs/lore/universe.md (Void Tide, Warden, Hollowed), docs/specs/creatures.md (weak points).
The backdrop keyer needs mid-tone materials (pure black plates would be keyed away) and no glow halo.
"""

STYLE_PREFIX = (
    "game sprite, flat top-down view from directly above, single monster centered, isolated on a "
    "solid pure black background, glossy illustrated sci-fi monster design, saturated jewel colors, "
    "bold readable silhouette, high contrast, crisp clean outline, detailed, evenly lit with bright "
    "rim light, medium-brightness materials, no background glow, no halo, no frame, "
)

NEGATIVE_PROMPT = (
    "text, watermark, signature, blurry, multiple creatures, cropped, scenery, ground, shadow, planet, "
    "person, photo, low quality, jpeg artifacts, side view, perspective, window, frame, border, "
    "vignette, stars, nebula, human face, humanoid, woman, nude, hair, skin, white background, "
    "gradient background, grey background, glow halo, aura, bloom, fog, smoke, spaceship, starfighter, "
    "wings, feathers, angel, knight, robot, stained glass, mosaic, black armor, pure black plates"
)

CREATURE_PROMPTS: dict = {
    "cinder_wyrm_body": (
        "dorsal view of an armored space serpent head seen straight down from above like a viper from "
        "overhead, long wedge-shaped skull, narrow snout with two small nostril vents at the top tip "
        "pointing up, two small glowing orange eyes on the sides of the skull, a bright molten ember gland "
        "glowing in the middle of the skull, a ridge of bronze and warm grey gunmetal plates edged with "
        "ember-orange cracks, two long horns sweeping backward and down, no face, no mouth visible, "
        "perfectly symmetrical"
    ),
    "cinder_wyrm_segment": (
        "single body segment of a giant armored space serpent seen from above, wide oval vertebra plate "
        "of polished bronze and warm grey gunmetal armor, glowing ember-orange spine ridge and glowing "
        "seams, two short spikes on left and right, perfectly symmetrical"
    ),
    "deepmaw_body": (
        "colossal abyssal void leviathan seen straight down from above, rounded body with a big round "
        "maw at the top front filled with concentric rings of sharp teeth and cilia around a dark throat, "
        "glowing teal gut sac on its back, six long thick tentacles curling outward from the sides, "
        "barnacled hide in medium indigo-blue with teal bioluminescent spots, no eyes, no face, "
        "perfectly symmetrical"
    ),
    "choir_hive_body": (
        "living hive organism seen from above like a carnivorous flower, a glowing green central brood "
        "sac, eight flared trumpet-shaped throat horns radiating around it with open glowing mouths, "
        "four large thorny amber spore-pods at the cardinal points, translucent amber and acid-green "
        "flesh with visible veins, radially symmetrical"
    ),
    "choir_hive_pod": (
        "single small spiky brood pod seen from above, round bulb with a glowing slit eye in the middle, "
        "amber and acid-green flesh, ring of short thorns pointing outward, perfectly symmetrical"
    ),
    "pruning_herald_body": (
        "a single giant pair of open crystal pruning shears, two long pale bone-white faceted crystal "
        "blades forming a V that points up, joined at a round violet-grey armored pivot hub with one "
        "large glowing cold violet lens eye, short thin crystal spikes behind the hub, cold violet-white "
        "light, an alien machine object, perfectly symmetrical"
    ),
    "warden_avatar_body": (
        "engineered gardener god seen from above, four enormous iridescent violet-purple flower petals "
        "opening in a cross around a hollow glowing violet-white core, root-like vines coiling between "
        "the petals, alien glyphs etched into the petals, regal and ominous, radially symmetrical"
    ),
    "tidecell_body": (
        "single glossy teardrop-shaped orb creature seen from above, deep purple-blue reflective shell "
        "with a pointed tip pointing up, one big glowing cold violet eye in the center, thin violet "
        "energy wisps trailing from the tail, smooth, minimal, perfectly symmetrical"
    ),
    "hulk_gnawer_body": (
        "head of a giant mechanical scavenger worm seen from above, round armored head at the top with "
        "a small ring of grinding teeth and two heavy curved mandibles at its front tip pointing up, two "
        "glowing red sensor eyes, followed by a short segmented tapering body, pale grey-brown scarred "
        "chitin plates with rust stains, perfectly symmetrical"
    ),
    "hulk_gnawer_segment": (
        "single body segment of a giant mechanical scavenger worm seen from above, wide oval armored "
        "band of pale grey-brown scarred plates with rust stains and a raised ridge down the middle, "
        "two small clawed legs on left and right, closed solid armor, no mouth, no teeth, perfectly symmetrical"
    ),
}
