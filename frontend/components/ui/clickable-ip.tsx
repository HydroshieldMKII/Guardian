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
      className="tabular inline-flex cursor-pointer items-center gap-1 truncate underline decoration-border underline-offset-[3px] transition-colors hover:text-foreground hover:decoration-current"
      title={`Look up ${ipAddress} on ipinfo.io`}
    >
      <span className="truncate">{ipAddress}</span>
    </button>
  );
};
