import { BookOpen, Banknote, Beef, Boxes, ClipboardList, FileSignature, FileText, FolderCheck, LayoutDashboard, Map, PackageCheck, Sprout, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import type { SectionKey } from "./data";

export const SECTION_ICONS: Record<SectionKey, LucideIcon> = {
  overview: LayoutDashboard, applicant: UserRound, bank: Banknote, parcels: Map, usage: FileSignature, cultures: Sprout, interventions: Boxes,
  notebooks: ClipboardList, zoo: Beef, documents: FileText, verification: ShieldCheck, export: PackageCheck, modifications: FolderCheck, guidance: BookOpen,
};
