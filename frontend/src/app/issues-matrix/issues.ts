export type Issue = {
  id: string;
  title: string;
  category: string;
};

export const ISSUES: Issue[] = [
  { id: "1", title: "إعادة الإعمار", category: "اقتصاد" },
  { id: "2", title: "العدالة الانتقالية", category: "سياسة" },
  { id: "3", title: "التعليم", category: "خدمات" },
  { id: "4", title: "الكهرباء والطاقة", category: "بنية تحتية" },
  { id: "5", title: "الصحة", category: "خدمات" },
  { id: "6", title: "اللاجئون والعودة", category: "اجتماعي" },
];
