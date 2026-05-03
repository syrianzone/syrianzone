import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

// import { AuthProvider } from "@/context/AuthContext";
// import axios from '@/lib/axios'; // No longer needed here if we rely on AuthProvider or page-level fetches

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "المساحة السورية | Syrian Zone",
    template: "%s | المساحة السورية"
  },
  description: "المنصة الشاملة للمحتوى السوري",
  icons: {
    icon: "/assets/favicon.png",
    shortcut: "/assets/favicon.png",
    apple: "/assets/favicon.png",
  },
  openGraph: {
    title: "المساحة السورية | Syrian Zone",
    description: "المنصة الشاملة للمحتوى السوري",
    url: "https://syrian.zone",
    siteName: "المساحة السورية",
    images: [
      {
        url: "/assets/thumbnail.jpg",
        width: 1200,
        height: 630,
        alt: "المساحة السورية",
      },
    ],
    locale: "ar_SY",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "المساحة السورية | Syrian Zone",
    description: "المنصة الشاملة للمحتوى السوري",
    images: ["/assets/thumbnail.jpg"],
  },
};

import { AuthProvider } from "@/context/AuthContext";
import ConditionalLayout from "@/components/ConditionalLayout";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>

        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@100;200;300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/styles/theme.css" />
        {/* startpage/style.css is now loaded only on the homepage to avoid style conflicts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('sz-theme');if(!s){var sp=localStorage.getItem('startpage-settings');if(sp){s=(JSON.parse(sp)||{}).theme}};document.documentElement.setAttribute('data-theme', s||'dark');}catch(e){}})();`
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-K4H98TC203"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-K4H98TC203');
          `}
        </Script>
        <AuthProvider>
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
        </AuthProvider>
      </body>
    </html >
  );
}
