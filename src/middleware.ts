import { NextResponse } from 'next/server'


export async function middleware() {
  // For now, just allow all requests and handle auth in the components
  // This avoids the complex cookie handling issues with Supabase SSR
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
