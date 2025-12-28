/**
 * Quantum Circuit Representation
 * Manages the circuit state and provides serialization
 */

class QuantumCircuit {
    constructor(numQubits = 3) {
        this.numQubits = numQubits;
        this.gates = []; // Array of gate operations
        this.nextPosition = 0;
        this.onChangeCallbacks = [];
    }

    /**
     * Add a listener for circuit changes
     */
    onChange(callback) {
        this.onChangeCallbacks.push(callback);
    }

    /**
     * Notify listeners of changes
     */
    _notifyChange() {
        this.onChangeCallbacks.forEach(cb => cb(this));
    }

    /**
     * Set the number of qubits
     */
    setNumQubits(n) {
        this.numQubits = n;
        // Remove gates that reference non-existent qubits
        this.gates = this.gates.filter(g => {
            if (g.qubit >= n) return false;
            if (g.targetQubit !== undefined && g.targetQubit >= n) return false;
            return true;
        });
        this._notifyChange();
    }

    /**
     * Add a gate to the circuit
     */
    addGate(gate, qubit, options = {}) {
        const { targetQubit, params, position } = options;

        const gateOp = {
            id: Date.now() + Math.random(),
            gate,
            qubit,
            position: position !== undefined ? position : this._findNextPosition(qubit),
            params: params || {}
        };

        if (targetQubit !== undefined) {
            gateOp.targetQubit = targetQubit;
        }

        this.gates.push(gateOp);
        this._notifyChange();

        return gateOp.id;
    }

    /**
     * Find the next available position for a qubit
     */
    _findNextPosition(qubit) {
        const qubitGates = this.gates.filter(g =>
            g.qubit === qubit || g.targetQubit === qubit
        );

        if (qubitGates.length === 0) return 0;

        const maxPos = Math.max(...qubitGates.map(g => g.position));
        return maxPos + 1;
    }

    /**
     * Remove a gate by ID
     */
    removeGate(gateId) {
        const index = this.gates.findIndex(g => g.id === gateId);
        if (index !== -1) {
            this.gates.splice(index, 1);
            this._notifyChange();
        }
    }

    /**
     * Update gate parameters
     */
    updateGate(gateId, updates) {
        const gate = this.gates.find(g => g.id === gateId);
        if (gate) {
            Object.assign(gate, updates);
            this._notifyChange();
        }
    }

    /**
     * Clear all gates
     */
    clear() {
        this.gates = [];
        this.nextPosition = 0;
        this._notifyChange();
    }

    /**
     * Get the maximum position (circuit depth)
     */
    getDepth() {
        if (this.gates.length === 0) return 0;
        return Math.max(...this.gates.map(g => g.position)) + 1;
    }

    /**
     * Get gates at a specific position
     */
    getGatesAtPosition(position) {
        return this.gates.filter(g => g.position === position);
    }

    /**
     * Get gates on a specific qubit
     */
    getGatesOnQubit(qubit) {
        return this.gates.filter(g => g.qubit === qubit || g.targetQubit === qubit)
            .sort((a, b) => a.position - b.position);
    }

    /**
     * Generate Qiskit code
     */
    toQiskitCode() {
        const lines = [];
        lines.push('from qiskit import QuantumCircuit, transpile');
        lines.push('from qiskit_aer import AerSimulator');
        lines.push('');
        lines.push(`qc = QuantumCircuit(${this.numQubits}, ${this.numQubits})`);
        lines.push('');

        // Sort gates by position
        const sortedGates = [...this.gates].sort((a, b) => a.position - b.position);

        let hasMeasurement = false;
        for (const gateOp of sortedGates) {
            const gateDef = GATES[gateOp.gate];
            if (!gateDef) continue;

            if (gateOp.gate === 'M') {
                hasMeasurement = true;
                continue; // Handle measurement separately
            }

            if (gateDef.type === 'rotation') {
                const theta = gateOp.params.theta || 0;
                lines.push(gateDef.qiskit(gateOp.qubit, theta.toFixed(4)));
            } else if (gateDef.type === 'controlled' || gateDef.type === 'swap') {
                lines.push(gateDef.qiskit(gateOp.qubit, gateOp.targetQubit));
            } else {
                lines.push(gateDef.qiskit(gateOp.qubit));
            }
        }

        // Add measurement at the end if any measurement gates exist
        if (hasMeasurement || sortedGates.some(g => g.gate === 'M')) {
            lines.push('');
            lines.push('qc.measure_all()');
        }

        lines.push('');
        lines.push('# Simulate');
        lines.push('simulator = AerSimulator()');
        lines.push('compiled = transpile(qc, simulator)');
        lines.push('result = simulator.run(compiled, shots=1024).result()');
        lines.push('counts = result.get_counts()');
        lines.push('print(counts)');

        return lines.join('\n');
    }

    /**
     * Generate PennyLane code
     */
    toPennyLaneCode() {
        const lines = [];
        lines.push('import pennylane as qml');
        lines.push('from pennylane import numpy as np');
        lines.push('');
        lines.push(`dev = qml.device("default.qubit", wires=${this.numQubits})`);
        lines.push('');
        lines.push('@qml.qnode(dev)');
        lines.push('def circuit():');

        // Sort gates by position
        const sortedGates = [...this.gates].sort((a, b) => a.position - b.position);

        if (sortedGates.length === 0) {
            lines.push('    pass');
        } else {
            for (const gateOp of sortedGates) {
                const gateDef = GATES[gateOp.gate];
                if (!gateDef) continue;

                if (gateOp.gate === 'M') {
                    continue; // PennyLane handles measurement differently
                }

                if (gateDef.type === 'rotation') {
                    const theta = gateOp.params.theta || 0;
                    lines.push('    ' + gateDef.pennylane(gateOp.qubit, theta.toFixed(4)));
                } else if (gateDef.type === 'controlled' || gateDef.type === 'swap') {
                    lines.push('    ' + gateDef.pennylane(gateOp.qubit, gateOp.targetQubit));
                } else {
                    lines.push('    ' + gateDef.pennylane(gateOp.qubit));
                }
            }
        }

        // Return probabilities
        lines.push(`    return qml.probs(wires=range(${this.numQubits}))`);
        lines.push('');
        lines.push('# Run the circuit');
        lines.push('probs = circuit()');
        lines.push('print("Probabilities:", probs)');
        lines.push('');
        lines.push('# Draw the circuit');
        lines.push('print(qml.draw(circuit)())');

        return lines.join('\n');
    }

    /**
     * Export circuit to JSON
     */
    toJSON() {
        return {
            numQubits: this.numQubits,
            gates: this.gates.map(g => ({
                gate: g.gate,
                qubit: g.qubit,
                targetQubit: g.targetQubit,
                position: g.position,
                params: g.params
            }))
        };
    }

    /**
     * Import circuit from JSON
     */
    fromJSON(data) {
        this.numQubits = data.numQubits || 3;
        this.gates = (data.gates || []).map(g => ({
            ...g,
            id: Date.now() + Math.random()
        }));
        this._notifyChange();
    }

    /**
     * Clone the circuit
     */
    clone() {
        const newCircuit = new QuantumCircuit(this.numQubits);
        newCircuit.gates = this.gates.map(g => ({ ...g, id: Date.now() + Math.random() }));
        return newCircuit;
    }
}

// Export
window.QuantumCircuit = QuantumCircuit;
