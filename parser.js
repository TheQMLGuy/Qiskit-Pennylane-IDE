/**
 * Code Parser
 * Bidirectional translation between code and circuit representation
 */

class CodeParser {
    constructor() {
        this.framework = 'qiskit'; // 'qiskit' or 'pennylane'
    }

    setFramework(framework) {
        this.framework = framework;
    }

    /**
     * Parse code and extract circuit operations
     */
    parseCode(code) {
        if (this.framework === 'qiskit') {
            return this.parseQiskitCode(code);
        } else {
            return this.parsePennyLaneCode(code);
        }
    }

    /**
     * Parse Qiskit code
     */
    parseQiskitCode(code) {
        const result = {
            numQubits: 3,
            gates: [],
            errors: []
        };

        const lines = code.split('\n');
        let position = 0;
        const qubitPositions = {}; // Track position per qubit

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum].trim();

            // Parse QuantumCircuit initialization
            const qcMatch = line.match(/QuantumCircuit\s*\(\s*(\d+)/);
            if (qcMatch) {
                result.numQubits = parseInt(qcMatch[1]);
                for (let i = 0; i < result.numQubits; i++) {
                    qubitPositions[i] = 0;
                }
                continue;
            }

            // Parse gate operations
            // Single-qubit gates: qc.h(0), qc.x(1), etc.
            const singleGateMatch = line.match(/qc\.([hxyzst])\s*\(\s*(\d+)\s*\)/i);
            if (singleGateMatch) {
                const gateName = singleGateMatch[1].toUpperCase();
                const qubit = parseInt(singleGateMatch[2]);
                const pos = qubitPositions[qubit] || 0;

                result.gates.push({
                    gate: gateName,
                    qubit,
                    position: pos,
                    params: {}
                });

                qubitPositions[qubit] = pos + 1;
                continue;
            }

            // Rotation gates: qc.rx(theta, qubit), qc.ry(theta, qubit), qc.rz(theta, qubit)
            const rotGateMatch = line.match(/qc\.(r[xyz])\s*\(\s*([^,]+)\s*,\s*(\d+)\s*\)/i);
            if (rotGateMatch) {
                const gateName = rotGateMatch[1].toUpperCase();
                const theta = this._parseNumber(rotGateMatch[2]);
                const qubit = parseInt(rotGateMatch[3]);
                const pos = qubitPositions[qubit] || 0;

                result.gates.push({
                    gate: gateName,
                    qubit,
                    position: pos,
                    params: { theta }
                });

                qubitPositions[qubit] = pos + 1;
                continue;
            }

            // CNOT: qc.cx(control, target)
            const cxMatch = line.match(/qc\.cx\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i);
            if (cxMatch) {
                const control = parseInt(cxMatch[1]);
                const target = parseInt(cxMatch[2]);
                const pos = Math.max(qubitPositions[control] || 0, qubitPositions[target] || 0);

                result.gates.push({
                    gate: 'CNOT',
                    qubit: control,
                    targetQubit: target,
                    position: pos,
                    params: {}
                });

                qubitPositions[control] = pos + 1;
                qubitPositions[target] = pos + 1;
                continue;
            }

            // CZ: qc.cz(control, target)
            const czMatch = line.match(/qc\.cz\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i);
            if (czMatch) {
                const control = parseInt(czMatch[1]);
                const target = parseInt(czMatch[2]);
                const pos = Math.max(qubitPositions[control] || 0, qubitPositions[target] || 0);

                result.gates.push({
                    gate: 'CZ',
                    qubit: control,
                    targetQubit: target,
                    position: pos,
                    params: {}
                });

                qubitPositions[control] = pos + 1;
                qubitPositions[target] = pos + 1;
                continue;
            }

            // SWAP: qc.swap(qubit1, qubit2)
            const swapMatch = line.match(/qc\.swap\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i);
            if (swapMatch) {
                const qubit1 = parseInt(swapMatch[1]);
                const qubit2 = parseInt(swapMatch[2]);
                const pos = Math.max(qubitPositions[qubit1] || 0, qubitPositions[qubit2] || 0);

                result.gates.push({
                    gate: 'SWAP',
                    qubit: qubit1,
                    targetQubit: qubit2,
                    position: pos,
                    params: {}
                });

                qubitPositions[qubit1] = pos + 1;
                qubitPositions[qubit2] = pos + 1;
                continue;
            }

            // Measure: qc.measure(qubit, classical) or qc.measure_all()
            const measureMatch = line.match(/qc\.measure\s*\(\s*(\d+)/i);
            const measureAllMatch = line.match(/qc\.measure_all\s*\(\s*\)/i);

            if (measureAllMatch) {
                // Add measurement to all qubits
                for (let q = 0; q < result.numQubits; q++) {
                    const pos = qubitPositions[q] || 0;
                    result.gates.push({
                        gate: 'M',
                        qubit: q,
                        position: pos,
                        params: {}
                    });
                    qubitPositions[q] = pos + 1;
                }
                continue;
            }

            if (measureMatch) {
                const qubit = parseInt(measureMatch[1]);
                const pos = qubitPositions[qubit] || 0;

                result.gates.push({
                    gate: 'M',
                    qubit,
                    position: pos,
                    params: {}
                });

                qubitPositions[qubit] = pos + 1;
                continue;
            }
        }

        return result;
    }

    /**
     * Parse PennyLane code
     */
    parsePennyLaneCode(code) {
        const result = {
            numQubits: 3,
            gates: [],
            errors: []
        };

        const lines = code.split('\n');
        let position = 0;
        const qubitPositions = {};

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum].trim();

            // Parse device initialization
            const devMatch = line.match(/device\s*\([^)]*wires\s*=\s*(\d+)/);
            if (devMatch) {
                result.numQubits = parseInt(devMatch[1]);
                for (let i = 0; i < result.numQubits; i++) {
                    qubitPositions[i] = 0;
                }
                continue;
            }

            // Parse Hadamard: qml.Hadamard(wires=0)
            const hMatch = line.match(/qml\.Hadamard\s*\(\s*wires\s*=\s*(\d+)\s*\)/i);
            if (hMatch) {
                const qubit = parseInt(hMatch[1]);
                const pos = qubitPositions[qubit] || 0;
                result.gates.push({ gate: 'H', qubit, position: pos, params: {} });
                qubitPositions[qubit] = pos + 1;
                continue;
            }

            // Parse Pauli gates: qml.PauliX/Y/Z(wires=0)
            const pauliMatch = line.match(/qml\.Pauli([XYZ])\s*\(\s*wires\s*=\s*(\d+)\s*\)/i);
            if (pauliMatch) {
                const gateName = pauliMatch[1].toUpperCase();
                const qubit = parseInt(pauliMatch[2]);
                const pos = qubitPositions[qubit] || 0;
                result.gates.push({ gate: gateName, qubit, position: pos, params: {} });
                qubitPositions[qubit] = pos + 1;
                continue;
            }

            // Parse S and T gates
            const stMatch = line.match(/qml\.([ST])\s*\(\s*wires\s*=\s*(\d+)\s*\)/i);
            if (stMatch) {
                const gateName = stMatch[1].toUpperCase();
                const qubit = parseInt(stMatch[2]);
                const pos = qubitPositions[qubit] || 0;
                result.gates.push({ gate: gateName, qubit, position: pos, params: {} });
                qubitPositions[qubit] = pos + 1;
                continue;
            }

            // Parse rotation gates: qml.RX/RY/RZ(theta, wires=0)
            const rotMatch = line.match(/qml\.(R[XYZ])\s*\(\s*([^,]+)\s*,\s*wires\s*=\s*(\d+)\s*\)/i);
            if (rotMatch) {
                const gateName = rotMatch[1].toUpperCase();
                const theta = this._parseNumber(rotMatch[2]);
                const qubit = parseInt(rotMatch[3]);
                const pos = qubitPositions[qubit] || 0;
                result.gates.push({ gate: gateName, qubit, position: pos, params: { theta } });
                qubitPositions[qubit] = pos + 1;
                continue;
            }

            // Parse CNOT: qml.CNOT(wires=[0, 1])
            const cnotMatch = line.match(/qml\.CNOT\s*\(\s*wires\s*=\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]\s*\)/i);
            if (cnotMatch) {
                const control = parseInt(cnotMatch[1]);
                const target = parseInt(cnotMatch[2]);
                const pos = Math.max(qubitPositions[control] || 0, qubitPositions[target] || 0);
                result.gates.push({ gate: 'CNOT', qubit: control, targetQubit: target, position: pos, params: {} });
                qubitPositions[control] = pos + 1;
                qubitPositions[target] = pos + 1;
                continue;
            }

            // Parse CZ: qml.CZ(wires=[0, 1])
            const czMatch = line.match(/qml\.CZ\s*\(\s*wires\s*=\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]\s*\)/i);
            if (czMatch) {
                const control = parseInt(czMatch[1]);
                const target = parseInt(czMatch[2]);
                const pos = Math.max(qubitPositions[control] || 0, qubitPositions[target] || 0);
                result.gates.push({ gate: 'CZ', qubit: control, targetQubit: target, position: pos, params: {} });
                qubitPositions[control] = pos + 1;
                qubitPositions[target] = pos + 1;
                continue;
            }

            // Parse SWAP: qml.SWAP(wires=[0, 1])
            const swapMatch = line.match(/qml\.SWAP\s*\(\s*wires\s*=\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]\s*\)/i);
            if (swapMatch) {
                const qubit1 = parseInt(swapMatch[1]);
                const qubit2 = parseInt(swapMatch[2]);
                const pos = Math.max(qubitPositions[qubit1] || 0, qubitPositions[qubit2] || 0);
                result.gates.push({ gate: 'SWAP', qubit: qubit1, targetQubit: qubit2, position: pos, params: {} });
                qubitPositions[qubit1] = pos + 1;
                qubitPositions[qubit2] = pos + 1;
                continue;
            }
        }

        return result;
    }

    /**
     * Parse a number from code (handles pi, np.pi, math.pi, etc.)
     */
    _parseNumber(str) {
        str = str.trim();

        // Replace pi variants
        str = str.replace(/np\.pi/gi, Math.PI.toString());
        str = str.replace(/math\.pi/gi, Math.PI.toString());
        str = str.replace(/(?<![a-z])pi(?![a-z])/gi, Math.PI.toString());

        try {
            // Simple math evaluation
            return Function(`"use strict"; return (${str})`)();
        } catch {
            return parseFloat(str) || 0;
        }
    }

    /**
     * Generate code from circuit
     */
    generateCode(circuit) {
        if (this.framework === 'qiskit') {
            return circuit.toQiskitCode();
        } else {
            return circuit.toPennyLaneCode();
        }
    }

    /**
     * Check if code has been manually modified (comments, extra lines, etc.)
     */
    hasManualModifications(code) {
        // Check for comments
        if (code.includes('#') && !code.includes('# Simulate') && !code.includes('# Run')) {
            return true;
        }
        return false;
    }
}

// Export
window.CodeParser = CodeParser;
