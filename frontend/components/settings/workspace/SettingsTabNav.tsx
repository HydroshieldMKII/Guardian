import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SETTINGS_TABS,
  settingsTab,
  type SettingsTabId,
} from "@/components/settings/settings-tabs";

interface SettingsTabNavProps {
  activeTab: SettingsTabId;
  onSelect: (value: string) => void;
}

export function SettingsTabNav({ activeTab, onSelect }: SettingsTabNavProps) {
  return (
    <>
      <Select value={activeTab} onValueChange={onSelect}>
        <SelectTrigger
          aria-label="Settings section"
          className="w-full cursor-pointer md:hidden"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SETTINGS_TABS.map((tab) => (
            <SelectItem key={tab.id} value={tab.id}>
              {tab.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <TabsList className="hidden h-auto w-full justify-start gap-1 rounded-none border-b bg-transparent p-0 md:flex">
        {SETTINGS_TABS.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="relative -mb-px cursor-pointer rounded-none rounded-t-md px-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-accent pb-3 pt-1.5 text-muted-foreground transition-colors duration-200 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-foreground after:transition-transform after:duration-200 hover:text-foreground data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:ring-0 dark:data-[state=active]:bg-accent data-[state=active]:after:scale-x-100 motion-reduce:after:transition-none"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <p className="mt-5 text-sm text-muted-foreground">
        {settingsTab(activeTab).description}
      </p>
    </>
  );
}
