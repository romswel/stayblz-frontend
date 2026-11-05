import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ppContent } from "./productContent";
export interface CartItem {
  productId: string;
  kind: "card" | "day-pass" | "history";
  date: string;
  track: string;
  horseId: string;
  horseName: string;
}
const kinds = ["card", "day-pass", "history"];
const validDate = (value: string) =>
  value === "" ||
  (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value);
function valid(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as CartItem;
  return (
    typeof item.productId === "string" &&
    Object.hasOwn(ppContent, item.productId) &&
    kinds.includes(item.kind) &&
    ppContent[item.productId].mode !== "workspace" &&
    (item.kind !== "day-pass" ||
      ["racecard", "detailed-racecard", "form-comparison"].includes(
        item.productId,
      )) &&
    [item.date, item.track, item.horseId, item.horseName].every(
      (v) => typeof v === "string" && v.length <= 250,
    ) &&
    validDate(item.date) &&
    (item.kind === "history"
      ? item.productId === "horse-history" && !!item.horseId && !!item.horseName
      : item.productId !== "horse-history" && !!item.date) &&
    (item.kind !== "card" || !!item.track)
  );
}
export const cartKey = (item: CartItem) =>
  JSON.stringify([
    item.productId,
    item.kind,
    item.date,
    item.track,
    item.horseId,
  ]);
interface CartState {
  items: CartItem[];
  add: (items: CartItem[]) => void;
  remove: (key: string) => void;
  clear: () => void;
  storageError: boolean;
  catalogueChanged: boolean;
}
const CartContext = createContext<CartState | null>(null);
export function CartProvider({
  accountId,
  children,
}: {
  accountId: string;
  children: ReactNode;
}) {
  const key = `stayblz.cart-preview.v2.${accountId}`;
  const [restored] = useState(() => {
    try {
      const current = sessionStorage.getItem(key);
      if (current === null) {
        const old: unknown = JSON.parse(
          sessionStorage.getItem(`stayblz.cart-preview.${accountId}`) ?? "[]",
        );
        return {
          items: [] as CartItem[],
          catalogueChanged: Array.isArray(old) && old.length > 0,
        };
      }
      const data: unknown = JSON.parse(current);
      return {
        items: Array.isArray(data)
          ? [
              ...new Map(
                data
                  .filter(valid)
                  .slice(0, 40)
                  .map((item) => [cartKey(item), item]),
              ).values(),
            ]
          : [],
        catalogueChanged: false,
      };
    } catch {
      return { items: [] as CartItem[], catalogueChanged: false };
    }
  });
  const [items, setItems] = useState<CartItem[]>(restored.items);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(items));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [items, key]);
  return (
    <CartContext.Provider
      value={{
        items,
        storageError,
        catalogueChanged: restored.catalogueChanged,
        add: (incoming) =>
          setItems((previous) =>
            [
              ...new Map(
                [...previous, ...incoming.filter(valid)].map((i) => [
                  cartKey(i),
                  i,
                ]),
              ).values(),
            ].slice(0, 40),
          ),
        remove: (id) =>
          setItems((previous) => previous.filter((i) => cartKey(i) !== id)),
        clear: () => setItems([]),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("CartProvider is required");
  return value;
}
