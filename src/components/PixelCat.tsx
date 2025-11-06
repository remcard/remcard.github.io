import { useEffect, useState } from "react";

const PixelCat = () => {
  const [position, setPosition] = useState(10);
  const [direction, setDirection] = useState<"right" | "left">("right");
  const [action, setAction] = useState<"walk" | "sit">("walk");

  useEffect(() => {
    const moveInterval = setInterval(() => {
      if (action === "walk") {
        setPosition((prev) => {
          const newPos = direction === "right" ? prev + 1 : prev - 1;
          
          // Change direction at screen edges
          if (newPos >= 90) {
            setDirection("left");
            return 90;
          }
          if (newPos <= 10) {
            setDirection("right");
            return 10;
          }
          
          return newPos;
        });
      }
    }, 50);

    // Randomly sit or walk
    const actionInterval = setInterval(() => {
      const random = Math.random();
      if (random > 0.7) {
        setAction("sit");
        setTimeout(() => setAction("walk"), 3000);
      }
    }, 5000);

    return () => {
      clearInterval(moveInterval);
      clearInterval(actionInterval);
    };
  }, [action, direction]);

  return (
    <div
      className="fixed bottom-0 z-50 transition-all duration-100 pointer-events-none"
      style={{
        left: `${position}%`,
        transform: direction === "left" ? "scaleX(-1)" : "scaleX(1)",
      }}
    >
      <div className="relative">
        {action === "walk" ? (
          <div className="animate-bounce">
            <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-glow">
              {/* Cat body */}
              <rect x="16" y="28" width="16" height="12" fill="#FF6B9D" />
              {/* Cat head */}
              <rect x="18" y="20" width="12" height="8" fill="#FF6B9D" />
              {/* Left ear */}
              <rect x="16" y="16" width="4" height="4" fill="#FF6B9D" />
              {/* Right ear */}
              <rect x="28" y="16" width="4" height="4" fill="#FF6B9D" />
              {/* Eyes */}
              <rect x="20" y="22" width="2" height="2" fill="#000" />
              <rect x="26" y="22" width="2" height="2" fill="#000" />
              {/* Nose */}
              <rect x="23" y="25" width="2" height="1" fill="#000" />
              {/* Tail */}
              <rect x="30" y="24" width="4" height="2" fill="#FF6B9D" />
              <rect x="34" y="22" width="2" height="2" fill="#FF6B9D" />
              {/* Legs */}
              <rect x="18" y="40" width="3" height="4" fill="#FF6B9D" />
              <rect x="27" y="40" width="3" height="4" fill="#FF6B9D" />
            </svg>
          </div>
        ) : (
          <div>
            <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-glow">
              {/* Cat body (sitting) */}
              <rect x="16" y="24" width="16" height="16" fill="#FF6B9D" />
              {/* Cat head */}
              <rect x="18" y="16" width="12" height="8" fill="#FF6B9D" />
              {/* Left ear */}
              <rect x="16" y="12" width="4" height="4" fill="#FF6B9D" />
              {/* Right ear */}
              <rect x="28" y="12" width="4" height="4" fill="#FF6B9D" />
              {/* Eyes (closed) */}
              <rect x="20" y="18" width="2" height="1" fill="#000" />
              <rect x="26" y="18" width="2" height="1" fill="#000" />
              {/* Nose */}
              <rect x="23" y="21" width="2" height="1" fill="#000" />
              {/* Tail wrapped around */}
              <rect x="30" y="28" width="2" height="8" fill="#FF6B9D" />
              <rect x="28" y="36" width="4" height="2" fill="#FF6B9D" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default PixelCat;
