// --- RECURSIVE RENDERER UNTUK TREE VIEW ---
const renderMenuTree = (menuList: Menu[], depth = 0) => {
  return menuList.map((menu) => {
    const isDragging = draggedMenuId === menu.id;
    const isDragOver = dragOverMenuId === menu.id;

    return (
      <div key={menu.id} className="w-full">
        <div
          // Tambahkan event listener Drag & Drop HTML5
          draggable
          onDragStart={(e) => handleDragStart(e, menu.id)}
          onDragOver={(e) => handleDragOver(e, menu.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, menu)}
          // Animasi Visual saat diseret dan ditimpa
          className={`group flex items-center justify-between p-3 mb-2 rounded-xl border transition-all duration-200
              ${editingId === menu.id ? "bg-daw-green/5 border-daw-green shadow-sm" : "bg-white border-slate-200 hover:border-daw-green/50"}
              ${isDragging ? "opacity-30 scale-95 border-dashed" : "opacity-100 scale-100"}
              ${isDragOver ? "border-b-4 border-b-daw-green bg-daw-green/10 translate-y-1 shadow-md" : ""}
            `}
          style={{ marginLeft: `${depth * 1.5}rem` }}
        >
          <div className="flex items-center gap-3">
            {/* IKON GRIP UNTUK MENUNJUKKAN BISA DI-DRAG */}
            <div className="cursor-grab active:cursor-grabbing hover:bg-slate-100 p-1 rounded transition-colors -ml-1">
              <GripVertical className="w-4 h-4 text-slate-400 hover:text-daw-green" />
            </div>

            {depth > 0 && (
              <CornerDownRight className="w-4 h-4 text-slate-300" />
            )}

            <div
              className={`p-2 rounded-lg ${menu.type === "page" ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"}`}
            >
              {menu.type === "page" ? (
                <FileText className="w-4 h-4" />
              ) : (
                <LinkIcon className="w-4 h-4" />
              )}
            </div>
            <div>
              <h4
                className={`font-bold text-sm ${!menu.isActive && "text-slate-400 line-through"}`}
              >
                {menu.label}
              </h4>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
                {menu.type === "page" ? "Internal Page" : "External Link"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleEdit(menu)}
              className="p-1.5 text-slate-400 hover:text-daw-green hover:bg-daw-green/10 rounded-md"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(menu.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Render Anaknya (Rekursif) */}
        {menu.children && menu.children.length > 0 && (
          <div className="border-l-2 border-slate-100 ml-5 pl-3">
            {renderMenuTree(menu.children, depth + 1)}
          </div>
        )}
      </div>
    );
  });
};
