import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FungoCord — sua comunidade em um só lugar",
  description: "Mensagens, chamadas, câmera e compartilhamento de tela em um aplicativo rápido e independente.",
  icons: { icon: "/fungocord.png", apple: "/fungocord.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
