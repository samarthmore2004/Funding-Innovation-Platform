import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button, EmptyState } from '../components/ui'
import { useDocumentTitle } from '../utils/hooks'

export default function NotFoundPage({ inApp = false }) {
  useDocumentTitle('Page not found')
  return (
    <div className={inApp ? 'py-16' : 'flex min-h-screen items-center justify-center bg-slate-50 px-4'}>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist or has moved."
        action={
          <Button as={Link} to={inApp ? '/app' : '/'}>
            {inApp ? 'Back to dashboard' : 'Go to home page'}
          </Button>
        }
      />
    </div>
  )
}
