
import { getSystemStatsAction } from "@/server/actions/admin";
import { 
  Users, 
  FileText, 
  AlertCircle 
} from "lucide-react";

export default async function AdminDashboard() {
  const stats = await getSystemStatsAction();

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">System overview and statistics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard 
          title="Total Users" 
          value={stats.totalUsers} 
          icon={Users}
        />
        <StatsCard 
          title="Total BTI Rulings" 
          value={stats.totalRulings} 
          icon={FileText}
        />
        <StatsCard 
          title="Unenriched Rulings" 
          value={stats.unenrichedRulings} 
          icon={AlertCircle}
          description={`${stats.enrichmentProgress}% enriched`}
        />
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, description }: any) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow">
      <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="tracking-tight text-sm font-medium">{title}</h3>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="p-6 pt-0">
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}
