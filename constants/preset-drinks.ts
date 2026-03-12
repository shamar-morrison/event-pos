export interface PresetDrink {
  name: string;
  priceCents: number;
}

const PRESET_DRINKS: PresetDrink[] = [
  { name: 'Beer (Domestic)', priceCents: 500 },
  { name: 'Beer (Import)', priceCents: 700 },
  { name: 'Beer (Craft)', priceCents: 800 },
  { name: 'Light Beer', priceCents: 500 },
  { name: 'IPA', priceCents: 800 },
  { name: 'Hard Seltzer', priceCents: 600 },
  { name: 'Hard Cider', priceCents: 700 },
  { name: 'House Wine (Glass)', priceCents: 800 },
  { name: 'Red Wine (Glass)', priceCents: 900 },
  { name: 'White Wine (Glass)', priceCents: 900 },
  { name: 'Prosecco (Glass)', priceCents: 1000 },
  { name: 'Margarita', priceCents: 1200 },
  { name: 'Mojito', priceCents: 1200 },
  { name: 'Rum & Coke', priceCents: 1000 },
  { name: 'Vodka Soda', priceCents: 1000 },
  { name: 'Gin & Tonic', priceCents: 1000 },
  { name: 'Whiskey (Shot)', priceCents: 800 },
  { name: 'Tequila (Shot)', priceCents: 800 },
  { name: 'Vodka (Shot)', priceCents: 700 },
  { name: 'Long Island Iced Tea', priceCents: 1400 },
  { name: 'Old Fashioned', priceCents: 1300 },
  { name: 'Moscow Mule', priceCents: 1200 },
  { name: 'Espresso Martini', priceCents: 1400 },
  { name: 'Soda', priceCents: 200 },
  { name: 'Juice', priceCents: 300 },
  { name: 'Water (Bottle)', priceCents: 200 },
  { name: 'Energy Drink', priceCents: 500 },
  { name: 'Coffee', priceCents: 300 },
  { name: 'Iced Tea', priceCents: 300 },
  { name: 'Lemonade', priceCents: 300 },
];

export default PRESET_DRINKS;
