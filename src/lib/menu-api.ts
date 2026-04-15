export interface ApiMenuVariant {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  sortOrder: number;
  isDefault: boolean;
}

export interface ApiMenuProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  variants: ApiMenuVariant[];
}

export interface ApiMenuCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  products: ApiMenuProduct[];
}

export interface ApiMenuBeverage {
  id: string;
  name: string;
  slug: string;
  priceCents: number | null;
  sortOrder: number;
  isActive: boolean;
  isMenuEligible: boolean;
}

export interface ApiSiteSettings {
  restaurantName: string;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  legalName: string | null;
  vatNumber: string | null;
}

export interface ApiDeliverySettings {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  deliveryZoneLabel: string | null;
}

export interface ApiOpeningHour {
  dayKey: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface PublicMenuResponse {
  ok: boolean;
  data: {
    categories: ApiMenuCategory[];
    beverages: ApiMenuBeverage[];
    siteSettings: ApiSiteSettings | null;
    deliverySettings: ApiDeliverySettings | null;
    openingHours: ApiOpeningHour[];
  };
}

export async function fetchPublicMenu(): Promise<PublicMenuResponse["data"]> {
  const response = await fetch("/api/public/menu", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch public menu: ${response.status}`);
  }

  const json = (await response.json()) as PublicMenuResponse;

  if (!json.ok || !json.data) {
    throw new Error("Invalid public menu response");
  }

  return json.data;
}

export function formatPriceFromCents(priceCents: number): string {
  return (priceCents / 100).toFixed(2).replace(".", ",") + "€";
}