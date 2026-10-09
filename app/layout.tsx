import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
title: "MÜZİK MERKEZİ PRO",
description: "Müzik ara, önizlemeleri dinle ve kendi izinli ses bağlantılarını oynat.",
applicationName: "MÜZİK MERKEZİ PRO",
manifest: "/manifest.webmanifest",
appleWebApp: {
capable: true,
statusBarStyle: "black-translucent",
title: "Müzik Merkezi"
},
icons: {
icon: "/icon.svg",
apple: "/icon.svg"
}
};

export const viewport: Viewport = {
themeColor: "#0b0b12",
width: "device-width",
initialScale: 1,
viewportFit: "cover"
};

export default function RootLayout({
children
}: Readonly<{ children: React.ReactNode }>) {
return (
<html lang="tr">
<body>{children}</body>
</html>
);
}
