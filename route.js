import { NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/auth';

export async function GET() {
  const loggedIn = await requireStaffSession();
  return NextResponse.json({ loggedIn });
}
