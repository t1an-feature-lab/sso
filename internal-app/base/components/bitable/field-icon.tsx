import {
  BracesIcon,
  CalendarClockIcon,
  CalendarIcon,
  CheckSquareIcon,
  CircleDotIcon,
  HashIcon,
  Link2Icon,
  LinkIcon,
  ListChecksIcon,
  MailIcon,
  TypeIcon,
} from "lucide-react";
import type { FieldType } from "@/lib/bitable/types";

export function FieldTypeIcon({
  type,
  className = "size-4 shrink-0 text-foreground",
}: {
  type: FieldType;
  className?: string;
}) {
  switch (type) {
    case "text":
      return <TypeIcon className={className} aria-hidden="true" />;
    case "number":
      return <HashIcon className={className} aria-hidden="true" />;
    case "boolean":
      return <CheckSquareIcon className={className} aria-hidden="true" />;
    case "date":
      return <CalendarIcon className={className} aria-hidden="true" />;
    case "datetime":
      return <CalendarClockIcon className={className} aria-hidden="true" />;
    case "singleSelect":
      return <CircleDotIcon className={className} aria-hidden="true" />;
    case "multiSelect":
      return <ListChecksIcon className={className} aria-hidden="true" />;
    case "url":
      return <LinkIcon className={className} aria-hidden="true" />;
    case "email":
      return <MailIcon className={className} aria-hidden="true" />;
    case "json":
      return <BracesIcon className={className} aria-hidden="true" />;
    case "relation":
      return <Link2Icon className={className} aria-hidden="true" />;
  }
}
