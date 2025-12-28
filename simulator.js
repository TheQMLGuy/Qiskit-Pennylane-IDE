/**
 * Quantum Simulator
 * JavaScript-based quantum state simulation for instant visual feedback
 */

class QuantumSimulator {
    constructor(numQubits = 3) {
        this.numQubits = numQubits;
        this.stateVector = null;
        this.reset();
    }

    /**
     * Reset to |0...0⟩ state
     */
    reset() {
        const size = Math.pow(2, this.numQubits);
        this.stateVector = new Array(size).fill(null).map(() => Complex.create(0, 0));
        this.stateVector[0] = Complex.create(1, 0); // |00...0⟩
    }

    /**
     * Set number of qubits and reset
     */
    setNumQubits(n) {
        this.numQubits = n;
        this.reset();
    }

    /**
     * Get the full state vector
     */
    getStateVector() {
        return this.stateVector.map(c => ({ ...c }));
    }

    /**
     * Get measurement probabilities for each basis state
     */
    getProbabilities() {
        return this.stateVector.map(c => {
            const mag = Complex.magnitude(c);
            return mag * mag;
        });
    }

    /**
     * Get the reduced density matrix for a single qubit
     * Returns the Bloch sphere coordinates (x, y, z)
     */
    getQubitState(qubitIndex) {
        const n = this.numQubits;
        const size = Math.pow(2, n);

        // Calculate reduced density matrix elements
        let rho00 = Complex.create(0, 0);
        let rho01 = Complex.create(0, 0);
        let rho10 = Complex.create(0, 0);
        let rho11 = Complex.create(0, 0);

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                // Check if states i and j differ only in the target qubit
                const bitI = (i >> (n - 1 - qubitIndex)) & 1;
                const bitJ = (j >> (n - 1 - qubitIndex)) & 1;

                // Mask to check other qubits
                const mask = ~(1 << (n - 1 - qubitIndex));
                const otherBitsI = i & mask;
                const otherBitsJ = j & mask;

                if (otherBitsI === otherBitsJ) {
                    const amp_i = this.stateVector[i];
                    const amp_j = this.stateVector[j];
                    const contrib = Complex.multiply(amp_i, Complex.conjugate(amp_j));

                    if (bitI === 0 && bitJ === 0) {
                        rho00 = Complex.add(rho00, contrib);
                    } else if (bitI === 0 && bitJ === 1) {
                        rho01 = Complex.add(rho01, contrib);
                    } else if (bitI === 1 && bitJ === 0) {
                        rho10 = Complex.add(rho10, contrib);
                    } else {
                        rho11 = Complex.add(rho11, contrib);
                    }
                }
            }
        }

        // Convert to Bloch sphere coordinates
        // x = 2 * Re(rho01)
        // y = 2 * Im(rho01)
        // z = rho00 - rho11
        const x = 2 * rho01.re;
        const y = 2 * rho01.im;
        const z = rho00.re - rho11.re;

        // Purity (1 for pure state, < 1 for mixed)
        const purity = rho00.re * rho00.re + rho11.re * rho11.re +
            2 * (rho01.re * rho01.re + rho01.im * rho01.im);

        return { x, y, z, purity, rho00, rho11, rho01 };
    }

    /**
     * Apply a single-qubit gate
     */
    applySingleQubitGate(gateName, qubitIndex, params = {}) {
        const gate = GATES[gateName];
        if (!gate) {
            console.error(`Unknown gate: ${gateName}`);
            return;
        }

        let matrix;
        if (gate.type === 'rotation') {
            const theta = params.theta || 0;
            matrix = gate.getMatrix(theta);
        } else {
            matrix = gate.matrix;
        }

        if (!matrix) return;

        const n = this.numQubits;
        const size = Math.pow(2, n);
        const newState = new Array(size).fill(null).map(() => Complex.create(0, 0));

        // Apply gate to the specified qubit
        for (let i = 0; i < size; i++) {
            const bit = (i >> (n - 1 - qubitIndex)) & 1;

            for (let newBit = 0; newBit <= 1; newBit++) {
                // Calculate the new index
                const newIndex = (i & ~(1 << (n - 1 - qubitIndex))) | (newBit << (n - 1 - qubitIndex));

                // Get matrix element
                const matrixElement = Complex.fromNumber(matrix[newBit][bit]);
                const contribution = Complex.multiply(matrixElement, this.stateVector[i]);
                newState[newIndex] = Complex.add(newState[newIndex], contribution);
            }
        }

        this.stateVector = newState;
    }

    /**
     * Apply CNOT gate
     */
    applyCNOT(controlQubit, targetQubit) {
        const n = this.numQubits;
        const size = Math.pow(2, n);
        const newState = [...this.stateVector.map(c => ({ ...c }))];

        for (let i = 0; i < size; i++) {
            const controlBit = (i >> (n - 1 - controlQubit)) & 1;

            if (controlBit === 1) {
                // Flip the target qubit
                const targetBit = (i >> (n - 1 - targetQubit)) & 1;
                const newTargetBit = 1 - targetBit;
                const newIndex = (i & ~(1 << (n - 1 - targetQubit))) | (newTargetBit << (n - 1 - targetQubit));

                // Swap amplitudes
                const temp = newState[i];
                newState[i] = newState[newIndex];
                newState[newIndex] = temp;
            }
        }

        this.stateVector = newState;
    }

    /**
     * Apply CZ gate
     */
    applyCZ(controlQubit, targetQubit) {
        const n = this.numQubits;
        const size = Math.pow(2, n);

        for (let i = 0; i < size; i++) {
            const controlBit = (i >> (n - 1 - controlQubit)) & 1;
            const targetBit = (i >> (n - 1 - targetQubit)) & 1;

            if (controlBit === 1 && targetBit === 1) {
                // Apply -1 phase
                this.stateVector[i] = Complex.multiply(this.stateVector[i], Complex.create(-1, 0));
            }
        }
    }

    /**
     * Apply SWAP gate
     */
    applySWAP(qubit1, qubit2) {
        const n = this.numQubits;
        const size = Math.pow(2, n);
        const newState = new Array(size).fill(null).map(() => Complex.create(0, 0));

        for (let i = 0; i < size; i++) {
            const bit1 = (i >> (n - 1 - qubit1)) & 1;
            const bit2 = (i >> (n - 1 - qubit2)) & 1;

            // Create new index with swapped bits
            let newIndex = i;
            newIndex = (newIndex & ~(1 << (n - 1 - qubit1))) | (bit2 << (n - 1 - qubit1));
            newIndex = (newIndex & ~(1 << (n - 1 - qubit2))) | (bit1 << (n - 1 - qubit2));

            newState[newIndex] = { ...this.stateVector[i] };
        }

        this.stateVector = newState;
    }

    /**
     * Apply any gate from the circuit
     */
    applyGate(gateOp) {
        const { gate, qubit, targetQubit, params } = gateOp;

        switch (gate) {
            case 'H':
            case 'X':
            case 'Y':
            case 'Z':
            case 'S':
            case 'T':
                this.applySingleQubitGate(gate, qubit);
                break;
            case 'RX':
            case 'RY':
            case 'RZ':
                this.applySingleQubitGate(gate, qubit, params);
                break;
            case 'CNOT':
                this.applyCNOT(qubit, targetQubit);
                break;
            case 'CZ':
                this.applyCZ(qubit, targetQubit);
                break;
            case 'SWAP':
                this.applySWAP(qubit, targetQubit);
                break;
            case 'M':
                // Measurement doesn't change state in this simulator
                // (we just show probabilities)
                break;
            default:
                console.warn(`Unknown gate: ${gate}`);
        }
    }

    /**
     * Simulate a full circuit
     */
    simulateCircuit(circuit) {
        this.reset();

        // Sort gates by position (left to right)
        const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position);

        for (const gateOp of sortedGates) {
            this.applyGate(gateOp);
        }

        return {
            stateVector: this.getStateVector(),
            probabilities: this.getProbabilities()
        };
    }

    /**
     * Perform a measurement simulation (collapse state)
     * Returns the measurement result as a bit string
     */
    measure() {
        const probs = this.getProbabilities();
        const rand = Math.random();

        let cumulative = 0;
        for (let i = 0; i < probs.length; i++) {
            cumulative += probs[i];
            if (rand <= cumulative) {
                // Return the binary representation
                return i.toString(2).padStart(this.numQubits, '0');
            }
        }

        // Fallback
        return '0'.repeat(this.numQubits);
    }

    /**
     * Get state as formatted strings for display
     */
    getFormattedState() {
        const states = [];
        for (let i = 0; i < this.stateVector.length; i++) {
            const amp = this.stateVector[i];
            const prob = Complex.magnitude(amp) ** 2;

            if (prob > 0.0001) { // Only show non-negligible amplitudes
                const basis = '|' + i.toString(2).padStart(this.numQubits, '0') + '⟩';
                states.push({
                    basis,
                    amplitude: Complex.toString(amp),
                    probability: prob,
                    phase: Complex.phase(amp)
                });
            }
        }
        return states;
    }
}

// Export
window.QuantumSimulator = QuantumSimulator;
