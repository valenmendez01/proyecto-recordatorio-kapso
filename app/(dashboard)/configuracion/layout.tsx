import { ScrollShadow } from "@heroui/scroll-shadow";

export default function ConfigLayout({ children }: { children: React.ReactNode }) {
  return (
    <ScrollShadow className="flex flex-col w-full h-full max-w-7xl mx-auto" orientation="vertical">
      {children}
    </ScrollShadow>
  );
}
