export interface PresetDrink {
  name: string;
  priceCents: number;
}

const PRESET_DRINKS: PresetDrink[] = [
  // Flasks
  { name: 'White Rum (Flask)', priceCents: 200000 },
  { name: 'Appleton Signature (Flask)', priceCents: 200000 },
  { name: 'Smirnoff Vodka (Flask)', priceCents: 200000 },
  { name: 'Campari (Flask)', priceCents: 200000 },
  // Beers
  { name: 'Red Stripe', priceCents: 50000 },
  { name: 'Red Stripe Sorrel', priceCents: 40000 },
  { name: 'Red Stripe Lemon', priceCents: 40000 },
  { name: 'Red Stripe Mango', priceCents: 40000 },
  { name: 'Heineken', priceCents: 50000 },
  { name: 'Smirnoff Ice', priceCents: 50000 },
  { name: 'Dragon Stout (Original)', priceCents: 50000 },
  // Soft Drinks & Mixers
  { name: 'Pepsi', priceCents: 30000 },
  { name: 'Ting', priceCents: 30000 },
  { name: 'Tropical Rhythm', priceCents: 50000 },
  { name: 'Water', priceCents: 20000 },
  // Cocktails
  { name: 'Sinna Wata', priceCents: 150000 },
  { name: 'Duppy Conquerah', priceCents: 150000 },
  { name: 'Im Just A Witch', priceCents: 150000 },
  { name: 'Succubus Kiss', priceCents: 150000 },
];

export default PRESET_DRINKS;