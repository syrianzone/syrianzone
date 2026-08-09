import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CalendarDays, ExternalLink, RefreshCw } from "lucide-react";
import axios from "@/Lib/axios";
import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import type { ExchangeRate, ExchangeRatesResponse } from "./types";

const DEFAULT_AMOUNT = "100";
const DEFAULT_OTHER_CURRENCY = "JPY";
const FEATURED_CURRENCIES = ["USD", "EUR", "TRY", "SAR", "AED"] as const;
const FEATURED_CURRENCY_SET = new Set<string>(FEATURED_CURRENCIES);

// Most ISO 4217 currency codes begin with their ISO country code. These are
// the common exceptions and shared currencies that need an explicit region.
const CURRENCY_REGION_OVERRIDES: Record<string, string | null> = {
  ANG: "CW",
  CHF: "CH",
  EUR: "EU",
  GBP: "GB",
  SYP: "SY",
  USD: "US",
  XAF: null,
  XCD: null,
  XDR: null,
  XOF: null,
  XPF: "PF",
};

interface CurrencyOption {
  code: string;
  name: string;
  flag: string;
}

interface CurrencyResultProps {
  amount: number | null;
  code: string;
  isLoading: boolean;
  rate: ExchangeRate | null;
  featured?: boolean;
}

interface OtherCurrencyResultProps extends CurrencyResultProps {
  currencies: CurrencyOption[];
  onCurrencyChange: (code: string) => void;
}

function normalizeAmountInput(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(/[\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    )
    .replace(/\u066b/g, ".")
    .replace(/\u066c/g, ",");
}

function parseAmount(value: string): number | null {
  const normalized = normalizeAmountInput(value).replace(/[,\s]/g, "");

  if (normalized.trim() === "") return null;

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);
}

function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(["ar"], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function regionFlag(region: string): string {
  return [...region]
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function currencyFlag(code: string): string {
  const region = Object.prototype.hasOwnProperty.call(
    CURRENCY_REGION_OVERRIDES,
    code,
  )
    ? CURRENCY_REGION_OVERRIDES[code]
    : code.startsWith("X")
      ? null
      : code.slice(0, 2);

  return region && /^[A-Z]{2}$/.test(region) ? regionFlag(region) : "🌐";
}

function CurrencyIdentity({ code }: { code: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        className="text-2xl leading-none"
        role="img"
        aria-label={`علم عملة ${code}`}
      >
        {currencyFlag(code)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">
          {currencyName(code)}
        </span>
        <span
          className="block font-mono text-[11px] font-bold tracking-[0.16em] text-muted-foreground"
          dir="ltr"
        >
          {code}
        </span>
      </span>
    </span>
  );
}

function CurrencyResult({
  amount,
  code,
  isLoading,
  rate,
  featured = false,
}: CurrencyResultProps) {
  const convertedAmount = amount !== null && rate ? amount * rate.rate : null;

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border p-4 transition-colors sm:p-5 ${
        featured
          ? "border-border/80 bg-card hover:border-primary/40"
          : "border-primary/20 bg-primary/[0.06]"
      }`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-emerald-600 via-white to-zinc-950"
      />
      <CurrencyIdentity code={code} />

      {isLoading ? (
        <div className="mt-5 animate-pulse space-y-2">
          <div className="h-8 w-3/4 rounded bg-muted" />
          <div className="h-3 w-2/5 rounded bg-muted" />
        </div>
      ) : (
        <div className="mt-5">
          <p
            className="break-words font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl"
            dir="ltr"
          >
            {convertedAmount !== null ? formatNumber(convertedAmount) : "—"}
          </p>
          {rate ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              <span>تاريخ السعر</span>
              <span className="font-mono tabular-nums" dir="ltr">
                {rate.date}
              </span>
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}

function OtherCurrencyResult({
  amount,
  code,
  currencies,
  isLoading,
  onCurrencyChange,
  rate,
}: OtherCurrencyResultProps) {
  const convertedAmount = amount !== null && rate ? amount * rate.rate : null;

  return (
    <article className="group relative overflow-hidden rounded-2xl border-2 border-dashed border-primary/55 bg-primary/[0.06] p-4 shadow-[inset_0_0_0_1px_hsl(var(--card)/0.6)] transition-colors hover:border-primary hover:bg-primary/[0.09] dark:border-emerald-400/55 dark:bg-emerald-400/[0.08] dark:hover:border-emerald-400 dark:hover:bg-emerald-400/[0.11] sm:p-5">
      <div
        aria-hidden="true"
        className="absolute -left-10 -top-12 h-28 w-28 rounded-full bg-primary/15 blur-2xl dark:bg-emerald-400/15"
      />

      <div className="relative mb-2.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold text-primary dark:text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-primary ring-4 ring-primary/15 dark:bg-emerald-400 dark:ring-emerald-400/15" />
          اختر عملتك
        </p>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary dark:bg-emerald-400/10 dark:text-emerald-300">
          قابل للتغيير
        </span>
      </div>

      <Select
        value={code}
        onValueChange={onCurrencyChange}
        disabled={isLoading || currencies.length === 0}
      >
        <SelectTrigger
          aria-label="اختر عملة أخرى"
          className="relative h-11 w-full border-primary/35 bg-card px-2.5 shadow-sm focus:ring-primary dark:border-emerald-400/30 dark:focus:ring-emerald-400"
        >
          <SelectValue
            placeholder={isLoading ? "جاري تحميل العملات..." : "اختر عملة أخرى"}
          />
        </SelectTrigger>
        <SelectContent dir="rtl" className="max-h-80">
          {currencies.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              <span className="flex items-center gap-2.5">
                <span
                  className="text-xl leading-none"
                  role="img"
                  aria-hidden="true"
                >
                  {currency.flag}
                </span>
                <span>{currency.name}</span>
                <span
                  className="font-mono text-xs font-bold text-primary"
                  dir="ltr"
                >
                  {currency.code}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading ? (
        <div className="mt-5 animate-pulse space-y-2">
          <div className="h-8 w-3/4 rounded bg-muted" />
          <div className="h-3 w-2/5 rounded bg-muted" />
        </div>
      ) : (
        <div className="mt-5">
          <p
            className="break-words font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl"
            dir="ltr"
          >
            {convertedAmount !== null ? formatNumber(convertedAmount) : "—"}
          </p>
          {rate ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              <span>تاريخ السعر</span>
              <span className="font-mono tabular-nums" dir="ltr">
                {rate.date}
              </span>
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}

async function fetchExchangeRates(): Promise<ExchangeRatesResponse> {
  const { data } = await axios.get<ExchangeRatesResponse>(
    "/api/exchange-rates",
  );
  return data;
}

export default function CurrencyConverter() {
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [otherCurrency, setOtherCurrency] = useState(DEFAULT_OTHER_CURRENCY);

  const ratesQuery = useQuery({
    queryKey: ["exchange-rates", "SYP"],
    queryFn: fetchExchangeRates,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const otherCurrencies = useMemo<CurrencyOption[]>(() => {
    if (!ratesQuery.data) return [];

    const collator = new Intl.Collator("ar");
    return Object.keys(ratesQuery.data.rates)
      .filter((code) => !FEATURED_CURRENCY_SET.has(code))
      .map((code) => ({
        code,
        name: currencyName(code),
        flag: currencyFlag(code),
      }))
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [ratesQuery.data]);

  const parsedAmount = parseAmount(amount);
  const amountIsInvalid = amount.trim() !== "" && parsedAmount === null;
  const rates = ratesQuery.data?.rates;

  return (
    <Card className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border-border/80 bg-card/90 shadow-[0_28px_90px_-45px_hsl(var(--primary)/0.55)] backdrop-blur-xl">
      <div aria-hidden="true" className="grid h-1.5 grid-cols-3">
        <span className="bg-emerald-600" />
        <span className="bg-white" />
        <span className="bg-zinc-950" />
      </div>
      <CardContent className="space-y-5 p-5 sm:p-8">
        {ratesQuery.isError ? (
          <Alert variant="destructive">
            <RefreshCw className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <AlertTitle>تعذر تحميل أسعار الصرف</AlertTitle>
              <AlertDescription className="mt-1">
                تحقق من اتصالك ثم حاول مرة أخرى.
              </AlertDescription>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => ratesQuery.refetch()}
              >
                إعادة المحاولة
              </Button>
            </div>
          </Alert>
        ) : null}

        <section className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.06] p-3 text-foreground dark:border-white/10 dark:bg-zinc-950 dark:text-white sm:p-4">
          <div
            aria-hidden="true"
            className="absolute -left-16 -top-20 h-48 w-48 rounded-full bg-primary/15 blur-3xl dark:bg-emerald-500/15"
          />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-primary/80 dark:text-white/55">
                العملة الأساسية
              </p>
              <div className="mt-1 flex items-center gap-2.5">
                <span
                  className="text-2xl leading-none"
                  role="img"
                  aria-label="علم سوريا"
                >
                  🇸🇾
                </span>
                <div>
                  <p className="font-semibold text-foreground dark:text-white">
                    الليرة السورية
                  </p>
                  <p
                    className="font-mono text-xs font-bold tracking-[0.18em] text-muted-foreground dark:text-white/55"
                    dir="ltr"
                  >
                    SYP
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full space-y-1 sm:w-64 sm:shrink-0">
              <Label
                htmlFor="syp-amount"
                className="text-muted-foreground dark:text-white/70"
              >
                المبلغ بالليرة السورية
              </Label>
              <div className="relative">
                <Input
                  id="syp-amount"
                  value={amount}
                  onChange={(event) =>
                    setAmount(normalizeAmountInput(event.target.value))
                  }
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={amountIsInvalid}
                  aria-describedby={
                    amountIsInvalid ? "amount-error" : undefined
                  }
                  className="h-10 border-border bg-card text-left font-mono text-base font-bold text-foreground tabular-nums shadow-sm focus-visible:ring-primary dark:border-white/20 dark:bg-dark dark:text-white dark:focus-visible:ring-emerald-500"
                  dir="ltr"
                  placeholder="100"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-xs font-bold text-muted-foreground dark:text-zinc-500">
                  SYP
                </span>
              </div>
              {amountIsInvalid ? (
                <p
                  id="amount-error"
                  className="text-sm text-destructive dark:text-red-300 pt-3 font-extrabold"
                >
                  أدخل مبلغاً صحيحاً يساوي صفراً أو أكثر.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section aria-live="polite" aria-busy={ratesQuery.isPending}>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-primary">
                التحويل المباشر
              </p>
              <h3 className="mt-1 text-lg font-bold text-foreground">
                العملات الأكثر استخداماً
              </h3>
            </div>
            <span className="hidden text-xs text-muted-foreground sm:block">
              تتحدث النتائج تلقائياً
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_CURRENCIES.map((code) => (
              <CurrencyResult
                key={code}
                // make amount in 0.00 format only 2 numbers after decimal point for featured currencies
                amount={parsedAmount}
                code={code}
                isLoading={ratesQuery.isPending}
                rate={rates?.[code] ?? null}
                featured
              />
            ))}
            <OtherCurrencyResult
              amount={parsedAmount}
              code={otherCurrency}
              currencies={otherCurrencies}
              isLoading={ratesQuery.isPending}
              onCurrencyChange={setOtherCurrency}
              rate={rates?.[otherCurrency] ?? null}
            />
          </div>
        </section>

        <footer className="flex flex-col justify-between gap-3 border-t border-border/70 pt-5 text-xs leading-6 text-muted-foreground sm:flex-row sm:items-center">
          <p>
            المصدر: أسعار مرجعية مجمّعة عبر Frankfurter. قد تختلف عن أسعار السوق
            المحلية.
          </p>
          <a
            href="https://frankfurter.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
          >
            تفاصيل المصدر
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </footer>
      </CardContent>
    </Card>
  );
}
