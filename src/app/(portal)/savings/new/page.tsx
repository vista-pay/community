import type { Metadata } from 'next';
import { SavingsProductForm } from './savings-product-form';

export const metadata: Metadata = { title: 'New savings product' };
export default function NewSavingsProductPage() { return <SavingsProductForm />; }
