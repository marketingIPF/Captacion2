import { ClipboardList, FileText, User } from "lucide-react";

const ITEMS = [
  { k: "ficha", l: "Ficha", icon: ClipboardList },
  { k: "historial", l: "Historial", icon: FileText },
  { k: "perfil", l: "Perfil", icon: User },
];

export function BottomNav({ tab, setTab, badge = 0 }) {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-xl border-t border-ios-borde flex justify-around pt-2 px-4 z-40"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
    >
      {ITEMS.map((it) => {
        const Icon = it.icon;
        const act = tab === it.k;
        return (
          <button
            key={it.k}
            type="button"
            onClick={() => setTab(it.k)}
            aria-current={act ? "page" : undefined}
            className={`relative flex flex-col items-center gap-0.5 flex-1 py-1 active:scale-90 transition ${
              act ? "text-rk-naranja" : "text-ios-texto3"
            }`}
          >
            <Icon size={23} strokeWidth={act ? 2.5 : 2} aria-hidden="true" />
            <span className="text-[11px] font-semibold">{it.l}</span>
            {it.k === "historial" && badge > 0 && (
              <span className="absolute top-0 right-[22%] min-w-[16px] h-4 px-1 rounded-full bg-rk-naranja text-white text-[10px] font-bold flex items-center justify-center">
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
