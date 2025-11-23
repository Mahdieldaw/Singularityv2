import { getProviderById } from "../providers/providerRegistry";

export const ProviderPill = ({ id }: { id: string }) => {
  // Local fallback map for known providers; registry is authoritative if present
  const fallback = {
    chatgpt: { emoji: "🟢", name: "ChatGPT" },
    claude: { emoji: "🟠", name: "Claude" },
    gemini: { emoji: "🔵", name: "Gemini" },
    qwen: { emoji: "🤖", name: "Qwen" },
  } as Record<string, { emoji: string; name: string }>;

  const prov = getProviderById(id);
  const emoji = (prov as any)?.emoji || fallback[id]?.emoji || "🤖";
  const name = prov?.name || fallback[id]?.name || id || "Unknown";

  return (
    <span
      className="ml-auto self-end mt-2 text-[10px]
                 bg-overlay-backdrop/80 px-1.5 py-0.5
                 rounded text-text-secondary font-medium leading-[1.2]"
    >
      {emoji} {name}
    </span>
  );
};
