import { createContext, useContext, useState, ReactNode } from "react";

export type SelectedItem = { name: string; qty: number };

type ActivityState = {
  activityType: string;
  selectedChildren: string[];
  selectedChildIds: string[];
  selectedItems: SelectedItem[];
  activityTime: string;
  createdActivityIds: string[];
  preSelectedChildId: string | null;
  preSelectedChildName: string | null;
  setActivityType: (type: string) => void;
  setSelectedChildren: (names: string[]) => void;
  setSelectedChildIds: (ids: string[]) => void;
  setSelectedItems: (items: SelectedItem[]) => void;
  setActivityTime: (time: string) => void;
  setCreatedActivityIds: (ids: string[]) => void;
  setPreSelectedChild: (id: string | null, name: string | null) => void;
};

const ActivityContext = createContext<ActivityState | null>(null);

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [activityType, setActivityType] = useState<string>("");
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [activityTime, setActivityTime] = useState<string>("");
  const [createdActivityIds, setCreatedActivityIds] = useState<string[]>([]);
  const [preSelectedChildId, setPreSelectedChildIdState] = useState<string | null>(null);
  const [preSelectedChildName, setPreSelectedChildNameState] = useState<string | null>(null);

  const setPreSelectedChild = (id: string | null, name: string | null) => {
    setPreSelectedChildIdState(id);
    setPreSelectedChildNameState(name);
  };

  return (
    <ActivityContext.Provider
      value={{ activityType, selectedChildren, selectedChildIds, selectedItems, activityTime, createdActivityIds, preSelectedChildId, preSelectedChildName, setActivityType, setSelectedChildren, setSelectedChildIds, setSelectedItems, setActivityTime, setCreatedActivityIds, setPreSelectedChild }}
    >
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity must be used within ActivityProvider");
  return ctx;
}

export function formatTime(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const mm = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${mm} ${ampm}`;
}

function startsWithVowel(s: string) {
  return /^[aeiou]/i.test(s);
}

function qtyWord(qty: number, itemName: string): string {
  const needsArticle = (base: string) =>
    startsWithVowel(itemName) ? `${base}n` : base;

  if (qty === 0.25) return `a quarter of ${needsArticle("a")}`;
  if (qty === 0.5)  return `half ${needsArticle("a")}`;
  if (qty === 0.75) return `three quarters of ${needsArticle("a")}`;
  if (qty === 1)    return needsArticle("a");
  if (qty === 1.5)  return "one and a half";
  if (qty === 2)    return "two";
  if (qty === 2.5)  return "two and a half";
  if (qty === 3)    return "three";
  return `${qty}`;
}

function joinList(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function buildSummary(
  children: string[],
  items: SelectedItem[],
  time: string
): string {
  const firstNames = children.map((n) => n.split(" ")[0]);
  const childStr = joinList(firstNames);

  const itemParts = items.map((item) => {
    const cleanName = item.name.replace(/\n/g, " ");
    return `${qtyWord(item.qty, cleanName)} ${cleanName}`;
  });
  const itemStr = joinList(itemParts);

  return `${childStr} ate ${itemStr}.`;
}
