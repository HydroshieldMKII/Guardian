import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";

function DashboardWrapper() {
  return <Dashboard />;
}

export default function Home() {
  return (
    <Suspense fallback={<></>}>
      <DashboardWrapper />
    </Suspense>
  );
}
