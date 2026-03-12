export default function ProjectDetailSkeleton() {
  return (
    <div className="min-h-screen bg-white pb-20 animate-pulse">
      {/* 1. HERO BANNER SKELETON */}
      <div className="w-full h-[50vh] min-h-[400px] bg-slate-200 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 w-full max-w-4xl px-6">
          <div className="h-4 w-32 bg-slate-300 rounded-md"></div>
          <div className="h-12 w-3/4 md:w-1/2 bg-slate-300 rounded-md"></div>
          <div className="h-1.5 w-20 bg-slate-300 rounded-full mt-6"></div>
        </div>
      </div>

      {/* 2. BREADCRUMBS SKELETON */}
      <div className="bg-slate-50 border-b border-slate-100 py-4 mb-10">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="h-3 w-64 bg-slate-200 rounded-md"></div>
        </div>
      </div>

      <div className="container mx-auto px-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* KOLOM KIRI: MAIN CONTENT SKELETON (8 Kolom) */}
          <div className="lg:col-span-8 space-y-10">
            {/* Tombol Back */}
            <div className="h-4 w-32 bg-slate-200 rounded-md mb-6"></div>

            {/* Paragraf Artikel (Rich Text Editor Placeholder) */}
            <div className="space-y-4">
              <div className="h-4 w-full bg-slate-200 rounded-md"></div>
              <div className="h-4 w-full bg-slate-200 rounded-md"></div>
              <div className="h-4 w-11/12 bg-slate-200 rounded-md"></div>
              <div className="h-4 w-full bg-slate-200 rounded-md pt-4"></div>
              <div className="h-4 w-4/5 bg-slate-200 rounded-md"></div>
            </div>

            {/* Gallery Grid Skeleton */}
            <div className="pt-10 border-t border-slate-100">
              <div className="h-8 w-32 bg-slate-200 rounded-md mb-6"></div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="aspect-[4/3] rounded-xl bg-slate-200"
                  ></div>
                ))}
              </div>
            </div>
          </div>

          {/* KOLOM KANAN: SIDEBAR SKELETON */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8">
              {/* Judul Sidebar */}
              <div className="h-8 w-40 bg-slate-200 rounded-md mb-6 border-b border-slate-200 pb-4"></div>

              {/* List "Our Projects" Dummy */}
              <div className="space-y-6">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="flex gap-4 items-center">
                    {/* Thumbnail Kecil */}
                    <div className="w-16 h-16 rounded-lg bg-slate-200 shrink-0"></div>
                    {/* Teks Judul & Kategori */}
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-full bg-slate-200 rounded-md"></div>
                      <div className="h-3 w-1/2 bg-slate-200 rounded-md"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
