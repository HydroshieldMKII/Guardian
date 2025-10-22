"use client";

import { useRouter } from "next/navigation";
import Settings from "@/components/settings";

export default function SettingsPage() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return <Settings onBack={handleBack} />;
}
