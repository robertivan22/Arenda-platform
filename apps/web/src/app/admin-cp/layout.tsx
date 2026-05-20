// Standalone layout for admin panel — no app sidebar/topbar
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
        {children}
      </body>
    </html>
  )
}
