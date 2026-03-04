import { useEffect, useRef } from "react";

export default function WavyBackground({
                                           colorA = "#28beef",
                                           colorB = "#2487cb",
                                           speed = 0.9,
                                           amplitude = 18,
                                           density = 1.2,
                                           opacity = 0.18,
                                       }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        let raf = 0;
        let t = 0;
        const dpr = Math.max(1, window.devicePixelRatio || 1);

        function resize() {
            const parent = canvas.parentElement;
            if (!parent) return;
            const rect = parent.getBoundingClientRect();

            canvas.width = Math.floor(rect.width * dpr);
            canvas.height = Math.floor(rect.height * dpr);
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function draw() {
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;

            ctx.clearRect(0, 0, w, h);

            // Soft vignette so edges are darker like your mock
            const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.6);
            vignette.addColorStop(0, "rgba(0,0,0,0)");
            vignette.addColorStop(1, "rgba(0,0,0,0.45)");
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, w, h);

            const grad = ctx.createLinearGradient(0, 0, w, 0);
            grad.addColorStop(0, colorA);
            grad.addColorStop(1, colorB);

            // 4 layered waves across the whole frame (subtle)
            for (let layer = 0; layer < 4; layer++) {
                const layerAmp = amplitude * (1 - layer * 0.18);
                const layerSpeed = speed * (1 - layer * 0.08);
                const alpha = opacity - layer * 0.03;

                const yBase = h * (0.58 + layer * 0.06);

                ctx.beginPath();
                ctx.moveTo(0, h);

                for (let x = 0; x <= w; x += 2) {
                    const nx = x / w;
                    const phase = t * layerSpeed + layer * 0.9;

                    const y =
                        yBase +
                        Math.sin(nx * Math.PI * 2 * density + phase) * layerAmp +
                        Math.sin(nx * Math.PI * 4 * density - phase * 0.65) * (layerAmp * 0.35);

                    ctx.lineTo(x, y);
                }

                ctx.lineTo(w, h);
                ctx.closePath();

                ctx.fillStyle = grad;
                ctx.globalAlpha = Math.max(0, alpha);
                ctx.fill();
            }

            // Thin glow trace line
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = 0; x <= w; x += 2) {
                const nx = x / w;
                const y = h * 0.62 + Math.sin(nx * Math.PI * 2 * density + t * speed) * (amplitude * 0.55);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            ctx.globalAlpha = 1;
            t += 0.016;
            raf = requestAnimationFrame(draw);
        }

        const ro = new ResizeObserver(resize);
        ro.observe(canvas.parentElement);
        resize();
        raf = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
        };
    }, [colorA, colorB, speed, amplitude, density, opacity]);

    return <canvas ref={canvasRef} className="auth-waves" aria-hidden="true" />;
}