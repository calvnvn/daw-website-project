import { Link } from "react-router-dom";
import {
  Briefcase,
  Mail,
  ArrowRight,
  Activity,
  FileText,
  Users,
} from "lucide-react";

export default function Dashboard() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const stats = [
    {
      title: "Active Projects",
      value: "6",
      trend: "Portfolios managed",
      icon: Briefcase,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Monthly Visitors",
      value: "2.4K",
      trend: "Website traffic",
      icon: Users,
      color: "text-daw-green",
      bgColor: "bg-green-50",
    },
    {
      title: "Unread Inquiries",
      value: "3",
      trend: "From Contact Us form",
      icon: Mail,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
  ];

  const recentActivities = [
    {
      id: 1,
      action: "Updated project details",
      target: "Hydropower - Kualu",
      time: "2 hours ago",
    },
    {
      id: 2,
      action: "Modified homepage content",
      target: "Main Banner Title",
      time: "5 hours ago",
    },
    {
      id: 3,
      action: "Updated global settings",
      target: "Head Office Address",
      time: "1 day ago",
    },
    {
      id: 4,
      action: "Updated team profile",
      target: "Management: Sudhamek",
      time: "2 days ago",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 tracking-tight">
            Executive Dashboard
          </h1>
          <p className="text-sm font-sans text-slate-500 mt-1">
            Website content overview and management metrics for PT Dharma Agung
            Wijaya
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900">{today}</p>
          <p className="text-xs font-sans text-slate-500 uppercase tracking-wider">
            System Status: Optimal
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}
                >
                  {" "}
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-bold text-slate-800 mb-1">
                  {stat.value}
                </h3>
                <p className="text-sm font-medium text-slate-600">
                  {stat.title}
                </p>
                <p className="text-xs text-slate-400 mt-2">{stat.trend}</p>
              </div>
            </div>
          );
        })}
      </div>
      {/* --- BOTTOM SECTION --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Content Activity Log */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-5h-5 text-slate-400" /> Contect Activity
              Log
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <FileText className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-800">
                      <span className="font-medium">{activity.action}</span> in{" "}
                      <span className="font-semibold text-daw-green">
                        {" "}
                        {activity.target}
                      </span>
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap font-medium bg-slate-100 px-2.5 py-1 rounded-md w-fit">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-800 mb-5">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <Link
              to="/admin/projects"
              className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50 hover:bg-daw-green hover:border-daw-green group transition-all"
            >
              <span className="text-sm font-medium text-slate-700 group-hover:text-white transition-colors">
                Manage Projects
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/admin/inbox"
              className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50 hover:bg-daw-green hover:border-daw-green group transition-all"
            >
              <span className="text-sm font-medium text-slate-700 group-hover:text-white transition-colors">
                Review Inquiries
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/admin/settings"
              className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50 hover:bg-daw-green hover:border-daw-green group transition-all"
            >
              <span className="text-sm font-medium text-slate-700 group-hover:text-white transition-colors">
                Global Settings
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
