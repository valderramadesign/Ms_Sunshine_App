import { useState } from "react";
import { useLocation } from "wouter";
import BottomCTA from "@/components/BottomCTA";
import { motion, AnimatePresence } from "framer-motion";
import { useActivity, formatTime, buildSummary } from "@/lib/activityStore";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSchoolLogo } from "@/lib/useSchoolLogo";

type Item = { id: string; name: string };

const defaultItems: Item[] = [
  { id: "banana",         name: "banana" },
  { id: "bagel",          name: "bagel + cream cheese" },
  { id: "bowl-bananas",   name: "bowl of bananas" },
  { id: "bowl-berries",   name: "bowl of berries" },
  { id: "bowl-pasta",     name: "bowl of pasta" },
  { id: "bowl-rice",      name: "bowl of rice" },
  { id: "buttered-bread", name: "buttered bread" },
  { id: "pb-sandwich",    name: "peanut butter sandwich" },
  { id: "plain-bread",    name: "plain bread" },
  { id: "plum-jam",       name: "plum jam sandwich" },
  { id: "toast-jam",      name: "toast + plum jam" },
  { id: "quesadilla",     name: "quesadilla" },
];

const STEP = 0.25;

function formatQty(qty: number): string {
  const r = Math.round(qty * 100) / 100;
  if (r === 0.25) return "¼";
  if (r === 0.5)  return "½";
  if (r === 0.75) return "¾";
  if (r % 1 === 0) return String(r);
  return r.toFixed(2).replace(/\.?0+$/, "");
}

export const SelectItems = (): JSX.Element => {
  const [items, setItems] = useState<Item[]>(defaultItems);
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [itemNameError, setItemNameError] = useState(false);
  const [, setLocation] = useLocation();
  const logoSrc = useSchoolLogo();
  const { selectedChildren, selectedChildIds, setSelectedItems, setActivityTime, setCreatedActivityIds } = useActivity();

  const select = (id: string) => {
    setQuantities((prev) => {
      if (prev.has(id)) return prev;
      const next = new Map(prev);
      next.set(id, 0.5);
      return next;
    });
  };

  const deselect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuantities((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const increment = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuantities((prev) => {
      const next = new Map(prev);
      const current = next.get(id) ?? 0;
      next.set(id, Math.round((current + STEP) * 100) / 100);
      return next;
    });
  };

  const decrement = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuantities((prev) => {
      const next = new Map(prev);
      const current = next.get(id) ?? 0;
      const updated = Math.round((current - STEP) * 100) / 100;
      if (updated <= 0) next.delete(id);
      else next.set(id, updated);
      return next;
    });
  };

  const closeAddItemDialog = () => {
    setShowAddDialog(false);
    setNewItemName("");
    setItemNameError(false);
  };

  const hasSelection = quantities.size > 0;

  return (
    <div className="flex flex-col h-dvh items-center relative overflow-hidden bg-[#f5f5f5]">

      {/* Add-item dialog */}
      {showAddDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={closeAddItemDialog}
        >
          <div
            className="relative flex flex-col gap-[20px] rounded-[20px] bg-white mx-[24px] w-full max-w-[354px] p-[28px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Heading row */}
            <div className="flex items-center justify-between">
              <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#7a3428] text-[22px] leading-[normal] tracking-[-0.5px] m-0">
                add an item
              </p>
              <button
                className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-white border-none cursor-pointer p-0 flex-shrink-0 shadow-[0px_1px_3px_rgba(0,0,0,0.08)]"
                onClick={closeAddItemDialog}
                aria-label="Close"
              >
                <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="#288899" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Item name field */}
            <div className="flex flex-col gap-[6px]">
              <label className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#41444b] text-[14px] leading-[normal] tracking-[0.3px]">item name</label>
              <input
                data-testid="input-new-item-name"
                type="text"
                placeholder="e.g. apple slices"
                value={newItemName}
                style={{ borderColor: itemNameError ? "#e53e3e" : undefined }}
                onChange={(e) => { setNewItemName(e.target.value); if (itemNameError) setItemNameError(false); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (!newItemName.trim()) { setItemNameError(true); return; }
                    const id = newItemName.trim().toLowerCase().replace(/\s+/g, "-");
                    setItems((prev) => [...prev, { id, name: newItemName.trim() }]);
                    closeAddItemDialog();
                  }
                }}
                autoFocus
                className="w-full rounded-[12px] border border-[#e0d9cc] bg-white px-[16px] py-[12px] text-[16px] text-[#41444b] placeholder-[#41444b]/40 outline-none focus:border-[#41444b] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-normal"
              />
              {itemNameError && (
                <p className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#e53e3e] text-[13px] font-normal m-0 mt-[-2px]">Enter a item name</p>
              )}
            </div>

            {/* CTA */}
            <button
              data-testid="btn-confirm-add-item"
              className="w-full h-[44px] rounded-[50px] flex items-center justify-center cursor-pointer mt-[4px] bg-white border border-[#f0f0f0] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)]"
              onClick={() => {
                if (!newItemName.trim()) { setItemNameError(true); return; }
                const id = newItemName.trim().toLowerCase().replace(/\s+/g, "-");
                setItems((prev) => [...prev, { id, name: newItemName.trim() }]);
                closeAddItemDialog();
              }}
            >
              <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[24px] font-semibold leading-[normal]">
                Add Item
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Header — Ms.Sunshine logo + title row */}
      <div className="flex flex-col items-center w-full flex-shrink-0 pt-[32px]">
        <img
          src={logoSrc}
          alt="Ms. Sunshine"
          data-testid="img-select-items-logo"
          className="w-[210px] h-auto object-contain"
        />
        <div className="flex w-full items-baseline justify-between px-[24px] mt-[18px] mb-[8px]">
          <div className="flex items-baseline gap-[12px]">
            <button
              data-testid="button-back"
              onClick={() => setLocation("/select-children")}
              className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-white border-none cursor-pointer p-0 flex-shrink-0 shadow-[0px_1px_3px_rgba(0,0,0,0.08)] self-center"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M9 15L4 10L9 5" stroke="#41444B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="4" y1="10" x2="16" y2="10" stroke="#41444B" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[32px] tracking-[-0.50px] leading-[normal] whitespace-nowrap text-[#7a3428]">
              meals
            </span>
          </div>
          <button
            data-testid="button-add-item"
            onClick={() => { setNewItemName(""); setShowAddDialog(true); }}
            className="bg-transparent border-none cursor-pointer p-0"
          >
            <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] font-semibold text-[#3e983a] text-[16px] leading-[18px] whitespace-nowrap">
              + add item
            </span>
          </button>
        </div>
      </div>

      {/* Items grid — 3 columns */}
      <div className="flex-1 overflow-y-auto w-full">
      <div className={`grid grid-cols-3 gap-x-[15px] gap-y-[16px] w-full px-[24px] ${hasSelection ? "pb-[160px]" : "pb-[26px]"} content-start`}>
        {items.map((item) => {
          const qty = quantities.get(item.id) ?? 0;
          const isSelected = qty > 0;

          return (
            <div
              key={item.id}
              data-testid={`card-item-${item.id}`}
              onClick={() => select(item.id)}
              className={`relative cursor-pointer w-full aspect-square rounded-[15px] bg-white shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)] border border-solid overflow-hidden ${
                isSelected ? "border-[#41444b]" : "border-[#f0f0f0]"
              }`}
            >
              {/* Text wrapper — normal flow so webkit-line-clamp works on Safari */}
              <div
                className="pt-[12px] px-[12px]"
                onClick={isSelected ? (e) => deselect(item.id, e) : undefined}
              >
                <div
                  className="text-[14px] leading-[16px] font-semibold not-italic text-[#41444b] [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica]"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  } as React.CSSProperties}
                >
                  {item.name}
                </div>
              </div>

              {/* Counter row — visible only when selected */}
              {isSelected && (
                <div
                  className="absolute bottom-0 left-0 right-0 flex border-t border-[#e8e8e8]"
                  style={{ height: "26%" }}
                >
                  {/* Minus */}
                  <button
                    className="flex-1 flex items-center justify-center border-none bg-transparent cursor-pointer p-0 [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[16px] font-semibold"
                    style={{ lineHeight: 1, transform: 'translateY(-2px)' }}
                    onClick={(e) => decrement(item.id, e)}
                    data-testid={`btn-decrement-${item.id}`}
                  >
                    −
                  </button>
                  {/* Vertical divider */}
                  <div className="w-px bg-[#e8e8e8] self-stretch" />
                  {/* Qty */}
                  <div
                    className="flex-1 flex items-center justify-center bg-white [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#41444b] text-[16px] font-semibold"
                    style={{ lineHeight: 1 }}
                  >
                    {formatQty(qty)}
                  </div>
                  {/* Vertical divider */}
                  <div className="w-px bg-[#e8e8e8] self-stretch" />
                  {/* Plus */}
                  <button
                    className="flex-1 flex items-center justify-center border-none bg-transparent cursor-pointer p-0 [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[16px] font-semibold"
                    style={{ lineHeight: 1, transform: 'translateY(-2px)' }}
                    onClick={(e) => increment(item.id, e)}
                    data-testid={`btn-increment-${item.id}`}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* Bottom CTA — slides up when ≥1 item selected */}
      <AnimatePresence>
        {hasSelection && (
          <motion.div
            initial={{ y: 200 }}
            animate={{ y: 0 }}
            exit={{ y: 200 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 h-[134px] z-10 pointer-events-auto"
          >
            <BottomCTA>
              <button
                data-testid="button-continue"
                className="w-full h-[44px] rounded-[50px] flex items-center justify-center cursor-pointer bg-white border border-[#f0f0f0] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.06)]"
                onClick={async () => {
                  const selected = items
                    .filter((item) => quantities.has(item.id))
                    .map((item) => ({ name: item.name, qty: quantities.get(item.id)! }));
                  const timeStr = formatTime(new Date());
                  setSelectedItems(selected);
                  setActivityTime(timeStr);
                  const texts: Record<string, string> = {};
                  for (let i = 0; i < selectedChildIds.length; i++) {
                    texts[selectedChildIds[i]] = buildSummary([selectedChildren[i]], selected, timeStr);
                  }
                  try {
                    const res = await apiRequest("POST", "/api/activities", {
                      childIds: selectedChildIds,
                      texts,
                      time: timeStr,
                    });
                    const created = await res.json();
                    setCreatedActivityIds(created.map((a: { id: string }) => a.id));
                    for (const cid of selectedChildIds) {
                      queryClient.invalidateQueries({ queryKey: ["/api/activities", cid] });
                    }
                  } catch (err) {
                    console.error("Failed to save activity:", err);
                  }
                  setLocation("/add-note");
                }}
              >
                <span className="[font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[24px] font-semibold leading-[normal]">
                  Continue
                </span>
              </button>
              <button
                data-testid="button-cancel"
                className="bg-transparent border-none cursor-pointer [font-family:'SF_Pro_Rounded-Semibold','M_PLUS_Rounded_1c',Helvetica] text-[#3e983a] text-[21px] font-semibold leading-[normal]"
                onClick={() => setLocation("/home")}
              >
                Cancel
              </button>
            </BottomCTA>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
