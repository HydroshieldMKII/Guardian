import React from "react";

interface ClickableIPProps {
  ipAddress: string | null | undefined;
}

export const ClickableIP: React.FC<ClickableIPProps> = ({ ipAddress }) => {
  if (!ipAddress || ipAddress === "Unknown IP" || ipAddress === "Unknown") {
    return <span className="truncate">{ipAddress || "Unknown"}</span>;
  }

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    window.open(
      `https://ipinfo.io/${ipAddress}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex cursor-pointer items-center gap-1 truncate text-blue-600 transition-colors hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
      title={`Look up ${ipAddress} on ipinfo.io`}
    >
      <span className="truncate">{ipAddress}</span>
    </button>
  );
};
