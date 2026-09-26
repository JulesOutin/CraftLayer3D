export type PricingSettings = {
  id: number;
  machine_rate_per_hour: number;
  labor_rate_per_hour: number;
  failure_rate: number;
  packaging_cost: number;
  margin_multiplier: number;
  vat_rate: number;
  rounding_step: number;
  min_price: number;
  shipping_flat_rate: number;
  free_shipping_from: number | null;
};

export type Material = {
  id: string;
  name: string;
  price_per_kg: number;
  active: boolean;
};

export type Variant = {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  material_id: string;
  grams: number;
  print_minutes: number;
  labor_minutes: number;
  price_override: number | null;
  price: number;
  stock_quantity: number | null;
  active: boolean;
  position: number;
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  active: boolean;
};

export type ProductWithVariants = Product & { variants: Variant[] };

export type ShippingRate = {
  id: string;
  country: string;
  max_grams: number | null;
  price: number;
};

export type RelayPoint = {
  id: string;
  name: string;
  address1: string;
  address2?: string;
  postcode: string;
  city: string;
  country: string;
};

export type OrderStatus = "paid" | "printing" | "shipped" | "delivered" | "cancelled";

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "paid", label: "Payée, à imprimer" },
  { value: "printing", label: "En impression" },
  { value: "shipped", label: "Expédiée" },
  { value: "delivered", label: "Livrée" },
  { value: "cancelled", label: "Annulée" },
];
