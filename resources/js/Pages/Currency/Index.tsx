import { Head } from "@inertiajs/react";
import { BadgeDollarSign, Landmark, ShieldCheck } from "lucide-react";
import MainLayout from "@/Layouts/MainLayout";
import CurrencyConverter from "./CurrencyConverter";

export default function CurrencyPage() {
  return (
    <MainLayout>
      <Head>
        <title>محوّل العملات السورية | Syrian Zone</title>
        <meta
          name="description"
          content="حوّل الليرة السورية إلى العملات العالمية باستخدام أسعار صرف مرجعية يومية من مصادر بنوك مركزية."
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:title"
          content="محوّل العملات السورية | Syrian Zone"
        />
        <meta
          property="og:description"
          content="أداة مبسطة لتحويل الليرة السورية إلى العملات العالمية وفق أحدث سعر مرجعي متاح."
        />
      </Head>

      <main
        dir="rtl"
        className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_15%_15%,hsl(var(--primary)/0.13),transparent_28%),radial-gradient(circle_at_85%_75%,hsl(var(--primary)/0.07),transparent_26%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:32px_32px]"
        />

        <div className="container relative mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
          <header className="mx-auto mb-10 max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              <BadgeDollarSign className="h-4 w-4" />
              أداة من المساحة السورية
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              محوّل العملات
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-8 text-muted-foreground md:text-lg">
              حوّل أي مبلغ من الليرة السورية إلى العملات العالمية وفق أحدث سعر
              متاح.
            </p>
          </header>

          <CurrencyConverter />

          <section className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm">
              <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  سعر مرجعي يومي
                </h2>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  البيانات مجمّعة من مصادر وبنوك مركزية، وليست سعراً لحظياً
                  للتداول.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  للاسترشاد فقط
                </h2>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  قد يختلف السعر الفعلي في السوق المحلية أو عند المصارف وشركات
                  الصرافة.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </MainLayout>
  );
}
