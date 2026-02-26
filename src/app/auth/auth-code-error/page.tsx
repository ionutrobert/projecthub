import Link from "next/link"

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
        <p className="text-muted-foreground mb-6">
          There was a problem signing you in. Please try again.
        </p>
        <Link 
          href="/auth/login"
          className="text-primary hover:underline"
        >
          Go back to login
        </Link>
      </div>
    </div>
  )
}
