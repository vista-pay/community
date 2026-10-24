import { redirect } from 'next/navigation';

/** The middleware decides which of these the visitor can actually see. */
export default function Home() {
  redirect('/dashboard');
}
