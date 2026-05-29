// Standalone layout for admin panel — no app sidebar/topbar
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      {children}
    </div>
  )
}
