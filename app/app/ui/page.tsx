'use client';

import { Suspense } from 'react';

// Composant qui utilise les hooks côté client
function UIContent() {
  // Vos hooks ici (useSearchParams, useRouter, etc.)
  // Exemple:
  // const searchParams = useSearchParams();
  // const router = useRouter();
  
  return (
    <div>
      <h1>UI Page</h1>
      <p>Contenu de la page UI</p>
    </div>
  );
}

// Fallback pendant le chargement
function UILoading() {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      minHeight: '50vh'
    }}>
      <div>Chargement...</div>
    </div>
  );
}

// Page principale avec Suspense
export default function UIPage() {
  return (
    <Suspense fallback={<UILoading />}>
      <UIContent />
    </Suspense>
  );
}
