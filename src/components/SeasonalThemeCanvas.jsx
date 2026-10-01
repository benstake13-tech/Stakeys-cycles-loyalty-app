import React, { useEffect, useRef } from 'react';

export const SeasonalThemeCanvas = ({ theme }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (theme === 'none' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let elements = [];
    const createElements = () => {
      elements = Array.from({ length: 20 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        rotation: Math.random() * Math.PI * 2,
      }));
    };
    createElements();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      elements.forEach(el => {
        ctx.save();
        ctx.translate(el.x, el.y);
        ctx.rotate(el.rotation);
        ctx.fillStyle = theme === 'halloween' ? '#ffa500' : theme === 'christmas' ? '#ff0000' : theme === 'valentines' ? '#ff69b4' : '#fff';
        
        // Simplified shapes for animations
        if (theme === 'halloween') ctx.fillRect(-10, -10, 20, 20); // Ghost/Goblin
        else if (theme === 'christmas') ctx.beginPath(), ctx.arc(0, 0, 5, 0, Math.PI * 2), ctx.fill(); // Snow
        else if (theme === 'valentines') ctx.font = '20px serif', ctx.fillText('♥', 0, 0); // Hearts
        else ctx.fillRect(-5, -5, 10, 10);
        
        ctx.restore();
        el.x += el.vx; el.y += el.vy;
        el.rotation += 0.02;
        if (el.x < 0) el.x = canvas.width; if (el.x > canvas.width) el.x = 0;
        if (el.y < 0) el.y = canvas.height; if (el.y > canvas.height) el.y = 0;
      });
      requestAnimationFrame(draw);
    };
    draw();
  }, [theme]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
};
