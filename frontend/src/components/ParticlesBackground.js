import React, { useEffect, useMemo, useCallback } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import '../App.css'; // Ensure this line is present to apply your CSS

const ParticlesComponent = ({ id, darkMode }) => {

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    });
  }, []);

  const particlesLoaded = useCallback((container) => {
    console.log(container);
  }, []);

  const options = useMemo(
    () => ({
      background: {
        color: {
          value: darkMode ? "#000000" : "#f0f2f5",
        },
      },
      fpsLimit: 120,
      interactivity: {
        events: {
          onClick: {
            enable: true,
            mode: "repulse",
          },
          onHover: {
            enable: true,
            mode: "grab",
          },
        },
        modes: {
          push: {
            distance: 200,
            duration: 15,
          },
          grab: {
            distance: 150,
          },
        },
      },
      particles: {
        color: {
          value: "#61dafb",
        },
        links: {
          color: "#61dafb",
          distance: 150,
          enable: true,
          opacity: 0.4,
          width: 1,
        },
        move: {
          direction: "none",
          enable: true,
          outModes: {
            default: "bounce",
          },
          random: true,
          speed: 1,
          straight: false,
        },
        number: {
          density: {
            enable: true,
          },
          value: 150,
        },
        opacity: {
          value: 0.5,
        },
        shape: {
          type: "polygon",
          polygon: {
            nb_sides: 6, // Hexagon shape
          },
        },
        size: {
          value: { min: 3, max: 6 },
        },
      },
      detectRetina: true,
    }),
    [darkMode],
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: -1,
    }}>
      <Particles id={id} init={particlesLoaded} options={options} />
    </div>
  );
};

export default React.memo(ParticlesComponent);
