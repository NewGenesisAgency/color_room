'use client';

import { useEffect, useRef, useState } from 'react';
import './ChromaticityDiagram.css';

// Types
type ChromaticityPoint = {
  u: number;
  v: number;
  x: number;
  y: number;
};

type RGB = {
  r: number;
  g: number;
  b: number;
};

// Composant principal
export default function ChromaticityDiagram() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedPoint, setSelectedPoint] = useState<ChromaticityPoint | null>(null);
  const [hoverPoint, setHoverPoint] = useState<ChromaticityPoint | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Conversion u'v' → XYZ
  function uvToXYZ(u: number, v: number): { x: number; y: number; z: number } {
    const Y = 1; // On fixe Y = 1 pour la conversion
    const X = (u * Y) / v;
    const Z = ((1 - u - v) * Y) / v;
    return { x: X, y: Y, z: Z };
  }

  // Conversion XYZ → RGB (sRGB)
  function xyzToRGB(x: number, y: number, z: number): RGB {
    // Matrice de conversion XYZ → sRGB linéaire
    const r_lin = 3.2406 * x - 1.5372 * y - 0.4986 * z;
    const g_lin = -0.9689 * x + 1.8758 * y + 0.0415 * z;
    const b_lin = 0.0557 * x - 0.2040 * y + 1.0570 * z;

    // Correction gamma sRGB
    const gammaCorrect = (c: number): number => {
      if (c <= 0.0031308) return 12.92 * c;
      return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    };

    // Appliquer gamma et clipper
    const r = Math.max(0, Math.min(255, Math.round(gammaCorrect(r_lin) * 255)));
    const g = Math.max(0, Math.min(255, Math.round(gammaCorrect(g_lin) * 255)));
    const b = Math.max(0, Math.min(255, Math.round(gammaCorrect(b_lin) * 255)));

    return { r, g, b };
  }

  // Conversion RGB → HEX
  function rgbToHex(r: number, g: number, b: number): string {
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // Vérifier si une couleur est dans le gamut sRGB
  function isInSRGBGamut(r: number, g: number, b: number): boolean {
    return r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255;
  }

  // Dessiner le diagramme
  const drawDiagram = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = 300; // Échelle pour le diagramme

    // Effacer le canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    // Dessiner le spectral locus (approximation)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();

    // Points approximatifs du spectral locus en u'v'
    const spectralPoints = [
      { u: 0.175, v: 0.005 }, // 380nm (violet)
      { u: 0.155, v: 0.025 }, // 420nm
      { u: 0.125, v: 0.060 }, // 460nm (bleu)
      { u: 0.100, v: 0.150 }, // 500nm (cyan)
      { u: 0.125, v: 0.330 }, // 540nm (vert)
      { u: 0.200, v: 0.450 }, // 580nm (jaune)
      { u: 0.300, v: 0.450 }, // 600nm (orange)
      { u: 0.400, v: 0.400 }, // 620nm (rouge)
      { u: 0.450, v: 0.350 }, // 660nm
      { u: 0.475, v: 0.300 }, // 700nm (rouge profond)
      { u: 0.175, v: 0.005 }, // Retour au point de départ
    ];

    spectralPoints.forEach((point, i) => {
      const x = centerX + (point.u - 0.25) * scale;
      const y = centerY - (point.v - 0.25) * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // Remplir le diagramme avec des couleurs
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        // Convertir les coordonnées pixel en u'v'
        const u = (px - centerX) / scale + 0.25;
        const v = -(py - centerY) / scale + 0.25;

        // Vérifier si le point est dans le spectral locus (simplifié)
        const isInGamut = u >= 0.1 && u <= 0.5 && v >= 0 && v <= 0.5;
        
        if (isInGamut) {
          const xyz = uvToXYZ(u, v);
          const rgb = xyzToRGB(xyz.x, xyz.y, xyz.z);
          
          if (isInSRGBGamut(rgb.r, rgb.g, rgb.b)) {
            const index = (py * width + px) * 4;
            data[index] = rgb.r;
            data[index + 1] = rgb.g;
            data[index + 2] = rgb.b;
            data[index + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Redessiner les contours
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    spectralPoints.forEach((point, i) => {
      const x = centerX + (point.u - 0.25) * scale;
      const y = centerY - (point.v - 0.25) * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  // Gérer le clic sur le canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = 300;

    const u = (x - centerX) / scale + 0.25;
    const v = -(y - centerY) / scale + 0.25;

    setSelectedPoint({ u, v, x, y });
  };

  // Gérer le survol
  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = 300;

    const u = (x - centerX) / scale + 0.25;
    const v = -(y - centerY) / scale + 0.25;

    setHoverPoint({ u, v, x, y });

    if (isDragging) {
      setSelectedPoint({ u, v, x, y });
    }
  };

  // Dessiner le point sélectionné
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedPoint) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dessiner le point sélectionné
    ctx.fillStyle = '#ff0000';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(selectedPoint.x, selectedPoint.y, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }, [selectedPoint]);

  // Initialiser le diagramme
  useEffect(() => {
    drawDiagram();
  }, []);

  // Obtenir la couleur RGB du point sélectionné
  const getSelectedColor = (): RGB | null => {
    if (!selectedPoint) return null;
    const xyz = uvToXYZ(selectedPoint.u, selectedPoint.v);
    return xyzToRGB(xyz.x, xyz.y, xyz.z);
  };

  const selectedColor = getSelectedColor();
  const selectedHex = selectedColor ? rgbToHex(selectedColor.r, selectedColor.g, selectedColor.b) : '#000000';

  return (
    <div className="chromaticity-diagram-container">
      <h2 className="text-2xl font-bold mb-4">Diagramme de Chromaticité u′v′ (CIE 1976 UCS)</h2>
      
      <div className="flex gap-6">
        {/* Canvas du diagramme */}
        <div>
          <canvas
            ref={canvasRef}
            width={600}
            height={600}
            className="chromaticity-canvas"
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMove}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => {
              setHoverPoint(null);
              setIsDragging(false);
            }}
          />
        </div>

        {/* Panneau d'informations */}
        <div className="info-panel">
          {/* Point survolé */}
          {hoverPoint && (
            <div className="info-card hover-info">
              <h3>Coordonnées au survol :</h3>
              <p>u′ = {hoverPoint.u.toFixed(4)}</p>
              <p>v′ = {hoverPoint.v.toFixed(4)}</p>
            </div>
          )}

          {/* Point sélectionné */}
          {selectedPoint && selectedColor && (
            <div className="info-card selected-info">
              <h3>Couleur sélectionnée :</h3>
              
              {/* Preview de la couleur */}
              <div 
                className="color-preview"
                style={{ backgroundColor: selectedHex }}
              />
              
              {/* Coordonnées chromatiques */}
              <div className="coordinates">
                <p><strong>u′:</strong> {selectedPoint.u.toFixed(4)}</p>
                <p><strong>v′:</strong> {selectedPoint.v.toFixed(4)}</p>
                <p><strong>RGB:</strong> ({selectedColor.r}, {selectedColor.g}, {selectedColor.b})</p>
                <p><strong>HEX:</strong> {selectedHex}</p>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="info-card instructions">
            <h3>Instructions :</h3>
            <ul>
              <li>Cliquez sur le diagramme pour sélectionner une couleur</li>
              <li>Survolez pour voir les coordonnées u′v′</li>
              <li>Le point rouge indique la couleur sélectionnée</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
