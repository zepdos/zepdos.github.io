document.addEventListener('DOMContentLoaded', () => {
    
  const canvas = document.getElementById('neuralCanvas');
  const ctx = canvas.getContext('2d');

  // --- TEMPORARY FPS TRACKER ---
  
  const fpsDiv = document.createElement('div');
  Object.assign(fpsDiv.style, {
      position: 'fixed',
      top: '10px',
      right: '10px',
      color: '#00FF00', // Bright Green
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: '5px 10px',
      fontFamily: 'monospace',
      fontSize: '14px',
      zIndex: '10000',
      borderRadius: '4px',
      pointerEvents: 'none' // Lets clicks pass through
  });
  document.body.appendChild(fpsDiv);

  let lastTime = performance.now();
  let frameCount = 0;
  

  // --- CONFIGURATION ---
  const config = {
      // System Settings
      mode: localStorage.getItem('simMode') || 'neural', // 'neural' or 'boids'
      
      // DYNAMIC COUNTS (The "Cheat")
      neuralCount: 150, // High density for static movement
      boidCount: 80,    // Lower density for expensive flocking calculations

      // Rendering
      connectDistance: 85,     // Slightly reduced for performance
      triangleDistance: 80,
      baseRadius: 2,
      maxConnections: 8,       // Strict cap on lines per node
      
      // Interaction
      repulseRadius: 200,
      repulseForce: 15,
      
      // Mode 1: Neural Physics
      neuralSpeed: 0.8,
      
      // Mode 2: Boids Physics
      boidSpeed: 2.5, 
      visualRange: 100,
      centeringFactor: 0.005, 
      avoidFactor: 0.05,      
      matchingFactor: 0.05,   
      turnFactor: 0.2,        
  };

  let nodes = [];
  let ripples = [];

  // --- INITIALIZATION ---
  function initNodes() {
      nodes = [];
      // SELECT COUNT BASED ON MODE
      const targetCount = config.mode === 'boids' ? config.boidCount : config.neuralCount;
      
      for (let i = 0; i < targetCount; i++) {
          nodes.push({
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              vx: (Math.random() - 0.5) * config.neuralSpeed,
              vy: (Math.random() - 0.5) * config.neuralSpeed,
              shade: Math.floor(Math.random() * 150) + 50 
          });
      }
  }

  function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initNodes(); 
  }

  // --- PHYSICS MODULES ---

  // MODULE A: The Neural Network
  function updateNeural(node) {
      node.x += node.vx;
      node.y += node.vy;

      const speedSq = node.vx**2 + node.vy**2;
      if (speedSq > config.neuralSpeed ** 2) {
          node.vx *= 0.95; 
          node.vy *= 0.95;
      }

      if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
      if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
  }

  // MODULE B: The Boids (Optimized)
  function updateBoids(node) {
      let centerX = 0, centerY = 0;
      let moveX = 0, moveY = 0;
      let avgVX = 0, avgVY = 0;
      let neighbors = 0;
      const visualRangeSq = config.visualRange ** 2;

      for (let other of nodes) {
          if (node === other) continue;
          
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distSq = dx*dx + dy*dy;

          if (distSq < visualRangeSq) {
              centerX += other.x;
              centerY += other.y;
              
              if (distSq < 900) { // Separation range (30px)
                  moveX += dx;
                  moveY += dy;
              }

              avgVX += other.vx;
              avgVY += other.vy;
              neighbors++;
          }
      }

      if (neighbors > 0) {
          centerX /= neighbors;
          centerY /= neighbors;
          node.vx += (centerX - node.x) * config.centeringFactor;
          node.vy += (centerY - node.y) * config.centeringFactor;

          node.vx += moveX * config.avoidFactor;
          node.vy += moveY * config.avoidFactor;

          avgVX /= neighbors;
          avgVY /= neighbors;
          node.vx += (avgVX - node.vx) * config.matchingFactor;
          node.vy += (avgVY - node.vy) * config.matchingFactor;
      }

      const margin = 100;
      if (node.x < margin) node.vx += config.turnFactor;
      if (node.x > canvas.width - margin) node.vx -= config.turnFactor;
      if (node.y < margin) node.vy += config.turnFactor;
      if (node.y > canvas.height - margin) node.vy -= config.turnFactor;

      // Speed Limit
      const speedSq = node.vx*node.vx + node.vy*node.vy;
      const minSpeed = 2;
      const maxSpeed = 4;
      
      if (speedSq > maxSpeed**2) {
          const speed = Math.sqrt(speedSq);
          node.vx = (node.vx / speed) * maxSpeed;
          node.vy = (node.vy / speed) * maxSpeed;
      } else if (speedSq < minSpeed**2) {
          const speed = Math.sqrt(speedSq);
          node.vx = (node.vx / speed) * minSpeed;
          node.vy = (node.vy / speed) * minSpeed;
      }

      node.x += node.vx;
      node.y += node.vy;
  }


  // --- RENDERING LOOP ---
  function draw() {
      // FPS Tracker
      /*
      const now = performance.now();
      frameCount++;
      if (now - lastTime >= 1000) {
          fpsDiv.textContent = `FPS: ${frameCount}`;
          frameCount = 0;
          lastTime = now;
      }
      */

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isDarkMode = document.body.classList.contains('dark-mode');
      const nodeColor = isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
      const lineRGB = isDarkMode ? '255, 255, 255' : '0, 0, 0'; 

      const connectSq = config.connectDistance ** 2;
      const triangleSq = config.triangleDistance ** 2;

      // 1. Ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
          let r = ripples[i];
          r.radius += 5;
          r.alpha -= 0.03;
          if (r.alpha <= 0) ripples.splice(i, 1);
          else {
              ctx.beginPath();
              ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(${r.color}, ${r.alpha})`;
              ctx.lineWidth = 2;
              ctx.stroke();
          }
      }

      // 2. Nodes & Connections
      for (let i = 0; i < nodes.length; i++) {
          let node = nodes[i];

          if (config.mode === 'boids') {
              updateBoids(node);
          } else {
              updateNeural(node);
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, config.baseRadius, 0, Math.PI * 2);
          ctx.fillStyle = nodeColor;
          ctx.fill();

          // OPTIMIZATION: Connection Counter
          let connections = 0;

          for (let j = i + 1; j < nodes.length; j++) {
              let other = nodes[j];
              let distSq = (node.x - other.x)**2 + (node.y - other.y)**2;

              if (distSq < connectSq) {
                  connections++;
                  if (connections > config.maxConnections) continue;

                  let dist = Math.sqrt(distSq); 
                  let opacity = 1 - (dist / config.connectDistance);
                  
                  ctx.beginPath();
                  ctx.moveTo(node.x, node.y);
                  ctx.lineTo(other.x, other.y);
                  ctx.strokeStyle = `rgba(${lineRGB}, ${opacity * 0.2})`;
                  ctx.stroke();

                  // Triangles
                  if (distSq < triangleSq) {
                      for (let k = j + 1; k < nodes.length; k++) {
                          let third = nodes[k];
                          let dist2Sq = (node.x - third.x)**2 + (node.y - third.y)**2;
                          let dist3Sq = (other.x - third.x)**2 + (other.y - third.y)**2;

                          if (dist2Sq < triangleSq && dist3Sq < triangleSq) {
                              ctx.beginPath();
                              ctx.moveTo(node.x, node.y);
                              ctx.lineTo(other.x, other.y);
                              ctx.lineTo(third.x, third.y);
                              ctx.closePath();
                              let avgShade = Math.floor((node.shade + other.shade + third.shade) / 3);
                              let triOpacity = (1 - (distSq/triangleSq)) * 0.15; 
                              
                              ctx.fillStyle = isDarkMode 
                                  ? `rgba(255, 255, 255, ${triOpacity})`
                                  : `rgba(${avgShade}, ${avgShade}, ${avgShade}, ${triOpacity})`;
                              ctx.fill();
                          }
                      }
                  }
              }
          }
      }
      requestAnimationFrame(draw);
  }

  // --- INPUT LISTENERS ---
  window.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
      const clickX = e.clientX;
      const clickY = e.clientY;

      ripples.push({
          x: clickX, y: clickY, radius: 10, alpha: 1.0,
          color: document.body.classList.contains('dark-mode') ? '255, 255, 255' : '0, 0, 0'
      });

      const repulseSq = config.repulseRadius ** 2;

      nodes.forEach(node => {
          const dx = node.x - clickX;
          const dy = node.y - clickY;
          const distSq = dx*dx + dy*dy;
          
          if (distSq < repulseSq) {
              const dist = Math.sqrt(distSq);
              const angle = Math.atan2(dy, dx);
              const force = (config.repulseRadius - dist) / config.repulseRadius; 
              const blast = force * config.repulseForce;
              node.vx += Math.cos(angle) * blast;
              node.vy += Math.sin(angle) * blast;
          }
      });
  });

  const shakeBtn = document.getElementById('shakeBtn');
  if (shakeBtn) {
      shakeBtn.addEventListener('click', () => {
          nodes.forEach(node => {
              node.vx += (Math.random() - 0.5) * 30;
              node.vy += (Math.random() - 0.5) * 30;
          });
      });
  }

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
      themeBtn.addEventListener('click', () => {
          document.body.classList.toggle('dark-mode');
          document.documentElement.classList.toggle('dark-mode');
          localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
      });
  }

  const modeBtn = document.getElementById('modeBtn');
  if (modeBtn) {
      modeBtn.textContent = config.mode === 'boids' ? '🦅' : '🧠';
      
      modeBtn.addEventListener('click', () => {
          config.mode = config.mode === 'neural' ? 'boids' : 'neural';
          modeBtn.textContent = config.mode === 'boids' ? '🦅' : '🧠';
          localStorage.setItem('simMode', config.mode);
          // RESET NODES WITH NEW COUNT
          initNodes(); 
      });
  }

  if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark-mode');
  }
  
  if (modeBtn) {
       modeBtn.textContent = config.mode === 'boids' ? '🦅' : '🧠';
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  draw();
});