import type React from "react"
import { useState, useEffect } from "react"
import MainLayout from "@/Layouts/MainLayout"
import { Head } from "@inertiajs/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy, Medal, Award, Users, Calendar, CalendarDays, Clock, ExternalLink } from "lucide-react"
import { Github } from "@/components/ui/icons"

interface Contributor {
  username: string
  daily_contributions: number
  monthly_contributions: number
  yearly_contributions: number
  total_contributions: number
  avatar_url: string
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="w-8 h-8 text-yellow-500" />
    case 2:
      return <Medal className="w-6 h-6 text-gray-400" />
    case 3:
      return <Award className="w-6 h-6 text-amber-600" />
    default:
      return null
  }
}

const WinnerCard = ({ contributor, metric }: { contributor: Contributor; metric: keyof Contributor }) => {
  const getMetricLabel = (metric: keyof Contributor) => {
    switch (metric) {
      case "daily_contributions":
        return "اليوم"
      case "monthly_contributions":
        return "هذا الشهر"
      case "yearly_contributions":
        return "هذا العام"
      case "total_contributions":
        return "الإجمالي"
      default:
        return "المساهمات"
    }
  }

  return (
    <div className="relative max-w-md mx-auto">
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 rounded-xl blur-sm opacity-30"></div>
      <Card className="relative bg-card/20 backdrop-blur-md border border-border/30 shadow-2xl">
        <CardContent className="p-6 text-center">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-yellow-400 rounded-full blur-md opacity-30"></div>
            <Avatar className="relative w-24 h-24 mx-auto border-[3px] border-yellow-400 shadow-lg">
              <AvatarImage src={contributor.avatar_url || "/placeholder.svg"} alt={contributor.username} />
              <AvatarFallback className="text-xl font-bold bg-yellow-100 text-yellow-800">
                {contributor.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -top-2 -start-2">
              <div className="bg-yellow-400 rounded-full p-2 shadow-lg">
                <Trophy className="w-6 h-6 text-yellow-800" />
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">{contributor.username}</h2>
          <Badge className="bg-yellow-400 text-yellow-900 text-sm px-3 py-1 mb-3">🏆 المتصدر الأول</Badge>

          <div className="bg-muted/40 backdrop-blur-sm rounded-lg p-4 mb-4 border border-border/20">
            <div className="text-3xl font-bold text-yellow-600 mb-1">{contributor[metric]}</div>
            <div className="text-sm text-muted-foreground">{getMetricLabel(metric)}</div>
          </div>

          <Button asChild
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-4 py-2 rounded-lg shadow-lg transition-all duration-200 hover:scale-105 w-full"
          >
            <a href={`https://github.com/${contributor.username}`} target="_blank" rel="noopener noreferrer">
              <Github className="w-4 h-4 me-2" />
              زيارة الملف الشخصي
              <ExternalLink className="w-3 h-3 ms-2" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

const TopThreeCard = ({
  contributors,
  title,
  metric,
  icon,
}: {
  contributors: Contributor[]
  title: string
  metric: keyof Contributor
  icon: React.ReactNode
}) => {
  const sortedContributors = [...contributors].sort((a, b) => (b[metric] as number) - (a[metric] as number))
  const winner = sortedContributors[0]
  const runnerUps = sortedContributors.slice(1, 3)

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-2 flex items-center justify-center gap-3">
          {icon}
          {title}
        </h2>
      </div>


      <div className="flex justify-center mb-8">
        <WinnerCard contributor={winner} metric={metric} />
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {runnerUps.map((contributor, index) => (
          <Card
            key={contributor.username}
            className="bg-card/20 backdrop-blur-md border border-border/30 hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            <CardContent className="p-6 text-center">
              <div className="relative mb-4">
                <Avatar className="w-20 h-20 mx-auto border-[3px] border-border shadow-lg">
                  <AvatarImage src={contributor.avatar_url || "/placeholder.svg"} alt={contributor.username} />
                  <AvatarFallback className="text-lg font-semibold">
                    {contributor.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -top-2 -start-2">{getRankIcon(index + 2)}</div>
              </div>
              <h3 className="font-bold text-xl mb-2 text-foreground">{contributor.username}</h3>
              <Badge variant="secondary" className="mb-4 bg-muted/30 backdrop-blur-sm">
                {contributor[metric]} مساهمة
              </Badge>
              <Button asChild
                variant="outline"
                size="sm"
                className="w-full bg-muted/20 backdrop-blur-sm border-border/30 hover:bg-muted/30"
              >
                <a href={`https://github.com/${contributor.username}`} target="_blank" rel="noopener noreferrer">
                  <Github className="w-4 h-4 me-2" />
                  الملف الشخصي
                  <ExternalLink className="w-3 h-3 ms-2" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

const ContributorsList = ({
  contributors,
  metric,
}: {
  contributors: Contributor[]
  metric: keyof Contributor
}) => {
  const sortedContributors = [...contributors].sort((a, b) => (b[metric] as number) - (a[metric] as number)).slice(3)

  if (sortedContributors.length === 0) {
    return null
  }

  return (
    <Card className="mt-8 bg-card/20 backdrop-blur-md border border-border/30">
      <CardHeader>
        <CardTitle className="text-xl text-foreground">باقي المساهمين</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedContributors.map((contributor, index) => (
            <div
              key={contributor.username}
              className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/20 backdrop-blur-sm transition-colors border border-border/10"
            >
              <div className="flex items-center space-x-4">
                <span className="text-lg font-bold text-muted-foreground w-8">#{index + 4}</span>
                <Avatar className="w-12 h-12">
                  <AvatarImage src={contributor.avatar_url || "/placeholder.svg"} alt={contributor.username} />
                  <AvatarFallback className="text-sm">{contributor.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{contributor.username}</p>
                  <Badge
                    variant="outline"
                    className="mt-1 bg-muted/20 backdrop-blur-sm border-border/30"
                  >
                    {contributor[metric]} مساهمة
                  </Badge>
                </div>
              </div>
              <Button asChild
                variant="ghost"
                size="sm"
                aria-label={`الملف الشخصي لـ ${contributor.username} على GitHub`}
                className="hover:bg-muted/20"
              >
                <a href={`https://github.com/${contributor.username}`} target="_blank" rel="noopener noreferrer">
                  <Github className="w-4 h-4" />
                </a>
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const PAGE_HEADING = "أفضل المساهمين في GitHub"

export default function SyrianContributorsPage({ contributors: initial = [] }: { contributors?: Contributor[] }) {
  // The list arrives with the page, so it is part of the server-rendered HTML.
  // The browser only refreshes it: at once if the server had nothing to send,
  // and then every hour for a tab left open.
  const [contributors, setContributors] = useState<Contributor[]>(initial)
  const [loading, setLoading] = useState(initial.length === 0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isEagleLogo, setIsEagleLogo] = useState(false)

  useEffect(() => {
    const fetchContributors = async () => {
      try {
        const response = await fetch(`/contributors.json`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json()
        if (!Array.isArray(data)) throw new Error('Invalid payload');
        setContributors(data)
        setLoadError(null)
      } catch (error) {
        console.error("Error fetching contributors:", error)
        setLoadError('تعذر تحميل بيانات المساهمين. تحقق من الاتصال وحاول مجدداً.')
      } finally {
        setLoading(false)
      }
    }

    if (initial.length === 0) fetchContributors()

    const interval = setInterval(fetchContributors, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleFlagClick = () => {
    setIsEagleLogo(!isEagleLogo)
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="sr-only">{PAGE_HEADING}</h1>
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-yellow-500 mx-auto mb-4"></div>
            <p className="text-xl text-muted-foreground">جاري تحميل البيانات...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  // A failed refresh keeps the list already on screen; the message is only
  // for the case where there is nothing to show at all.
  if (contributors.length === 0) {
    return (
      <MainLayout>
        
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="text-center max-w-md">
            <h1 className="sr-only">{PAGE_HEADING}</h1>
            <p className="text-xl text-foreground mb-2">لا توجد بيانات لعرضها حالياً</p>
            <p className="text-muted-foreground mb-4">{loadError ?? 'ملف المساهمين فارغ. حاول مجدداً لاحقاً.'}</p>
            <Button onClick={() => window.location.reload()}>إعادة المحاولة</Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      
      <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-background transition-colors duration-300">
        <div
          className="absolute inset-0 opacity-10 dark:opacity-5 animate-slide"
          style={{
            backgroundImage: `url('${"/syid-assets/materials/pattern.svg"}')`,
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </div>

      <div className="relative z-10 p-4" style={{ paddingTop: '32px' }}>
        <div className="max-w-7xl mx-auto">

          <div className="text-center mb-12 relative" style={{ paddingTop: '24px' }}>
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div
                  className="inline-block rounded shadow-lg overflow-hidden cursor-pointer"
                  onClick={handleFlagClick}
                >
                  {isEagleLogo ? (
                    <div className="bg-background flex justify-center items-center">
                      <img
                        src={"/syid-assets/materials/logo.ai.svg"}
                        alt="النسر السوري"
                        className="h-[120px] w-auto"
                        style={{ display: "block" }}
                      />
                    </div>
                  ) : (
                    <img
                      src={"/assets/ar.svg"}
                      alt="علم سوريا"
                      className="h-[120px] w-auto"
                      style={{ display: "block" }}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="relative z-10">
              <h1 className="text-5xl font-bold mb-4 drop-shadow-lg text-foreground transition-all duration-500">
                {PAGE_HEADING}
              </h1>
              <h2 className="text-3xl font-semibold mb-2 drop-shadow-md text-foreground/80 transition-all duration-500">
                الجمهورية العربية السورية
              </h2>
              <p className="text-xl drop-shadow-sm text-muted-foreground transition-all duration-500">
                تكريم المطورين السوريين المساهمين في المصادر المفتوحة
              </p>
            </div>
          </div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-card/20 backdrop-blur-md border border-border/30 rounded-full shadow-lg">
              <span className="text-sm text-muted-foreground">صنع بـ ❤️ بواسطة</span>
              <a
                href="https://github.com/z44d"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary transition-colors duration-200"
              >
                <Github className="w-4 h-4" />
                @z44d
              </a>
            </div>
          </div>
          <Tabs defaultValue="total" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-12 bg-muted/10 backdrop-blur-lg border border-border/10 rounded-full p-1 overflow-hidden h-12 max-w-2xl mx-auto">
              <TabsTrigger
                value="daily"
                className="flex items-center justify-center gap-1 text-sm font-semibold rounded-full transition-all duration-200 hover:scale-105 data-[state=active]:bg-card/20 data-[state=active]:backdrop-blur-md whitespace-nowrap h-full px-2"
              >
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">يومي</span>
              </TabsTrigger>
              <TabsTrigger
                value="monthly"
                className="flex items-center justify-center gap-1 text-sm font-semibold rounded-full transition-all duration-200 hover:scale-105 data-[state=active]:bg-card/20 data-[state=active]:backdrop-blur-md whitespace-nowrap h-full px-2"
              >
                <CalendarDays className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">شهري</span>
              </TabsTrigger>
              <TabsTrigger
                value="yearly"
                className="flex items-center justify-center gap-1 text-sm font-semibold rounded-full transition-all duration-200 hover:scale-105 data-[state=active]:bg-card/20 data-[state=active]:backdrop-blur-md whitespace-nowrap h-full px-2"
              >
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">سنوي</span>
              </TabsTrigger>
              <TabsTrigger
                value="total"
                className="flex items-center justify-center gap-1 text-sm font-semibold rounded-full transition-all duration-200 hover:scale-105 data-[state=active]:bg-card/20 data-[state=active]:backdrop-blur-md whitespace-nowrap h-full px-2"
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">إجمالي</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="daily" className="space-y-8">
              <TopThreeCard
                contributors={contributors}
                title="أفضل المساهمين اليوم"
                metric="daily_contributions"
                icon={<Clock className="w-8 h-8 text-blue-500" />}
              />
              <ContributorsList contributors={contributors} metric="daily_contributions" />
            </TabsContent>

            <TabsContent value="monthly" className="space-y-8">
              <TopThreeCard
                contributors={contributors}
                title="أفضل المساهمين هذا الشهر"
                metric="monthly_contributions"
                icon={<CalendarDays className="w-8 h-8 text-green-500" />}
              />
              <ContributorsList contributors={contributors} metric="monthly_contributions" />
            </TabsContent>

            <TabsContent value="yearly" className="space-y-8">
              <TopThreeCard
                contributors={contributors}
                title="أفضل المساهمين هذا العام"
                metric="yearly_contributions"
                icon={<Calendar className="w-8 h-8 text-purple-500" />}
              />
              <ContributorsList contributors={contributors} metric="yearly_contributions" />
            </TabsContent>

            <TabsContent value="total" className="space-y-8">
              <TopThreeCard
                contributors={contributors}
                title="أفضل المساهمين على الإطلاق"
                metric="total_contributions"
                icon={<Users className="w-8 h-8 text-orange-500" />}
              />
              <ContributorsList contributors={contributors} metric="total_contributions" />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <style>{`
        @keyframes slide {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 100% 100%;
          }
        }
`}</style>
    </div>
    </MainLayout>
  )
}
