/**
 * Quantum Gates Definition
 * Defines all quantum gates with their matrices, visual properties, and code templates
 */

const GATES = {
    // Single-qubit gates
    H: {
        name: 'Hadamard',
        symbol: 'H',
        type: 'single',
        color: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.2)',
        matrix: [
            [1/Math.sqrt(2), 1/Math.sqrt(2)],
            [1/Math.sqrt(2), -1/Math.sqrt(2)]
        ],
        qiskit: (qubit) => `qc.h(${qubit})`,
        pennylane: (qubit) => `qml.Hadamard(wires=${qubit})`
    },
    X: {
        name: 'Pauli-X (NOT)',
        symbol: 'X',
        type: 'single',
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.2)',
        matrix: [
            [0, 1],
            [1, 0]
        ],
        qiskit: (qubit) => `qc.x(${qubit})`,
        pennylane: (qubit) => `qml.PauliX(wires=${qubit})`
    },
    Y: {
        name: 'Pauli-Y',
        symbol: 'Y',
        type: 'single',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.2)',
        matrix: [
            [0, {re: 0, im: -1}],
            [{re: 0, im: 1}, 0]
        ],
        qiskit: (qubit) => `qc.y(${qubit})`,
        pennylane: (qubit) => `qml.PauliY(wires=${qubit})`
    },
    Z: {
        name: 'Pauli-Z',
        symbol: 'Z',
        type: 'single',
        color: '#8b5cf6',
        bgColor: 'rgba(139, 92, 246, 0.2)',
        matrix: [
            [1, 0],
            [0, -1]
        ],
        qiskit: (qubit) => `qc.z(${qubit})`,
        pennylane: (qubit) => `qml.PauliZ(wires=${qubit})`
    },
    S: {
        name: 'S Gate (Phase)',
        symbol: 'S',
        type: 'single',
        color: '#06b6d4',
        bgColor: 'rgba(6, 182, 212, 0.2)',
        matrix: [
            [1, 0],
            [0, {re: 0, im: 1}]
        ],
        qiskit: (qubit) => `qc.s(${qubit})`,
        pennylane: (qubit) => `qml.S(wires=${qubit})`
    },
    T: {
        name: 'T Gate',
        symbol: 'T',
        type: 'single',
        color: '#f97316',
        bgColor: 'rgba(249, 115, 22, 0.2)',
        matrix: [
            [1, 0],
            [0, {re: Math.cos(Math.PI/4), im: Math.sin(Math.PI/4)}]
        ],
        qiskit: (qubit) => `qc.t(${qubit})`,
        pennylane: (qubit) => `qml.T(wires=${qubit})`
    },
    
    // Rotation gates (parametric)
    RX: {
        name: 'Rotation X',
        symbol: 'Rx',
        type: 'rotation',
        color: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.15)',
        getMatrix: (theta) => [
            [Math.cos(theta/2), {re: 0, im: -Math.sin(theta/2)}],
            [{re: 0, im: -Math.sin(theta/2)}, Math.cos(theta/2)]
        ],
        qiskit: (qubit, theta) => `qc.rx(${theta}, ${qubit})`,
        pennylane: (qubit, theta) => `qml.RX(${theta}, wires=${qubit})`
    },
    RY: {
        name: 'Rotation Y',
        symbol: 'Ry',
        type: 'rotation',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
        getMatrix: (theta) => [
            [Math.cos(theta/2), -Math.sin(theta/2)],
            [Math.sin(theta/2), Math.cos(theta/2)]
        ],
        qiskit: (qubit, theta) => `qc.ry(${theta}, ${qubit})`,
        pennylane: (qubit, theta) => `qml.RY(${theta}, wires=${qubit})`
    },
    RZ: {
        name: 'Rotation Z',
        symbol: 'Rz',
        type: 'rotation',
        color: '#8b5cf6',
        bgColor: 'rgba(139, 92, 246, 0.15)',
        getMatrix: (theta) => [
            [{re: Math.cos(theta/2), im: -Math.sin(theta/2)}, 0],
            [0, {re: Math.cos(theta/2), im: Math.sin(theta/2)}]
        ],
        qiskit: (qubit, theta) => `qc.rz(${theta}, ${qubit})`,
        pennylane: (qubit, theta) => `qml.RZ(${theta}, wires=${qubit})`
    },
    
    // Multi-qubit gates
    CNOT: {
        name: 'Controlled-NOT',
        symbol: 'CX',
        type: 'controlled',
        color: '#ec4899',
        bgColor: 'rgba(236, 72, 153, 0.2)',
        // 4x4 matrix for 2-qubit operation
        matrix: [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 0, 1],
            [0, 0, 1, 0]
        ],
        qiskit: (control, target) => `qc.cx(${control}, ${target})`,
        pennylane: (control, target) => `qml.CNOT(wires=[${control}, ${target}])`
    },
    CZ: {
        name: 'Controlled-Z',
        symbol: 'CZ',
        type: 'controlled',
        color: '#ec4899',
        bgColor: 'rgba(236, 72, 153, 0.2)',
        matrix: [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, -1]
        ],
        qiskit: (control, target) => `qc.cz(${control}, ${target})`,
        pennylane: (control, target) => `qml.CZ(wires=[${control}, ${target}])`
    },
    SWAP: {
        name: 'SWAP',
        symbol: '⟷',
        type: 'swap',
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.2)',
        matrix: [
            [1, 0, 0, 0],
            [0, 0, 1, 0],
            [0, 1, 0, 0],
            [0, 0, 0, 1]
        ],
        qiskit: (qubit1, qubit2) => `qc.swap(${qubit1}, ${qubit2})`,
        pennylane: (qubit1, qubit2) => `qml.SWAP(wires=[${qubit1}, ${qubit2}])`
    },
    
    // Measurement
    M: {
        name: 'Measurement',
        symbol: '📊',
        type: 'measure',
        color: '#6b7280',
        bgColor: 'rgba(107, 114, 128, 0.2)',
        qiskit: (qubit) => `qc.measure(${qubit}, ${qubit})`,
        pennylane: (qubit) => `qml.measure(wires=${qubit})`
    }
};

// Gate categories for palette organization
const GATE_CATEGORIES = {
    single: ['H', 'X', 'Y', 'Z', 'S', 'T'],
    rotation: ['RX', 'RY', 'RZ'],
    controlled: ['CNOT', 'CZ'],
    swap: ['SWAP'],
    measure: ['M']
};

// Complex number utilities
const Complex = {
    create: (re, im = 0) => ({ re, im }),
    
    fromNumber: (n) => {
        if (typeof n === 'number') return { re: n, im: 0 };
        return n;
    },
    
    add: (a, b) => {
        a = Complex.fromNumber(a);
        b = Complex.fromNumber(b);
        return { re: a.re + b.re, im: a.im + b.im };
    },
    
    multiply: (a, b) => {
        a = Complex.fromNumber(a);
        b = Complex.fromNumber(b);
        return {
            re: a.re * b.re - a.im * b.im,
            im: a.re * b.im + a.im * b.re
        };
    },
    
    magnitude: (c) => {
        c = Complex.fromNumber(c);
        return Math.sqrt(c.re * c.re + c.im * c.im);
    },
    
    phase: (c) => {
        c = Complex.fromNumber(c);
        return Math.atan2(c.im, c.re);
    },
    
    conjugate: (c) => {
        c = Complex.fromNumber(c);
        return { re: c.re, im: -c.im };
    },
    
    toString: (c, precision = 3) => {
        c = Complex.fromNumber(c);
        const re = c.re.toFixed(precision);
        const im = c.im.toFixed(precision);
        if (Math.abs(c.im) < 0.0001) return re;
        if (Math.abs(c.re) < 0.0001) return `${im}i`;
        const sign = c.im >= 0 ? '+' : '';
        return `${re}${sign}${im}i`;
    }
};

// Export for use in other modules
window.GATES = GATES;
window.GATE_CATEGORIES = GATE_CATEGORIES;
window.Complex = Complex;
