import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

const fetchDummyData = async () => {
  const res = await fetch(
    "https://jsonplaceholder.typicode.com/posts?_limit=3",
  );
  return res.json();
};

export default function Admin() {
  const { data, isLoading } = useQuery({
    queryKey: ["dummyData"],
    queryFn: fetchDummyData,
  });

  return (
    <div className="p-8 bg-slate-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Panel Admin DAW</h1>
      <Link to="/" className="text-blue-600 underline mb-6 block">
        &larr; Kembali ke Beranda
      </Link>

      {isLoading ? (
        <p className="animate-pulse">Mengambil data dari server...</p>
      ) : (
        <ul className="space-y-3">
          {data?.map((item: { id: number; title: string }) => (
            <li
              key={item.id}
              className="p-4 bg-white shadow rounded-md border border-slate-200"
            >
              {item.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
