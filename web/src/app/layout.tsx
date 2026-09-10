import './globals.css'
import { HoverPreviewProvider } from '@/components/HoverPreview'
export const metadata = { title: 'Steam Command Center' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><HoverPreviewProvider><div className="shell">{children}</div></HoverPreviewProvider></body></html>
}
