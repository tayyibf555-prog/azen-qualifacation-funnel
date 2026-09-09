import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";

/** azen.io's typeface, with Apple's system stack behind it. */
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Azen — what is your business still doing by hand?",
  description:
    "Ten questions, about a minute. A plain-English breakdown of the work your team no longer needs to do, and a call if it's worth building.",
  openGraph: {
    title: "What is your business still doing by hand?",
    description: "Ten questions. One minute. A straight answer.",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#020202",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={hanken.variable}>
      <body>
        {GTM_ID ? (
          <Script id="gtm" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
        ) : null}

        {META_PIXEL_ID ? (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
          </Script>
        ) : null}

        {children}
      </body>
    </html>
  );
}
