import { Outlet } from "react-router-dom";
// import Navbar from "@/components/Navbar";
import DynamicNavbar from "@/layouts/DynamicNavbar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-900 bg-white">
      <ScrollToTop />

      <DynamicNavbar />

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
