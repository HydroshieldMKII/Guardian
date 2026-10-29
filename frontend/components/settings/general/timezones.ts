export const UTC_OFFSETS = Array.from({ length: 25 }, (_, index) => {
  const hours = index - 12;
  const sign = hours < 0 ? "-" : "+";
  return `${sign}${String(Math.abs(hours)).padStart(2, "0")}:00`;
});

export const getCurrentTimeInOffset = (offsetString: string): string => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;

  const sign = offsetString.charAt(0) === "+" ? 1 : -1;
  const [hours, minutes = 0] = offsetString.slice(1).split(":").map(Number);
  const offsetMinutes = sign * (hours * 60 + minutes);

  const targetTime = new Date(utc + offsetMinutes * 60000);
  return targetTime.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
};
