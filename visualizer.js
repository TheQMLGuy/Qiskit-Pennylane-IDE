/**
 * Circuit Visualizer
 * SVG-based quantum circuit rendering with drag-and-drop support
 */

class CircuitVisualizer {
    constructor(svgElement, circuit) {
        this.svg = svgElement;
        this.circuit = circuit;

        // Layout constants
        this.padding = { top: 30, right: 40, bottom: 30, left: 60 };
        this.qubitSpacing = 60;
        this.gateSpacing = 70;
        this.gateSize = 40;
        this.wireColor = '#4b5563';
        this.wireWidth = 2;

        // Interaction state
        this.selectedGate = null;
        this.draggedGate = null;
        this.dropZone = null;

        // Callbacks
        this.onGateClickCallback = null;
        this.onGateAddedCallback = null;
        this.onGateRemovedCallback = null;

        // Initialize
        this._setupSVG();
        this._setupDropZones();
    }

    _setupSVG() {
        // Clear existing content
        this.svg.innerHTML = '';

        // Set viewBox for responsive sizing
        const width = Math.max(600, this.padding.left + this.padding.right +
            (this.circuit.getDepth() + 2) * this.gateSpacing);
        const height = this.padding.top + this.padding.bottom +
            (this.circuit.numQubits - 1) * this.qubitSpacing;

        this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        this.svg.style.minWidth = width + 'px';
        this.svg.style.minHeight = height + 'px';

        // Create defs for reusable elements
        const defs = this._createSVGElement('defs');

        // Glow filter
        const glowFilter = this._createSVGElement('filter', {
            id: 'glow',
            x: '-50%',
            y: '-50%',
            width: '200%',
            height: '200%'
        });

        const feGaussianBlur = this._createSVGElement('feGaussianBlur', {
            stdDeviation: '3',
            result: 'coloredBlur'
        });

        const feMerge = this._createSVGElement('feMerge');
        feMerge.appendChild(this._createSVGElement('feMergeNode', { in: 'coloredBlur' }));
        feMerge.appendChild(this._createSVGElement('feMergeNode', { in: 'SourceGraphic' }));

        glowFilter.appendChild(feGaussianBlur);
        glowFilter.appendChild(feMerge);
        defs.appendChild(glowFilter);

        this.svg.appendChild(defs);

        // Create layers
        this.wiresLayer = this._createSVGElement('g', { class: 'wires-layer' });
        this.gatesLayer = this._createSVGElement('g', { class: 'gates-layer' });
        this.dropZonesLayer = this._createSVGElement('g', { class: 'dropzones-layer' });

        this.svg.appendChild(this.wiresLayer);
        this.svg.appendChild(this.dropZonesLayer);
        this.svg.appendChild(this.gatesLayer);
    }

    _createSVGElement(tag, attrs = {}) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [key, value] of Object.entries(attrs)) {
            el.setAttribute(key, value);
        }
        return el;
    }

    _setupDropZones() {
        // Make SVG a drop target
        this.svg.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';

            // Highlight drop zone
            const pos = this._getDropPosition(e);
            this._highlightDropZone(pos);
        });

        this.svg.addEventListener('dragleave', () => {
            this._clearDropHighlight();
        });

        this.svg.addEventListener('drop', (e) => {
            e.preventDefault();
            this._clearDropHighlight();

            const gateType = e.dataTransfer.getData('gate');
            if (!gateType) return;

            const pos = this._getDropPosition(e);
            if (pos) {
                if (this.onGateAddedCallback) {
                    this.onGateAddedCallback(gateType, pos.qubit, pos.position);
                }
            }
        });
    }

    _getDropPosition(e) {
        const rect = this.svg.getBoundingClientRect();
        const viewBox = this.svg.viewBox.baseVal;

        // Scale mouse coordinates to viewBox
        const scaleX = viewBox.width / rect.width;
        const scaleY = viewBox.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Calculate qubit and position
        const qubit = Math.round((y - this.padding.top) / this.qubitSpacing);
        const position = Math.round((x - this.padding.left) / this.gateSpacing);

        // Validate
        if (qubit < 0 || qubit >= this.circuit.numQubits) return null;
        if (position < 0) return null;

        return { qubit, position: Math.max(0, position) };
    }

    _highlightDropZone(pos) {
        this._clearDropHighlight();
        if (!pos) return;

        const x = this.padding.left + pos.position * this.gateSpacing;
        const y = this.padding.top + pos.qubit * this.qubitSpacing;

        const highlight = this._createSVGElement('rect', {
            x: x - this.gateSize / 2 - 5,
            y: y - this.gateSize / 2 - 5,
            width: this.gateSize + 10,
            height: this.gateSize + 10,
            rx: 10,
            fill: 'rgba(99, 102, 241, 0.3)',
            stroke: '#6366f1',
            'stroke-width': 2,
            'stroke-dasharray': '5,5',
            class: 'drop-highlight'
        });

        this.dropZonesLayer.appendChild(highlight);
    }

    _clearDropHighlight() {
        const highlights = this.dropZonesLayer.querySelectorAll('.drop-highlight');
        highlights.forEach(h => h.remove());
    }

    /**
     * Render the full circuit
     */
    render() {
        this._setupSVG();
        this._renderWires();
        this._renderGates();
        this._renderDropZones();
    }

    _renderWires() {
        const depth = Math.max(5, this.circuit.getDepth() + 2);
        const wireLength = this.padding.left + depth * this.gateSpacing;

        for (let q = 0; q < this.circuit.numQubits; q++) {
            const y = this.padding.top + q * this.qubitSpacing;

            // Qubit label
            const label = this._createSVGElement('text', {
                x: 15,
                y: y + 5,
                'font-family': 'JetBrains Mono, monospace',
                'font-size': '14',
                fill: '#9ca3af',
                'text-anchor': 'start'
            });
            label.textContent = `q${q}`;
            this.wiresLayer.appendChild(label);

            // Qubit state indicator (ket notation)
            const stateLabel = this._createSVGElement('text', {
                x: 40,
                y: y + 5,
                'font-family': 'JetBrains Mono, monospace',
                'font-size': '12',
                fill: '#6b7280',
                'text-anchor': 'start'
            });
            stateLabel.textContent = '|0⟩';
            this.wiresLayer.appendChild(stateLabel);

            // Wire line
            const wire = this._createSVGElement('line', {
                x1: this.padding.left - 10,
                y1: y,
                x2: wireLength,
                y2: y,
                stroke: this.wireColor,
                'stroke-width': this.wireWidth
            });
            this.wiresLayer.appendChild(wire);
        }
    }

    _renderGates() {
        for (const gateOp of this.circuit.gates) {
            this._renderGate(gateOp);
        }
    }

    _renderGate(gateOp) {
        const gateDef = GATES[gateOp.gate];
        if (!gateDef) return;

        const x = this.padding.left + gateOp.position * this.gateSpacing;
        const y = this.padding.top + gateOp.qubit * this.qubitSpacing;

        const group = this._createSVGElement('g', {
            class: 'gate',
            'data-gate-id': gateOp.id,
            cursor: 'pointer',
            transform: `translate(${x}, ${y})`
        });

        // Handle different gate types
        if (gateDef.type === 'controlled') {
            this._renderControlledGate(group, gateOp, gateDef, x, y);
        } else if (gateDef.type === 'swap') {
            this._renderSwapGate(group, gateOp, gateDef, x, y);
        } else if (gateDef.type === 'measure') {
            this._renderMeasureGate(group, gateOp, gateDef);
        } else {
            this._renderSingleQubitGate(group, gateOp, gateDef);
        }

        // Click handler
        group.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.onGateClickCallback) {
                this.onGateClickCallback(gateOp);
            }
        });

        // Right-click to delete
        group.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.onGateRemovedCallback) {
                this.onGateRemovedCallback(gateOp.id);
            }
        });

        this.gatesLayer.appendChild(group);
    }

    _renderSingleQubitGate(group, gateOp, gateDef) {
        const size = this.gateSize;

        // Gate box
        const rect = this._createSVGElement('rect', {
            x: -size / 2,
            y: -size / 2,
            width: size,
            height: size,
            rx: 8,
            fill: gateDef.bgColor,
            stroke: gateDef.color,
            'stroke-width': 2
        });
        group.appendChild(rect);

        // Gate label
        const text = this._createSVGElement('text', {
            x: 0,
            y: 5,
            'font-family': 'JetBrains Mono, monospace',
            'font-size': '16',
            'font-weight': '600',
            fill: gateDef.color,
            'text-anchor': 'middle'
        });
        text.textContent = gateDef.symbol;
        group.appendChild(text);

        // Parameter display for rotation gates
        if (gateDef.type === 'rotation' && gateOp.params.theta !== undefined) {
            const theta = gateOp.params.theta;
            const paramText = this._formatAngle(theta);

            const paramLabel = this._createSVGElement('text', {
                x: 0,
                y: size / 2 + 14,
                'font-family': 'JetBrains Mono, monospace',
                'font-size': '10',
                fill: '#9ca3af',
                'text-anchor': 'middle'
            });
            paramLabel.textContent = paramText;
            group.appendChild(paramLabel);
        }
    }

    _renderControlledGate(group, gateOp, gateDef, x, y) {
        if (gateOp.targetQubit === undefined) return;

        const targetY = this.padding.top + gateOp.targetQubit * this.qubitSpacing;
        const controlY = 0; // Relative to group
        const targetRelY = targetY - y;

        // Connection line
        const line = this._createSVGElement('line', {
            x1: 0,
            y1: controlY,
            x2: 0,
            y2: targetRelY,
            stroke: gateDef.color,
            'stroke-width': 2
        });
        group.appendChild(line);

        // Control dot
        const controlDot = this._createSVGElement('circle', {
            cx: 0,
            cy: controlY,
            r: 6,
            fill: gateDef.color
        });
        group.appendChild(controlDot);

        // Target gate
        if (gateOp.gate === 'CNOT') {
            // XOR symbol (circle with plus)
            const targetCircle = this._createSVGElement('circle', {
                cx: 0,
                cy: targetRelY,
                r: 15,
                fill: 'transparent',
                stroke: gateDef.color,
                'stroke-width': 2
            });
            group.appendChild(targetCircle);

            // Plus sign
            const hLine = this._createSVGElement('line', {
                x1: -10,
                y1: targetRelY,
                x2: 10,
                y2: targetRelY,
                stroke: gateDef.color,
                'stroke-width': 2
            });
            group.appendChild(hLine);

            const vLine = this._createSVGElement('line', {
                x1: 0,
                y1: targetRelY - 10,
                x2: 0,
                y2: targetRelY + 10,
                stroke: gateDef.color,
                'stroke-width': 2
            });
            group.appendChild(vLine);
        } else if (gateOp.gate === 'CZ') {
            // Z gate box on target
            const rect = this._createSVGElement('rect', {
                x: -15,
                y: targetRelY - 15,
                width: 30,
                height: 30,
                rx: 6,
                fill: gateDef.bgColor,
                stroke: gateDef.color,
                'stroke-width': 2
            });
            group.appendChild(rect);

            const text = this._createSVGElement('text', {
                x: 0,
                y: targetRelY + 5,
                'font-family': 'JetBrains Mono, monospace',
                'font-size': '14',
                'font-weight': '600',
                fill: gateDef.color,
                'text-anchor': 'middle'
            });
            text.textContent = 'Z';
            group.appendChild(text);
        }
    }

    _renderSwapGate(group, gateOp, gateDef, x, y) {
        if (gateOp.targetQubit === undefined) return;

        const targetY = this.padding.top + gateOp.targetQubit * this.qubitSpacing;
        const targetRelY = targetY - y;

        // Connection line
        const line = this._createSVGElement('line', {
            x1: 0,
            y1: 0,
            x2: 0,
            y2: targetRelY,
            stroke: gateDef.color,
            'stroke-width': 2
        });
        group.appendChild(line);

        // X marks at both qubits
        const drawX = (cy) => {
            const size = 8;
            const line1 = this._createSVGElement('line', {
                x1: -size,
                y1: cy - size,
                x2: size,
                y2: cy + size,
                stroke: gateDef.color,
                'stroke-width': 3
            });
            const line2 = this._createSVGElement('line', {
                x1: size,
                y1: cy - size,
                x2: -size,
                y2: cy + size,
                stroke: gateDef.color,
                'stroke-width': 3
            });
            group.appendChild(line1);
            group.appendChild(line2);
        };

        drawX(0);
        drawX(targetRelY);
    }

    _renderMeasureGate(group, gateOp, gateDef) {
        const size = this.gateSize;

        // Measurement box
        const rect = this._createSVGElement('rect', {
            x: -size / 2,
            y: -size / 2,
            width: size,
            height: size,
            rx: 6,
            fill: gateDef.bgColor,
            stroke: gateDef.color,
            'stroke-width': 2
        });
        group.appendChild(rect);

        // Meter arc
        const arc = this._createSVGElement('path', {
            d: 'M -12 6 A 14 14 0 0 1 12 6',
            fill: 'none',
            stroke: gateDef.color,
            'stroke-width': 2
        });
        group.appendChild(arc);

        // Meter needle
        const needle = this._createSVGElement('line', {
            x1: 0,
            y1: 8,
            x2: 8,
            y2: -8,
            stroke: gateDef.color,
            'stroke-width': 2
        });
        group.appendChild(needle);
    }

    _renderDropZones() {
        // Create subtle drop zone indicators
        const depth = Math.max(5, this.circuit.getDepth() + 2);

        for (let q = 0; q < this.circuit.numQubits; q++) {
            for (let p = 0; p <= depth; p++) {
                // Check if position is occupied
                const occupied = this.circuit.gates.some(g =>
                    g.position === p && (g.qubit === q || g.targetQubit === q)
                );

                if (!occupied) {
                    const x = this.padding.left + p * this.gateSpacing;
                    const y = this.padding.top + q * this.qubitSpacing;

                    const zone = this._createSVGElement('rect', {
                        x: x - 15,
                        y: y - 15,
                        width: 30,
                        height: 30,
                        rx: 6,
                        fill: 'transparent',
                        stroke: 'transparent',
                        'stroke-width': 1,
                        'stroke-dasharray': '4,4',
                        class: 'drop-zone',
                        opacity: 0.3
                    });

                    // Show on hover
                    zone.addEventListener('mouseenter', () => {
                        zone.setAttribute('stroke', '#4b5563');
                    });
                    zone.addEventListener('mouseleave', () => {
                        zone.setAttribute('stroke', 'transparent');
                    });

                    this.dropZonesLayer.appendChild(zone);
                }
            }
        }
    }

    _formatAngle(theta) {
        // Common angle values
        const PI = Math.PI;
        const tolerance = 0.01;

        const angles = [
            { value: 0, label: '0' },
            { value: PI / 4, label: 'π/4' },
            { value: PI / 2, label: 'π/2' },
            { value: 3 * PI / 4, label: '3π/4' },
            { value: PI, label: 'π' },
            { value: 5 * PI / 4, label: '5π/4' },
            { value: 3 * PI / 2, label: '3π/2' },
            { value: 7 * PI / 4, label: '7π/4' },
            { value: 2 * PI, label: '2π' }
        ];

        for (const angle of angles) {
            if (Math.abs(theta - angle.value) < tolerance) {
                return angle.label;
            }
        }

        return theta.toFixed(2);
    }

    // Callback setters
    onGateClick(callback) {
        this.onGateClickCallback = callback;
    }

    onGateAdded(callback) {
        this.onGateAddedCallback = callback;
    }

    onGateRemoved(callback) {
        this.onGateRemovedCallback = callback;
    }
}

// Export
window.CircuitVisualizer = CircuitVisualizer;
