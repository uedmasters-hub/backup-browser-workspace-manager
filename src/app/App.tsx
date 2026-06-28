import { useEffect } from "react";

import Header from "../components/popup/Header";
import WindowSection from "../components/popup/WindowSection";
import SearchPanel from "../components/popup/search/SearchPanel";

import {
  MoveTabsDialog,
  GroupTabsDialog,
  ColorPickerDialog,
  EmojiPickerDialog,
} from "../components/popup/dialogs";

import ProviderRegistry from "../search/providers/ProviderRegistry";

import { registerWindowEvents } from "../browser/events/windowEvents";

import { useSearchStore } from "../stores/searchStore";

export default function App() {
  const query = useSearchStore((state) => state.query);
  const focused = useSearchStore((state) => state.focused);

  const showSearch = query.trim().length > 0 || focused;

  useEffect(() => {
    ProviderRegistry.initialize();

    // Keep the window list live while the popup is open.
    if (typeof chrome !== "undefined" && chrome.windows) {
      return registerWindowEvents();
    }
  }, []);

  return (
    <>
      <main className="flex h-[600px] w-[420px] flex-col overflow-hidden bg-[#F6F7FB]">
        <Header />

        <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {showSearch ? <SearchPanel /> : <WindowSection />}
        </section>
      </main>

      <MoveTabsDialog />

      <GroupTabsDialog />

      <ColorPickerDialog />

      <EmojiPickerDialog />
    </>
  );
}
