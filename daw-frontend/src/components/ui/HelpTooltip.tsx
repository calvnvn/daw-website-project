import { HelpCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface HelpTooltipProps {
  content: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export function HelpTooltip({ content, position = "top" }: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Close tooltip on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    }
    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isVisible]);

  // Recalculate position when visible
  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      const viewportWidth = window.innerWidth;
      const tooltipWidth = 256; // 16rem = 256px
      const padding = 16; // 16px safety margin

      let top = 0;
      let left = 0;

      if (position === "top" || position === "bottom") {
        top = position === "top" ? rect.top + scrollY - 8 : rect.bottom + scrollY + 8;
        // Center of trigger minus half of tooltip width
        let targetLeft = rect.left + scrollX + rect.width / 2 - tooltipWidth / 2;
        
        // Constrain to viewport bounds
        if (targetLeft < padding) {
          targetLeft = padding;
        } else if (targetLeft + tooltipWidth > viewportWidth - padding) {
          targetLeft = viewportWidth - tooltipWidth - padding;
        }
        left = targetLeft;
      } else if (position === "left") {
        top = rect.top + scrollY + rect.height / 2;
        let targetLeft = rect.left + scrollX - 8;
        
        // Constrain left boundaries
        if (targetLeft - tooltipWidth < padding) {
          targetLeft = tooltipWidth + padding;
        }
        left = targetLeft;
      } else if (position === "right") {
        top = rect.top + scrollY + rect.height / 2;
        let targetLeft = rect.right + scrollX + 8;
        
        // Constrain right boundaries
        if (targetLeft + tooltipWidth > viewportWidth - padding) {
          targetLeft = viewportWidth - tooltipWidth - padding;
        }
        left = targetLeft;
      }

      setCoords({ top, left });
    }
  }, [isVisible, position]);

  const transformClass = {
    top: "-translate-y-full",
    bottom: "",
    left: "-translate-x-full -translate-y-1/2",
    right: "-translate-y-1/2",
  }[position];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="text-slate-400 hover:text-daw-green transition-colors focus:outline-none focus:ring-2 focus:ring-daw-green/20 rounded-full p-0.5 ml-1 inline-flex items-center"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        aria-label="Informasi Bantuan"
      >
        <HelpCircle className="w-[14px] h-[14px]" />
      </button>

      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{
              position: "absolute",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className={`z-[9999] w-64 p-3 bg-slate-900 text-white text-xs leading-relaxed rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-150 pointer-events-none transform ${transformClass}`}
            role="tooltip"
          >
            {content}
            {/* Arrow */}
            <div
              className={`absolute w-2 h-2 bg-slate-900 transform rotate-45 ${
                position === "top"
                  ? "bottom-[-4px] left-1/2 -translate-x-1/2"
                  : position === "bottom"
                  ? "top-[-4px] left-1/2 -translate-x-1/2"
                  : position === "left"
                  ? "right-[-4px] top-1/2 -translate-y-1/2"
                  : "left-[-4px] top-1/2 -translate-y-1/2"
              }`}
            />
          </div>,
          document.body
        )}
    </>
  );
}

