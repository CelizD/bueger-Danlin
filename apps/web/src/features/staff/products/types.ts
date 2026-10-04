export type AdminProductImage = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: "COMBO" | "BEVERAGE" | "ADD_ON";
  priceCents: number;
  active: boolean;
  imageMimeType: string | null;
  imagePath: string | null;
  updatedAt: string;
};
