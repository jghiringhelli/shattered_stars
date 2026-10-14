/**
 * CAMPAIGN_HUB_TERMS - tooltip terms of the campaign Armory and Research
 * panels: every squad bonus, armory slot, credit cost, research tier and
 * choice state. Pure data.
 */

import { term } from "./termTypes";

/** Terms of the Armory / Research panels. */
export const CAMPAIGN_HUB_TERMS = {
  "campaign.bonus_hull": term(
    "Hull bonus",
    "Scales the hull of every ship in your squad. Hull is the health you have left once the shields are gone.",
    "Reinforced Bulkheads gives +20% hull: a light fighter with 24 hull now flies with about 29, enough to survive one more hit.",
    "Good when your squad keeps getting caught in crossfires; it helps every ship, not only the flagship.",
    "hull",
  ),
  "campaign.bonus_shields": term(
    "Shield bonus",
    "Scales the shield points of every ship in your squad. Shields absorb damage first and, unlike hull, can recover.",
    "Capacitor Array gives +25% shields: a fighter with 12 shields now carries 15, so a short burst never reaches the hull.",
    "Pairs well with pilots who dive in, trade a few hits and fly out to recover.",
    "shield",
  ),
  "campaign.bonus_regen": term(
    "Shield regeneration",
    "Shield points that come back every second while you fight, so a damaged ship recovers without a repair.",
    "Regenerative Emitters restores 0.24 shield HP per second: after 10 seconds out of the line of fire a ship has gained about 2.4 shield points.",
    "Rewards hit-and-run flying: break off, let the shields refill, dive again.",
    "shield",
  ),
  "campaign.bonus_attack": term(
    "Damage bonus",
    "Adds damage to every primary weapon hit your squad lands.",
    "Overcharged Cannons adds +1 damage per hit: a hit that took 3 points off a target now takes 4.",
    "Shortens every fight, so enemies have less time to shoot back.",
    "attack",
  ),
  "campaign.bonus_agility": term(
    "Evasion bonus",
    "Adds evasion (agility) to every ship, which makes enemy shots miss more often.",
    "Combat Computer adds +0.5 evasion: an interceptor with 3 agility dodges like a ship with 3.5.",
    "Most valuable on fast, fragile ships that already fly out of the enemy's arc.",
    "agility",
  ),
  "campaign.bonus_fire_rate": term(
    "Weapon recycle",
    "Shortens the pause between primary weapon shots. A smaller number means a faster gun.",
    "Rapid Cyclers recycles 15% faster: a gun that fires once every second now fires about every 0.85 seconds.",
    "More shots per cycle of flying means more chances to land hits while an enemy is in your front arc.",
  ),
  "campaign.bonus_damage_taken": term(
    "Damage reduction",
    "Every hit your squad suffers is reduced by a percentage after shields and armor are counted.",
    "Ablative Armor takes 12% off incoming damage: a hit worth 10 points lands as 8.8.",
    "Works on every ship at once and on every kind of damage, so it beats extra hull when the fight is crowded.",
    "hull",
  ),
  "campaign.bonus_power_cooldown": term(
    "Hero power recharge",
    "Shortens the wait before your hero's V and B powers can be used again.",
    "Hero Capacitors recharges powers 15% faster: a 40-second Drone Swarm is ready again after 34 seconds.",
    "Use it when you lean on your hero powers every fight; it changes nothing for your ships.",
    "star",
  ),
  "campaign.bonus_credits": term(
    "Credit bonus",
    "Increases the credits every mission pays out, which you spend on Armory mods.",
    "Salvage Protocols adds +25% credits: a mission that would pay 400 credits pays 500.",
    "Pick it early; the bonus pays for every later mission.",
  ),
  "campaign.bonus_research": term(
    "Research bonus",
    "Every bonus objective you complete grants extra research points, which unlock new research tiers faster.",
    "Tactical Analysis gives +1 point per bonus objective: finishing two bonus objectives in one mission earns two extra points.",
    "Pays back only if you actually play the optional objectives.",
  ),
  "campaign.bonus_wingmen": term(
    "Wingman damage",
    "Adds damage to the primary hits of your escorts and wingmen. Your own flagship is not changed.",
    "Wing Doctrine adds +1 damage for wingmen: each wingman hit takes 1 more point off an enemy.",
    "Rewards flying as a wing and marking targets with R so wingmen focus the same enemy.",
    "attack",
  ),
  "campaign.armory_slot_hull": term(
    "Hull slot",
    "The Armory has one slot for each part of your ships; you can install one of its two mods at a time.",
    "Hull slot: Reinforced Bulkheads (+20% hull) or Ablative Armor (-12% damage taken). Installing one swaps out the other.",
    "Choose how your squad survives: more hull points, or less damage from every hit.",
    "hull",
  ),
  "campaign.armory_slot_shields": term(
    "Shields slot",
    "The Armory has one slot for each part of your ships; you can install one of its two mods at a time.",
    "Shields slot: Capacitor Array (+25% shields) or Regenerative Emitters (+15% shields that regenerate).",
    "Choose between a bigger shield buffer and a smaller one that refills during a fight.",
    "shield",
  ),
  "campaign.armory_slot_weapons": term(
    "Weapons slot",
    "The Armory has one slot for each part of your ships; you can install one of its two mods at a time.",
    "Weapons slot: Overcharged Cannons (+1 damage per hit) or Rapid Cyclers (primary weapons 15% faster).",
    "Choose between harder hits and more hits.",
    "attack",
  ),
  "campaign.armory_slot_systems": term(
    "Systems slot",
    "The Armory has one slot for each part of your ships; you can install one of its two mods at a time.",
    "Systems slot: Combat Computer (+0.5 evasion) or Hero Capacitors (hero powers 15% faster).",
    "Choose between a better dodge for every ship or a hero who casts more often.",
    "agility",
  ),
  "campaign.armory_credits": term(
    "Credits and refunds",
    "Armory mods cost campaign credits, which missions pay out. The price is paid when you install a mod and refunded in full when you uninstall it.",
    "Capacitor Array costs 150: with 500 credits you keep 350. Uninstalling it, or a respec, gives all 150 back.",
    "Nothing is lost by experimenting: rebuild your squad between missions as often as you like.",
    "points",
  ),
  "campaign.armory_installed": term(
    "Installed",
    "This mod is active on every ship of your squad in the next mission.",
    "Reinforced Bulkheads installed: all your fighters start the mission with 20% more hull. Click it again to refund it.",
    "Only one mod per slot can be installed; buying the other one in the slot swaps them.",
  ),
  "campaign.armory_afford": term(
    "Affordability",
    "Shows whether you can pay for this mod right now. A mod you cannot afford stays dim and refuses the click.",
    "With 200 credits, Capacitor Array (150) can be bought but Overcharged Cannons (260) shows how many credits you still need.",
    "Earn credits by finishing missions and their bonus objectives.",
    "points",
  ),
  "campaign.armory_respec": term(
    "Respec",
    "Uninstalls every Armory mod at once and refunds everything you paid. It is always free.",
    "Installed 150 + 220 credits of mods, then respec: both are removed and your 370 credits are back.",
    "Use it before a mission whose enemies need a different answer than the last one.",
  ),
  "campaign.research_points": term(
    "Research points",
    "Earned by completing bonus objectives. Each research tier unlocks once you have earned its number of points in total; points are never spent.",
    "Hull Doctrine unlocks at 2 points, Command Doctrine at 6, Logistics at 11 and Weapons Doctrine at 17.",
    "Play the bonus objectives to open the tiers; Tactical Analysis makes each one worth more.",
    "star",
  ),
  "campaign.research_locked": term(
    "Locked tier",
    "You have not earned enough research points for this tier yet, so its two options cannot be chosen.",
    "Command Doctrine needs 6 points: with 3 points earned it stays locked and shows how many more you need.",
    "Locked options are dimmed; they open the moment your total reaches the requirement.",
  ),
  "campaign.research_chosen": term(
    "Chosen option",
    "You picked this option for this playthrough. It is active in every mission from now on and can never be changed.",
    "Hull Doctrine chosen: Reactive Plating (+15% hull) is active, Shield Harmonics is gone for this campaign.",
    "Research is permanent. Think about your squad before you confirm.",
  ),
  "campaign.research_decided": term(
    "Decided tier",
    "This tier already has its choice. The option you did not take is closed for the rest of the campaign.",
    "Logistics decided as Salvage Protocols: Tactical Analysis can no longer be picked in this playthrough.",
    "A new campaign starts with a fresh research tree.",
  ),
  "campaign.research_pending": term(
    "Confirm choice",
    "The first click only marks an option. A second click on the same option makes it permanent.",
    "Click Wing Doctrine once: it asks to be confirmed. Click it again to lock it in, or click another card to change your mind.",
    "The extra click protects you from a permanent mistake.",
  ),
  "campaign.tier_hull_doctrine": term(
    "Hull Doctrine",
    "The first research tier (2 points): make the whole squad tougher through hull or shields.",
    "Reactive Plating adds +15% hull; Shield Harmonics adds +20% shields and 0.12 shield HP per second of regeneration.",
    "Pick hull for brawling squads and shields for squads that retreat and return.",
    "hull",
  ),
  "campaign.tier_command_doctrine": term(
    "Command Doctrine",
    "The second research tier (6 points): improve your hero's powers or your wingmen's guns.",
    "Hero Conduit recharges hero powers 20% faster; Wing Doctrine gives wingmen +1 damage.",
    "Hero Conduit fits a flagship that casts constantly; Wing Doctrine fits a squad that flies together.",
    "star",
  ),
  "campaign.tier_logistics": term(
    "Logistics",
    "The third research tier (11 points): grow what the campaign pays you, in credits or in research points.",
    "Salvage Protocols gives +25% credits per mission; Tactical Analysis gives +1 research point per bonus objective.",
    "Credits buy Armory mods; extra research points reach the last tier sooner.",
    "points",
  ),
  "campaign.tier_weapons_doctrine": term(
    "Weapons Doctrine",
    "The last research tier (17 points): your squad's primary weapons hit harder or fire faster.",
    "Heavy Lances adds +1 damage per hit; Phase Cyclers makes primary weapons recycle 15% faster.",
    "Choose by the weapon mod you installed in the Armory: stack the same idea or cover the other one.",
    "attack",
  ),
} as const satisfies Record<string, ReturnType<typeof term>>;
