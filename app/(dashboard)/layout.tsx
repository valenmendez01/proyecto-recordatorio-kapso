// app/(dashboard)/layout.tsx
import FacebookSDK from "@/components/calendar/components/FacebookSDK";
import { Navbar } from "@/components/navbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <FacebookSDK />
      <div className="relative flex flex-col h-screen overflow-hidden">
      <Navbar />
      <main className="container mx-auto max-w-7xl pt-6 px-6 flex-grow flex flex-col overflow-y-auto pb-6">
        {children}
      </main>
    </div>
    </section>
  );
}