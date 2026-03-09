export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-8 w-full max-w-7xl mx-auto p-4">
      {children}
    </section>
  );
}
