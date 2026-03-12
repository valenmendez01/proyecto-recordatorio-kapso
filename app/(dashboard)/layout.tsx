// app/(dashboard)/layout.tsx
import { Navbar } from "@/components/navbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-col h-screen overflow-hidden"> {/* Añadido h-screen y overflow-hidden */}
      <Navbar />
      {/* Añadido flex flex-col y pb-6 para compensar el pt-6 */}
      <main className="container mx-auto max-w-7xl pt-6 px-6 flex-grow flex flex-col overflow-hidden pb-6">
        {children}
      </main>
    </div>
  );
}