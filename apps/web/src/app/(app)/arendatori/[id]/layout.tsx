import { LessorDetailShell } from './LessorDetailShell'

export function generateStaticParams() {
  return []
}

export default function LessorDetailLayout({ children }: { children: React.ReactNode }) {
  return <LessorDetailShell>{children}</LessorDetailShell>
}
