import { Metadata } from "next";
import IssuesMatrixClient from "./IssuesMatrixClient";

export const metadata: Metadata = {
  title: "مصفوفة القضايا",
  description: "ترتيب القضايا السورية حسب الأولوية والأهمية",
  openGraph: {
    title: "مصفوفة القضايا | المساحة السورية",
    description: "ترتيب القضايا السورية حسب الأولوية والأهمية",
    images: ["/assets/thumbnail.jpg"],
  },
};

export default function IssuesMatrixPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      
      {/* محتوى الصفحة */}
      <IssuesMatrixClient />

      {/* Footer (نفس PartyPage تمامًا) */}
      <footer className="bg-card border-t border-border py-8 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground mb-2">
            &copy; 2025 syrian.zone
          </p>

          <p className="text-sm text-muted-foreground">
            تم التطوير بواسطة{" "}
            <span className="font-semibold text-foreground">
              هادي الأحمد
            </span>
          </p>

          <div className="flex justify-center gap-6 mt-4">
            <a
              href="https://hadealahmad.com"
              target="_blank"
              className="text-muted-foreground hover:text-primary transition-colors text-sm"
            >
              الموقع الشخصي
            </a>

            <a
              href="https://x.com/hadealahmad"
              target="_blank"
              className="text-muted-foreground hover:text-primary transition-colors text-sm"
            >
              Twitter
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
