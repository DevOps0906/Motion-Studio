import type { Metadata } from 'next';
import ArchitecturalViewer from './ArchitecturalViewer';
import './viewer.css';

export const metadata: Metadata = { title: '건축 모델 뷰어 | Motion Studio' };

export default function ArchitecturalViewerPage() {
  return <ArchitecturalViewer />;
}
