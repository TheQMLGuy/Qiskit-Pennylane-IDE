/**
 * Bloch Sphere Visualizer
 * 2D Canvas rendering with 3D perspective effect
 */

class BlochSphere {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.radius = Math.min(this.width, this.height) / 2 - 20;

        // 3D rotation for viewing angle
        this.viewAngleX = 0.4; // Tilt
        this.viewAngleZ = -0.5; // Rotation

        // State vector (Bloch coordinates)
        this.stateX = 0;
        this.stateY = 0;
        this.stateZ = 1; // Default |0⟩ state

        // Animation
        this.animationFrame = null;
        this.targetX = 0;
        this.targetY = 0;
        this.targetZ = 1;

        // Colors
        this.colors = {
            sphere: 'rgba(99, 102, 241, 0.1)',
            sphereStroke: 'rgba(99, 102, 241, 0.3)',
            equator: 'rgba(139, 92, 246, 0.5)',
            axis: 'rgba(156, 163, 175, 0.5)',
            axisLabel: '#9ca3af',
            stateVector: '#ec4899',
            stateGlow: 'rgba(236, 72, 153, 0.4)',
            ket0: '#10b981',
            ket1: '#ef4444',
            ketPlus: '#3b82f6',
            ketMinus: '#f59e0b'
        };

        // Initial render
        this.render();
    }

    /**
     * Project 3D point to 2D canvas coordinates
     */
    project(x, y, z) {
        // Apply viewing rotation
        // Rotate around X axis (tilt)
        const cosX = Math.cos(this.viewAngleX);
        const sinX = Math.sin(this.viewAngleX);
        const y1 = y * cosX - z * sinX;
        const z1 = y * sinX + z * cosX;

        // Rotate around Z axis (spin)
        const cosZ = Math.cos(this.viewAngleZ);
        const sinZ = Math.sin(this.viewAngleZ);
        const x2 = x * cosZ - y1 * sinZ;
        const y2 = x * sinZ + y1 * cosZ;

        // Simple orthographic projection
        const screenX = this.centerX + x2 * this.radius;
        const screenY = this.centerY - z1 * this.radius;

        return { x: screenX, y: screenY, depth: y2 };
    }

    /**
     * Set the qubit state from Bloch coordinates
     */
    setState(x, y, z, animate = true) {
        this.targetX = x;
        this.targetY = y;
        this.targetZ = z;

        if (animate) {
            this._animateToTarget();
        } else {
            this.stateX = x;
            this.stateY = y;
            this.stateZ = z;
            this.render();
        }
    }

    /**
     * Set state from density matrix elements
     */
    setStateFromQubit(qubitState) {
        const { x, y, z } = qubitState;
        this.setState(x, y, z);
    }

    _animateToTarget() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        const animate = () => {
            const ease = 0.15;

            this.stateX += (this.targetX - this.stateX) * ease;
            this.stateY += (this.targetY - this.stateY) * ease;
            this.stateZ += (this.targetZ - this.stateZ) * ease;

            const diff = Math.abs(this.stateX - this.targetX) +
                Math.abs(this.stateY - this.targetY) +
                Math.abs(this.stateZ - this.targetZ);

            this.render();

            if (diff > 0.001) {
                this.animationFrame = requestAnimationFrame(animate);
            }
        };

        this.animationFrame = requestAnimationFrame(animate);
    }

    /**
     * Full render
     */
    render() {
        const ctx = this.ctx;

        // Clear canvas
        ctx.clearRect(0, 0, this.width, this.height);

        // Draw sphere
        this._drawSphere();

        // Draw axes
        this._drawAxes();

        // Draw state markers
        this._drawStateMarkers();

        // Draw state vector
        this._drawStateVector();
    }

    _drawSphere() {
        const ctx = this.ctx;

        // Main sphere (gradient for 3D effect)
        const gradient = ctx.createRadialGradient(
            this.centerX - this.radius * 0.3,
            this.centerY - this.radius * 0.3,
            0,
            this.centerX,
            this.centerY,
            this.radius
        );
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
        gradient.addColorStop(0.7, 'rgba(99, 102, 241, 0.05)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.02)');

        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = this.colors.sphereStroke;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw equator ellipse
        this._drawEllipse(0, 0, 0, 1, 0, this.colors.equator);

        // Draw meridians
        this._drawEllipse(0, 0, 0, 0, 1, 'rgba(139, 92, 246, 0.2)');
        this._drawEllipse(0, 1, 0, 0, 1, 'rgba(139, 92, 246, 0.2)');
    }

    _drawEllipse(nx, ny, nz, tx, ty) {
        const ctx = this.ctx;
        const segments = 64;

        ctx.beginPath();

        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            // Calculate point on circle in 3D
            let x, y, z;
            if (Math.abs(nz) < 0.01) {
                // Vertical circle
                x = cos * tx + sin * 0;
                y = cos * ty + sin * 0;
                z = sin;
            } else {
                // Horizontal circle (equator)
                x = cos;
                y = sin;
                z = 0;
            }

            const projected = this.project(x, y, z);

            if (i === 0) {
                ctx.moveTo(projected.x, projected.y);
            } else {
                ctx.lineTo(projected.x, projected.y);
            }
        }

        ctx.strokeStyle = this.colors.equator;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    _drawAxes() {
        const ctx = this.ctx;
        const axisLength = 1.2;

        // X axis (red-ish)
        this._drawAxis(axisLength, 0, 0, 'X', '#ef4444');

        // Y axis (green-ish)
        this._drawAxis(0, axisLength, 0, 'Y', '#10b981');

        // Z axis (blue-ish)
        this._drawAxis(0, 0, axisLength, 'Z', '#3b82f6');
    }

    _drawAxis(x, y, z, label, color) {
        const ctx = this.ctx;
        const origin = this.project(0, 0, 0);
        const end = this.project(x, y, z);
        const negEnd = this.project(-x * 0.8, -y * 0.8, -z * 0.8);

        // Draw axis line
        ctx.beginPath();
        ctx.moveTo(negEnd.x, negEnd.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Draw label
        ctx.font = '12px JetBrains Mono, monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, end.x + 10, end.y);
    }

    _drawStateMarkers() {
        const ctx = this.ctx;

        // |0⟩ at north pole
        const ket0 = this.project(0, 0, 1);
        this._drawMarker(ket0.x, ket0.y, '|0⟩', this.colors.ket0);

        // |1⟩ at south pole
        const ket1 = this.project(0, 0, -1);
        this._drawMarker(ket1.x, ket1.y, '|1⟩', this.colors.ket1);

        // |+⟩ on +X axis
        const ketPlus = this.project(1, 0, 0);
        this._drawMarker(ketPlus.x, ketPlus.y, '|+⟩', this.colors.ketPlus, true);

        // |-⟩ on -X axis
        const ketMinus = this.project(-1, 0, 0);
        this._drawMarker(ketMinus.x, ketMinus.y, '|-⟩', this.colors.ketMinus, true);
    }

    _drawMarker(x, y, label, color, small = false) {
        const ctx = this.ctx;

        // Dot
        ctx.beginPath();
        ctx.arc(x, y, small ? 3 : 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Label
        ctx.font = `${small ? 10 : 12}px JetBrains Mono, monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, x, y - 8);
    }

    _drawStateVector() {
        const ctx = this.ctx;

        // Normalize state vector (should already be on unit sphere)
        const length = Math.sqrt(this.stateX ** 2 + this.stateY ** 2 + this.stateZ ** 2);
        const nx = length > 0 ? this.stateX / length : 0;
        const ny = length > 0 ? this.stateY / length : 0;
        const nz = length > 0 ? this.stateZ / length : 1;

        const origin = this.project(0, 0, 0);
        const end = this.project(nx, ny, nz);

        // Glow effect
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = this.colors.stateGlow;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Main vector
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = this.colors.stateVector;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Arrow head
        const arrowSize = 10;
        const angle = Math.atan2(end.y - origin.y, end.x - origin.x);

        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
            end.x - arrowSize * Math.cos(angle - Math.PI / 6),
            end.y - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            end.x - arrowSize * Math.cos(angle + Math.PI / 6),
            end.y - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = this.colors.stateVector;
        ctx.fill();

        // State point (sphere on tip)
        ctx.beginPath();
        ctx.arc(end.x, end.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = this.colors.stateVector;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw projection on XY plane
        if (Math.abs(nz) < 0.99) {
            const proj = this.project(nx, ny, 0);

            // Dashed line from projection to state
            ctx.beginPath();
            ctx.setLineDash([3, 3]);
            ctx.moveTo(proj.x, proj.y);
            ctx.lineTo(end.x, end.y);
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);

            // Small dot at projection
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(236, 72, 153, 0.5)';
            ctx.fill();
        }
    }

    /**
     * Get state as formatted string
     */
    getStateString() {
        // Convert Bloch coordinates to ket notation
        const theta = Math.acos(this.stateZ);
        const phi = Math.atan2(this.stateY, this.stateX);

        const alpha = Math.cos(theta / 2);
        const beta = Math.sin(theta / 2);

        if (Math.abs(beta) < 0.001) {
            return '|0⟩';
        }
        if (Math.abs(alpha) < 0.001) {
            return '|1⟩';
        }

        const alphaStr = alpha.toFixed(3);
        const betaReal = (beta * Math.cos(phi)).toFixed(3);
        const betaImag = (beta * Math.sin(phi)).toFixed(3);

        let betaStr;
        if (Math.abs(parseFloat(betaImag)) < 0.001) {
            betaStr = betaReal;
        } else if (Math.abs(parseFloat(betaReal)) < 0.001) {
            betaStr = `${betaImag}i`;
        } else {
            const sign = parseFloat(betaImag) >= 0 ? '+' : '';
            betaStr = `(${betaReal}${sign}${betaImag}i)`;
        }

        return `${alphaStr}|0⟩ + ${betaStr}|1⟩`;
    }
}

// Export
window.BlochSphere = BlochSphere;
