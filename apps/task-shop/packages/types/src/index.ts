export type ProductCategory = "Phones" | "Laptops" | "Audio" | "Accessories" | "Tablets";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: "USD";
  image: string;
  category: ProductCategory;
  inStock: boolean;
  specs: Record<string, string>;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  currency: "USD";
  status: "confirmed" | "processing" | "shipped" | "delivered";
  createdAt: string;
}

export interface CatalogData {
  products: Product[];
}

export interface CartData {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

export const products: Product[] = [
  {
    id: "iphone-15",
    name: "iPhone 15 Pro",
    description: "A17 Pro chip. Titanium design. 48MP camera system. USB-C.",
    price: 999,
    currency: "USD",
    image: "/products/iphone-15.png",
    category: "Phones",
    inStock: true,
    specs: { "Display": "6.1\" OLED", "Chip": "A17 Pro", "Storage": "256GB", "Camera": "48MP" }
  },
  {
    id: "samsung-s24",
    name: "Samsung Galaxy S24 Ultra",
    description: "Galaxy AI. Titanium frame. 200MP camera. Built-in S Pen.",
    price: 1199,
    currency: "USD",
    image: "/products/samsung-s24.png",
    category: "Phones",
    inStock: true,
    specs: { "Display": "6.8\" AMOLED", "Chip": "Snapdragon 8 Gen 3", "Storage": "512GB", "Camera": "200MP" }
  },
  {
    id: "pixel-8",
    name: "Google Pixel 8 Pro",
    description: "Google AI. Best-in-class camera. 7 years of updates.",
    price: 899,
    currency: "USD",
    image: "/products/pixel-8.png",
    category: "Phones",
    inStock: true,
    specs: { "Display": "6.7\" LTPO OLED", "Chip": "Tensor G3", "Storage": "256GB", "Camera": "50MP" }
  },
  {
    id: "macbook-air",
    name: "MacBook Air M3",
    description: "Supercharged by M3. 18-hour battery. Fanless design.",
    price: 1099,
    currency: "USD",
    image: "/products/macbook-air.png",
    category: "Laptops",
    inStock: true,
    specs: { "Display": "13.6\" Liquid Retina", "Chip": "M3", "RAM": "16GB", "Storage": "512GB SSD" }
  },
  {
    id: "thinkpad-x1",
    name: "Lenovo ThinkPad X1 Carbon Gen 12",
    description: "Intel Core Ultra. 14\" 2.8K OLED. MIL-STD durability.",
    price: 1649,
    currency: "USD",
    image: "/products/thinkpad-x1.png",
    category: "Laptops",
    inStock: true,
    specs: { "Display": "14\" 2.8K OLED", "Chip": "Intel Core Ultra 7", "RAM": "32GB", "Storage": "1TB SSD" }
  },
  {
    id: "dell-xps",
    name: "Dell XPS 14",
    description: "InfinityEdge display. Intel Core Ultra. Compact powerhouse.",
    price: 1299,
    currency: "USD",
    image: "/products/dell-xps.png",
    category: "Laptops",
    inStock: false,
    specs: { "Display": "14.5\" OLED", "Chip": "Intel Core Ultra 7", "RAM": "16GB", "Storage": "512GB SSD" }
  },
  {
    id: "airpods-pro",
    name: "AirPods Pro 2",
    description: "Adaptive Audio. USB-C. Active Noise Cancellation. Spatial Audio.",
    price: 249,
    currency: "USD",
    image: "/products/airpods-pro.png",
    category: "Audio",
    inStock: true,
    specs: { "Type": "In-ear", "ANC": "Yes", "Battery": "6h + 30h case", "Connectivity": "Bluetooth 5.3" }
  },
  {
    id: "sony-xm5",
    name: "Sony WH-1000XM5",
    description: "Industry-leading ANC. 30-hour battery. Crystal clear calls.",
    price: 349,
    currency: "USD",
    image: "/products/sony-xm5.png",
    category: "Audio",
    inStock: true,
    specs: { "Type": "Over-ear", "ANC": "Yes", "Battery": "30h", "Connectivity": "Bluetooth 5.2" }
  },
  {
    id: "bose-qc",
    name: "Bose QuietComfort Ultra",
    description: "Immersive spatial audio. Premium ANC. All-day comfort.",
    price: 429,
    currency: "USD",
    image: "/products/bose-qc.png",
    category: "Audio",
    inStock: true,
    specs: { "Type": "Over-ear", "ANC": "Yes", "Battery": "24h", "Connectivity": "Bluetooth 5.3" }
  },
  {
    id: "ipad-air",
    name: "iPad Air M2",
    description: "M2 chip. 11\" Liquid Retina. Apple Pencil Pro support.",
    price: 599,
    currency: "USD",
    image: "/products/ipad-air.png",
    category: "Tablets",
    inStock: true,
    specs: { "Display": "11\" Liquid Retina", "Chip": "M2", "Storage": "128GB", "Connectivity": "Wi-Fi 6E" }
  },
  {
    id: "galaxy-tab",
    name: "Samsung Galaxy Tab S9",
    description: "Dynamic AMOLED 2X. S Pen included. IP68 water resistant.",
    price: 799,
    currency: "USD",
    image: "/products/galaxy-tab.png",
    category: "Tablets",
    inStock: true,
    specs: { "Display": "11\" AMOLED", "Chip": "Snapdragon 8 Gen 2", "Storage": "256GB", "Connectivity": "5G" }
  },
  {
    id: "magsafe-charger",
    name: "Apple MagSafe Charger",
    description: "Snap on. 15W fast wireless charging. Compact travel design.",
    price: 39,
    currency: "USD",
    image: "/products/magsafe-charger.png",
    category: "Accessories",
    inStock: true,
    specs: { "Type": "Wireless", "Power": "15W", "Compatibility": "iPhone 12+", "Cable": "1m USB-C" }
  },
  {
    id: "usb-c-hub",
    name: "Anker USB-C Hub 8-in-1",
    description: "HDMI 4K. 100W PD. SD card reader. Ethernet. USB 3.0.",
    price: 49,
    currency: "USD",
    image: "/products/usb-c-hub.png",
    category: "Accessories",
    inStock: true,
    specs: { "Ports": "HDMI, USB-C, USB-A x3, SD, Ethernet", "Power": "100W PD", "Resolution": "4K@60Hz" }
  },
  {
    id: "mech-keyboard",
    name: "Keychron K8 Pro",
    description: "Wireless mechanical keyboard. Hot-swappable. RGB backlight.",
    price: 99,
    currency: "USD",
    image: "/products/mech-keyboard.png",
    category: "Accessories",
    inStock: true,
    specs: { "Layout": "TKL", "Switches": "Gateron G Pro", "Connectivity": "Bluetooth 5.1 / USB-C", "Battery": "4000mAh" }
  }
];

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getProductsByCategory(): Record<ProductCategory, Product[]> {
  const grouped = {} as Record<string, Product[]>;
  for (const p of products) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }
  return grouped;
}

export function addToCart(items: CartItem[], product: Product, qty = 1): CartItem[] {
  const existing = items.findIndex((i) => i.productId === product.id);
  if (existing >= 0) {
    return items.map((item, idx) =>
      idx === existing ? { ...item, quantity: item.quantity + qty } : item
    );
  }
  return [...items, { productId: product.id, name: product.name, price: product.price, quantity: qty, image: product.image }];
}

export function removeFromCart(items: CartItem[], productId: string): CartItem[] {
  return items.flatMap((item) => {
    if (item.productId !== productId) return [item];
    if (item.quantity <= 1) return [];
    return [{ ...item, quantity: item.quantity - 1 }];
  });
}

export function getCartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function getCartItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function createOrder(items: CartItem[]): Order {
  return {
    id: "ORD-" + Date.now().toString(36).toUpperCase(),
    items: [...items],
    total: getCartSubtotal(items),
    currency: "USD",
    status: "confirmed",
    createdAt: new Date().toISOString()
  };
}
