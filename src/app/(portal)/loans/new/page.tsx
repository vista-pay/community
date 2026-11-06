import type { Metadata } from 'next';
import { LoanProductForm } from './product-form';

export const metadata: Metadata = { title: 'New loan product' };

export default function NewLoanProductPage() {
  return <LoanProductForm />;
}
