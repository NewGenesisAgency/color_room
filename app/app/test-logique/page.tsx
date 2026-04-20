"use client";

import React, { useState } from 'react';

export default function MoteurLogique() {
  const [dalles, setDalles] = useState(Array(42).fill("éteinte"));

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#1a1a1a', minHeight: '100vh', color: 'white' }}>
      <h1>⚙️ Moteur Logique (Test E3)</h1>
      <p>Mémoire initialisée : {dalles.length} dalles générées.</p>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(6, 60px)', 
        gap: '5px',
        marginTop: '20px'
      }}>
        {dalles.map((etat, index) => (
          <div key={index} style={{ 
            width: '60px', 
            height: '60px', 
            backgroundColor: '#333', 
            border: '2px solid #555',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            borderRadius: '5px'
          }}>
            {index + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
