/**
 * Каталог: главный экран Mini App.
 */
export interface CatalogProduct {
  id: string;
  category: string;
  title: string;
  price: number;
  was?: number;
  tag?: string;
  tagTone?: "new" | "sale" | "soft" | "neutral" | "outline";
  sizes?: string;
  soldOut?: boolean;
  lowStock?: boolean;
}
export interface CatalogCategory {
  key: string;
  label: string;
}
export interface CatalogScreenProps {
  products?: CatalogProduct[];
  categories?: CatalogCategory[];
  activeCategory?: string;
  onCategoryChange?: (key: string) => void;
  favourites?: Set<string>;
  onFavourite?: (id: string) => void;
  onProductClick?: (id: string) => void;
  cartCount?: number;
  activeTab?: string;
  onTabChange?: (key: string) => void;
  onSearch?: () => void;
  onCartClick?: () => void;
  style?: React.CSSProperties;
}
export function CatalogScreen(props: CatalogScreenProps): JSX.Element;
