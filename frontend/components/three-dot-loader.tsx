"use client";

export function ThreeDotLoader() {
  return (
    <div className="flex items-center justify-center gap-2">
      <div
        className="h-3 w-3 rounded-full bg-blue-500 animate-bounce"
        style={{ animationDelay: "0s" }}
      ></div>
      <div
        className="h-3 w-3 rounded-full bg-blue-500 animate-bounce"
        style={{ animationDelay: "0.2s" }}
      ></div>
      <div
        className="h-3 w-3 rounded-full bg-blue-500 animate-bounce"
        style={{ animationDelay: "0.4s" }}
      ></div>
    </div>
  );
}
