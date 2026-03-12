export default function PacientesLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col w-full h-full max-w-7xl mx-auto">
      {children}
    </section>
  );
}
