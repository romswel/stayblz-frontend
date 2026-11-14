import { meetingLink, PADDOCK_NAME } from "./brand";

/** A calendar file (.ics) any calendar app can import: made in the browser, nothing is sent anywhere. */
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function downloadIcs(meeting: { code: string; title: string; scheduledFor: string; durationMinutes: number; hostName: string }) {
  const start = new Date(meeting.scheduledFor);
  const end = new Date(start.getTime() + meeting.durationMinutes * 60_000);
  const link = meetingLink(meeting.code);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stayblz//Paddock//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${meeting.code}-${start.getTime()}@stayblz-app.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(meeting.title)}`,
    `DESCRIPTION:${escape(`${PADDOCK_NAME} video meeting hosted by ${meeting.hostName}.\nJoin: ${link}\nMeeting code: ${meeting.code}`)}`,
    `LOCATION:${escape(link)}`,
    `URL:${link}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${meeting.title.replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "paddock-meeting"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
