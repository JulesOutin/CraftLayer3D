export const SHOP = {
  name: "CraftLayer3D",
  tagline: "Objets imprimés en 3D à la commande",
  // Délai affiché sur les fiches (impression à la demande)
  leadTime: "Imprimé et expédié sous 3 à 5 jours ouvrés",
  contactEmail: "contact@exemple.fr",
  shippingCountries: ["FR", "BE", "LU", "CH", "MC"] as const,
  // Pays où la livraison en point relais est possible (les autres : domicile uniquement)
  relayCountries: ["FR", "BE", "LU"] as const,
};
