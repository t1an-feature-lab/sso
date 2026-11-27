import type { SVGProps } from "react";

export function RobotIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8V4.75"
      />
      <circle cx="12" cy="3.75" r="1" fill="currentColor" stroke="none" />
      <rect
        x="4.25"
        y="8"
        width="15.5"
        height="11.75"
        rx="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 13.75h2m15.5 0h2M9.5 16.5h5"
      />
      <circle cx="9.25" cy="13.25" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.75" cy="13.25" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
